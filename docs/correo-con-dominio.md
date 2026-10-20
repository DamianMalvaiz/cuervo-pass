# Correo con el dominio propio (cuervo360.com)

Estado: **guía, sin hacer** (19/10/2026). Nada de esto toca el código de la app; son ajustes en los paneles de Cloudflare, del proveedor de correo y de Supabase.
Las claves y tokens se pegan **tú** en cada panel: no pasan por el chat ni se escriben en el repositorio.

## Por qué
Hoy los correos de confirmación y de recuperación salen con el remitente por defecto de Supabase, que tiene un límite bajo de envíos por hora. En una demostración
en vivo, un registro nuevo puede quedarse sin correo justo delante de quien evalúa. Con SMTP propio el límite sube y el remitente es `no-reply@cuervo360.com`.

## 1 · Recibir: `privacidad@cuervo360.com` → tu Gmail (gratis)
1. Cloudflare → tu dominio → **Email → Email Routing** → *Enable*. Acepta que agregue sus registros MX y SPF (los pone solo).
2. *Routing rules → Custom addresses → Create address*: `privacidad` → destino tu Gmail. Cloudflare te manda un enlace de verificación a ese Gmail: ábrelo.
3. Opcional: `contacto@` y `soporte@` con el mismo destino.
Prueba: mándate un correo desde otra cuenta a `privacidad@cuervo360.com`; debe llegar a tu Gmail.

## 2 · Enviar: SMTP para Supabase
Cualquier proveedor sirve (Resend, Brevo…). Con Resend (verifica sus límites vigentes antes de contar con ellos; el plan gratuito ha sido de unos 3 000 correos al mes y 100 al día):
1. Crea cuenta en resend.com → **Domains → Add domain** → `cuervo360.com`.
2. Resend te da registros DNS (DKIM, SPF y uno para rebotes). Agrégalos en Cloudflare → **DNS → Records**, tal cual, **con la nube en gris** (solo DNS, sin proxy). Espera a que Resend marque *Verified*.
3. Agrega también un registro DMARC en Cloudflare: tipo `TXT`, nombre `_dmarc`, valor `v=DMARC1; p=none; rua=mailto:privacidad@cuervo360.com`. Sin él, Gmail desconfía más de los correos nuevos.
4. En Resend crea una **API key** con permiso solo de envío. Cópiala una vez.
5. Supabase → *Authentication → Emails → SMTP Settings* → activar *Custom SMTP*:
   host `smtp.resend.com` · puerto `465` · usuario `resend` · contraseña = la API key · remitente `no-reply@cuervo360.com` · nombre «Cuervo 360».
6. En *Authentication → Rate Limits* sube el límite de correos por hora a lo que tu plan permita (con SMTP propio ya se puede).

## 3 · Verificarlo (antes de la demostración, nunca durante)
- Registra una cuenta con **un correo tuyo de prueba** (no el de nadie más) y comprueba que el correo llega, no cae en spam y viene de `no-reply@cuervo360.com`.
- En Gmail → *Mostrar original*: deben decir `SPF: PASS`, `DKIM: PASS` y `DMARC: PASS`.
- Prueba también «Olvidé mi contraseña».
Si algo cae en spam, casi siempre falta uno de los tres registros del paso 2 o está con la nube naranja.

## 4 · Cambiar el correo del aviso de privacidad (decisión tuya, pendiente)
`CORREO_RESPONSABLE` (en `src/lib/avisoPrivacidad.ts`) y `docs/aviso-privacidad.md` hoy dicen `al222211405@gmail.com`. Cambiarlo a `privacidad@cuervo360.com` es lo más serio de
cara a quien evalúa, **pero modifica el texto del aviso**: si el aviso v3 ya se mostró a alguien, hay que decidir si eso exige una versión nueva (y por tanto otra
aceptación) o si basta con una corrección de contacto. Dime qué prefieres y lo hago junto con su prueba; no lo cambio por mi cuenta.
