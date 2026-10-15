# Cómo aplicar migraciones a producción

Procedimiento vigente, verificado paso a paso el 15/10/2026 al aplicar las
migraciones 0040, 0041 y 0042. Cada comando de aquí se ejecutó; ninguno se escribió de
memoria.

## Estado de partida

Producción tiene el **historial de migraciones completo** y el proyecto está vinculado
con el CLI (`supabase/.temp/project-ref`, que no se versiona). Por eso **no hace falta
ningún `migration repair`**: esa instrucción vivía aquí cuando las migraciones se
pegaban a mano en el SQL Editor y la base no tenía historial, y dejó de ser cierta.
Si dudas, `npx supabase migration list` lo dice: las dos columnas deben coincidir.

Qué se necesita:

| | |
|---|---|
| Proyecto vinculado | `npx supabase link --project-ref <REF>` (una vez por máquina) |
| Contraseña de la base | `SUPABASE_DB_PASSWORD` en `.env.server` |
| Docker corriendo | el `dump` lo necesita |
| CLI | `npx supabase`, en la versión que fija `.github/workflows/ci.yml` |

Cargar la contraseña en la sesión sin escribirla ni imprimirla:

```bash
set -a && . ./.env.server && set +a
```

---

## 0 · Antes de tocar producción: que pase en local

```bash
npx supabase migration up     # la aplica a la base local
npx supabase test db          # pgTAP: la migración y su prueba, juntas
```

Si amplías una policy de RLS o de Storage, su aserción en `supabase/tests/rls.test.sql`
va **en el mismo commit** (AGENTS.md, invariante 6). Y nunca se edita una migración ya
aplicada: su hash vive en `supabase_migrations.schema_migrations`; se corrige con una
migración nueva.

## 1 · Qué falta

```bash
npx supabase migration list
```

Lo que está en «Local» y no en «Remote» es lo que se va a aplicar. Lo que está en
«Remote» y no en «Local» es **deriva** y hay que entenderla antes de seguir.

## 2 · Comprobar la migración contra los datos REALES

Que pase en local no dice que pase con los datos de producción. Para cada migración,
pregunta qué cosa concreta podría romper y mídela con consultas de **solo lectura**:

```bash
npx supabase db query --linked "select count(*) from public.publicaciones"
```

Ejemplos de preguntas que se hicieron el 15/10/2026:

| Migración | Qué podía romper | Qué se midió |
|---|---|---|
| Tope de 15 activas al activar | Cuentas que ya lo superen | máximo de activas por cuenta; cuentas sobre 15 |
| Límites del bucket (5 MiB, `image/jpeg`) | Archivos existentes que los incumplan | cuántos objetos superan 5 MiB o no son `image/jpeg`, y el mayor |
| Policy de borrado de `push_tokens` | Una policy previa | las policies actuales de la tabla |

Anota también el **estado de partida** (cuentas, filas de las tablas tocadas, objetos
de Storage): lo vas a necesitar en el paso 6.

## 3 · Respaldo

Antes de cualquier `db push` (AGENTS.md). Desde la **raíz del proyecto**:

```bash
mkdir -p respaldos
npx supabase db dump --data-only -f respaldos/$(date +%F)-antes-de-NNNN.sql
chmod 600 respaldos/$(date +%F)-antes-de-NNNN.sql
```

`respaldos/` está en `.gitignore`: el archivo lleva datos personales y no debe subirse.

Dos cosas que conviene saber del volcado:

- **Es solo DATOS** (`--data-only`). El esquema vive en las migraciones del repositorio.
- **No contiene los archivos de Storage**, solo su tabla de metadatos. Una migración que
  los toque exige otro respaldo.

**Compruébalo, no lo des por bueno.** Un archivo de 1 MB puede estar vacío de lo que
importa. El volcado trae **una sentencia `INSERT` por tabla, con una fila por línea** (no
`COPY`), así que se cuenta así:

```bash
F=respaldos/AAAA-MM-DD-antes-de-NNNN.sql
filas() { awk -v t="INSERT INTO \"$1\"" 'index($0,t)==1{f=1;next} f&&/^[ \t]*\(/{c++} f&&/;[ \t]*$/{f=0} END{print c+0}' $F; }
filas 'public"."usuarios'      # debe coincidir con el conteo de la base
filas 'public"."publicaciones'
```

Compara cada cifra con la que obtuviste en el paso 2. Si no coinciden, no sigas.

## 4 · Ensayo

```bash
npx supabase db push --dry-run
```

Debe listar **exactamente** las migraciones del paso 1 y ninguna más. Si lista otras, para.

## 5 · Aplicar

```bash
npx supabase db push          # pide confirmación
npx supabase db push --yes    # sin preguntar, para ejecutarlo desde un script
```

Cada migración se aplica en orden. **Si una falla, para**: no se corre la siguiente, y se
corrige con una migración nueva, nunca editando la que ya se aplicó.

## 6 · Verificar que surtió efecto

No te fíes del mensaje del CLI: pregúntale a la base.

```bash
npx supabase migration list   # sin faltantes y sin deriva
```

Y, con `db query --linked`, el estado **real** de lo que la migración cambió: las
policies de la tabla (`pg_policies`), la definición del trigger
(`pg_get_triggerdef`), la ACL de la función (`proacl`), la configuración del bucket
(`storage.buckets`). Después, los conteos del paso 2: tienen que ser **idénticos**. Una
migración que cambia el esquema no debe cambiar las filas.

## 7 · Verificar que producción lo HACE CUMPLIR

Lo anterior comprueba que la configuración *dice* lo correcto. Estos dos scripts
comprueban que se *aplica*, y lo hacen contra producción:

```bash
node --env-file=.env --env-file=.env.server scripts/prueba-rls.mjs   # aislamiento entre cuentas
npm run verificar:bucket                                             # límites de las fotos
```

**Escriben datos transitorios en producción**: `prueba-rls.mjs` crea cuentas temporales y
las borra al terminar (en un `finally`); `verificar:bucket` sube archivos de prueba a
`sondas/` y borra los que se aceptaron. Pídele permiso a quien corresponda antes de
correrlos, y comprueba después que no dejaron residuos: cuentas de prueba restantes (0),
objetos en `sondas/` (0), cola de fotos huérfanas (0) y los conteos del paso 2.

---

## Si algo sale mal

- **Cada migración trae su reversión escrita en la cabecera.** Aplícala como migración
  nueva; no se borra la fila de `schema_migrations`.
- **El respaldo restaura datos, no esquema.** Sirve si una migración tocó filas, no si
  cambió una policy.
- **No sigas con la siguiente.** Un error a medias es información; encadenar tres
  migraciones sobre una base en un estado que no entiendes la destruye.

## Por qué este documento cambió

Hasta la 0039 las migraciones se pegaban a mano en el SQL Editor, y la base remota tenía
las tablas pero no el historial, de modo que `db push` habría intentado reaplicar 0001.
Eso pedía un `migration repair` previo y un «camino A» (SQL Editor) y un «camino B» (CLI).
Ya no: el CLI está vinculado y el historial está completo. El documento anterior seguía
describiendo ese sistema, que es exactamente el defecto que `README.md` y `AGENTS.md`
nombran como el más caro de este repositorio.
