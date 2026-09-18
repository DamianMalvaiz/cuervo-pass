# Cómo aplicar las migraciones 0009–0018

## Por qué `supabase db push` falló

```
Cannot find project ref. Have you run supabase link?
```

No es un error tuyo: **este repositorio nunca corrió `supabase init` ni
`supabase link`.** No hay `supabase/config.toml` ni `supabase/.temp/project-ref`,
así que el CLI no sabe contra qué proyecto trabajar.

Y hay una razón de fondo: hasta ahora las migraciones **nunca se aplicaron con el
CLI**. Se pegaron a mano en el SQL Editor de Supabase — lo dicen sus propias
cabeceras, desde `0001_esquema_inicial.sql`:

> *Corre con `supabase db push` (CLI vinculado a tu proyecto) **o pegado en el
> SQL editor de Supabase**.*

Eso importa para lo que sigue: la base remota tiene las tablas de 0001–0008, pero
**no tiene el historial** que el CLI usa para saber qué falta. Si vinculas el
proyecto y corres `db push` sin más, el CLI intentará aplicar **0001 en
adelante**, contra una base donde esas tablas ya existen. Truena en el primer
`create table`, y si no tronara sería peor.

Elige un camino. El A es el que ya conoces; el B es el que v5 recomienda (§34) y
el que hace falta para que `supabase test db` y el CI funcionen.

---

## Antes de cualquiera de los dos: respaldo

Sin `link`, `supabase db dump` no corre. Usa el panel:

**Dashboard → Database → Backups → Download**, o bien el SQL Editor para
guardarte las tablas que más duelen (`usuarios`, `publicaciones`, `mensajes`).

Desde la semana 5 hay datos que costaron horas. Este paso no se puede hacer
después.

---

## Camino A — SQL Editor (lo que ya haces)

Funciona hoy, sin instalar nada.

1. **Primero, confirma si tu 0008 de push ya está aplicado.** En el SQL Editor:

   ```sql
   select to_regclass('public.push_tokens');
   ```

   Si devuelve `null`, pega y corre `0008_notificaciones_push.sql` **antes** de
   seguir. La migración 0012 reimplementa el trigger de mensajes y espera que la
   función `enviar_notificacion_push` ya exista (si no existe, se salta el push
   sin fallar — pero entonces tendrías que volver a correr 0012 después).

2. Pega y corre, **en orden y uno por uno**, esperando a que cada uno termine:

   ```
   0009_v5_usuarios.sql
   0010_v5_publicaciones.sql
   0011_v5_roomies.sql
   0012_v5_conversaciones.sql
   0013_v5_contactos_y_cuotas.sql
   0014_v5_rls_y_vistas.sql
   0015_v5_motor_sugerencias.sql
   0016_v5_storage_privado.sql
   0017_v5_arco_y_geocoding.sql
   0018_v5_vectores_obsoletos.sql
   ```

   El orden no es decorativo: 0012 borra `mensajes.destinatario_id` y 0014 crea
   policies que dependen de la tabla `conversaciones` que 0012 crea.

3. **Si una truena, para.** No corras la siguiente. Mándame el error: se corrige
   con una migración nueva, nunca editando la que ya se aplicó (§33.4, regla 1).

**Lo que este camino NO te da:** `supabase test db` no funciona sin CLI
vinculado, así que las doce aserciones de pgTAP —el control que sustituye a las
capturas de pantalla, AUD-13— se quedan sin correr. Y el job `base-de-datos` del
CI tampoco. Por eso existe el camino B.

---

## Camino B — CLI (lo que pide v5 §34)

Media hora, una sola vez, y te desbloquea las pruebas de RLS y el CI.

```bash
cd ~/cuervo-pass

# 1. Crea supabase/config.toml (respeta lo que ya hay en supabase/)
npx supabase init

# 2. Vincula con tu proyecto. El ref sale de la URL del dashboard:
#    https://supabase.com/dashboard/project/<ESTE-ES-EL-REF>
npx supabase link --project-ref <TU_PROJECT_REF>

# 3. Respaldo, ahora sí desde el CLI
mkdir -p respaldos
npx supabase db dump --data-only -f respaldos/$(date +%F).sql

# 4. ¿Qué cree el CLI que está aplicado? (va a decir: nada)
npx supabase migration list
```

**El paso que evita el desastre.** Le dices al CLI que 0001–0008 ya están en la
base, sin volver a ejecutarlas:

```bash
npx supabase migration repair --status applied \
  0001 0002 0003 0004 0005 0006 0007 0008
```

Si `push_tokens` **no** existe todavía (ver el paso 1 del camino A), deja el
`0008` fuera de esa lista para que `db push` sí lo aplique.

```bash
# 5. Ahora sí: aplica solo 0009-0018
npx supabase migration list      # verifica antes de empujar
npx supabase db push

# 6. Las pruebas de acceso (necesita Docker corriendo)
npx supabase test db
```

Si `supabase test db` se queja de Docker, instálalo o quédate con el camino A y
corre las pruebas más adelante — pero antes de la entrega, porque son la
evidencia de que RLS hace lo que el documento dice.

---

## Cuidado: estás en el directorio equivocado

Los comandos que corriste fueron en `~/cuervo-pass`, que está en la rama `main`
y **todavía no tiene las migraciones v5**. El trabajo está en el worktree:

```bash
cd ~/cuervo-pass/.claude/worktrees/bridge-cse_01TzND5SX7DaPvbpa5cULZ8T
ls supabase/migrations/     # aquí sí aparecen 0009-0018
```

Lo limpio es integrar la rama a `main` antes de aplicar nada — ver la sección de
abajo. Si prefieres avanzar ya, puedes copiar los `.sql` al SQL Editor desde el
worktree sin mover ramas.

Ah, y un detalle del primer comando: hiciste `cd respaldos/` y luego
`-f respaldos/$(date +%F).sql`, que apunta a `respaldos/respaldos/…` — una
carpeta que no existe. Corre siempre desde la raíz del proyecto.

---

## Tu trabajo de la Semana 11 ya está en esta rama

Las notificaciones push existían solo como archivos sin versionar en
`~/cuervo-pass`. Están incorporadas aquí, con las tres colisiones resueltas:

| Colisión | Cómo quedó |
|---|---|
| Ambas migraciones se llamaban `0008_` | Las de v5 se renumeraron a **0009–0018**. `0008_notificaciones_push.sql` conserva su lugar |
| `crear_notificacion_mensaje()` usa `new.destinatario_id`, columna que v5 elimina — el push habría dejado de enviarse **sin un solo error en los logs** | La migración 0012 reimplementa el envío dentro de `al_insertar_mensaje()`, con un `if exists` para que corra igual si 0008 no está aplicada |
| El deep link abría `/chat/<remitente_id>`, ruta que ya no existe | Corregido a `conversacion_id`, que el trigger ya manda en los datos del push |

`push_tokens` y `enviar_notificacion_push` entran en `database.types.ts`, y el
registro del token se combinó con el renombrado de la pestaña Roomings → Roomies.

### Limpia las copias sin versionar antes de integrar

En `~/cuervo-pass` siguen existiendo los archivos originales, sin versionar. Git
se negará a hacer el merge mientras estén ahí («untracked working tree files
would be overwritten»), porque la rama trae su propia versión de cada uno —
mejor, en el caso de `pushNotifications.ts`.

```bash
cd ~/cuervo-pass

# Red de seguridad, por si quieres comparar después
git stash push -u -m "semana-11-original" \
  eas.json src/lib/pushNotifications.ts \
  supabase/migrations/0008_notificaciones_push.sql \
  app.json package.json package-lock.json \
  src/app/\(tabs\)/_layout.tsx .env.example

git status --short     # debe quedar limpio, salvo .claude/worktrees/
```

Y ya con el árbol limpio, integra la rama (o haz merge del PR desde GitHub).

Cuando confirmes que todo está bien, borra ese stash **por su nombre**, no con
un `git stash drop` a secas:

```bash
git stash list            # localiza la línea con "semana-11-original"
git stash drop 'stash@{N}'   # N es el índice que viste arriba
```

`git stash drop` sin índice borra el más reciente, que en este proyecto puede ser
de otra sesión: los worktrees comparten la misma pila de stashes.
