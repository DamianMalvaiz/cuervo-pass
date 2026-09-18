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

## Integrar con tu trabajo de la Semana 11

Tienes push notifications **sin commitear** en `~/cuervo-pass`:

```
?? supabase/migrations/0008_notificaciones_push.sql
?? src/lib/pushNotifications.ts
?? eas.json
 M .env.example  app.json  package.json  package-lock.json
 M src/app/(tabs)/_layout.tsx  src/types/database.types.ts
```

Ya resolví las dos colisiones que **rompían** algo:

| Colisión | Cómo quedó |
|---|---|
| Ambas migraciones se llamaban `0008_` | Las de v5 se renumeraron a **0009–0018**. Tu `0008_notificaciones_push.sql` conserva su lugar |
| `crear_notificacion_mensaje()` usa `new.destinatario_id`, columna que v5 elimina — el push habría dejado de enviarse **sin un solo error en los logs** | La migración 0012 reimplementa el envío dentro de `al_insertar_mensaje()`, con un `if exists` para que corra igual si 0008 no está aplicada |
| `push_tokens` faltaba en los tipos de la rama v5 | Agregada a `database.types.ts`, junto con `enviar_notificacion_push` |

**Queda una cosa por arreglar a mano, y es tuya:** en
`src/lib/pushNotifications.ts`, línea 64:

```ts
router.push(`/chat/${datos.remitente_id}`);
```

Bajo v5 la ruta es `chat/[conversacionId]`, no `chat/[usuarioId]`. Tocar la
notificación abriría una ruta que ya no existe. La migración 0012 ya manda
`conversacion_id` dentro de los datos del push, así que el arreglo es:

```ts
const datos = respuesta.notification.request.content.data as {
  tipo?: string;
  conversacion_id?: string;
};
if (datos?.tipo === 'nuevo_mensaje' && datos.conversacion_id) {
  router.push(`/chat/${datos.conversacion_id}`);
}
```

No lo hice yo porque ese archivo no está versionado y sigue siendo tuyo: si lo
copiara a esta rama, tendrías dos copias divergiendo.

**El resto son conflictos normales de git**, todos aditivos: `.env.example`,
`app.json`, `package.json`, `_layout.tsx`. Al integrar, quédate con **las dos**
versiones de cada bloque — ninguna se contradice con la otra.

Y antes de nada: **commitea tu trabajo de la Semana 11 en `main`**. Ahora mismo
existe solo en el disco de tu laptop.
