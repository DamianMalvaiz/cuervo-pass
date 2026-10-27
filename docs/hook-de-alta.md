# Hook de alta de usuarios (0082)

Exige el dominio universitario **en el servidor**: un correo que no termina en `.edu.mx` solo se registra si la solicitud se declara `arrendador` o `comerciante`.
La función es `public.hook_alta_de_usuario` (migración 0082). **Sin este paso el filtro sigue viviendo solo en la app.**

## Local
Ya está en `supabase/config.toml` (`[auth.hook.before_user_created]`). Tras cambiarlo: `npx supabase stop && npx supabase start`.

## Producción (a mano: no hay forma de activarlo por migración)
1. Aplicar antes la 0082 (con respaldo, como cualquier migración) y comprobar que existe la función.
2. Supabase → **Authentication → Hooks** → **Before User Created** → tipo *Postgres function* → esquema `public`, función `hook_alta_de_usuario` → activar.
3. Probar con un Gmail sin declararse vendedor: debe responder 400 «Usa el correo de tu universidad…». Con un `.edu.mx` y con un Gmail declarado
   `tipo_cuenta: arrendador`, debe dejar pasar.

## Cómo se comprobó en local (24/10/2026)
`POST /auth/v1/signup` con un Gmail sin declarar → 400; declarado arrendador → 200 y `cuenta_restringida = true`; universitario → 200 y `false`.
`POST /auth/v1/admin/users` no pasa por el hook; las cuentas de servicio llevan `app_metadata.sin_restriccion` para no nacer restringidas.

## Si falla
El hook **falla cerrado**: si la función no existe o da error, nadie se registra. Para desactivarlo: el mismo panel. La reversión de la migración está en su cabecera.
