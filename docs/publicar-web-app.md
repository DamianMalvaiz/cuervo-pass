# Publicar la web de Cuervo 360 (cuervo360.com)

La web (`app-web/`) es un Worker de Cloudflare con los archivos estáticos que exporta Expo. Vive en **`cuervo360.com`**; `app.cuervo360.com` (donde nació el 26/10/2026) queda solo como atajo que redirige (301) a la misma dirección del dominio principal. No toca el panel de admin (`admin.cuervo360.com`).
El Worker también sirve `/privacidad` y `/abrir-app`, las dos páginas que antes servía `web-publica/` en este dominio (el build las copia de `web-publica/dist`; se conservan porque están enlazadas desde fuera del repositorio).
Los comandos de «Construir» y «Probar en local» se corrieron en Node 24; el `wrangler deploy` de `cuervo360.com` está **sin verificar** hasta el cambio real.

## Mover el dominio principal de `cuervo360-web` a `cuervo360-app` (una sola vez)

Un dominio propio solo puede pertenecer a un Worker, así que primero se suelta del viejo. Hay un corte de segundos a minutos en `cuervo360.com` entre el paso 1 y el 3.

1. `npx wrangler delete --name cuervo360-web` (suelta `cuervo360.com`; el código de esa página sigue en `web-publica/` y se puede volver a publicar).
2. `node --env-file=.env scripts/construir-app-web.mjs` (con **Node 24**: construye también `privacidad` y `abrir-app`).
3. `npx wrangler deploy -c app-web/wrangler.jsonc` (toma `cuervo360.com` y deja `app.cuervo360.com` redirigiendo).
4. Comprobar: `https://cuervo360.com/`, `/privacidad`, `/abrir-app`, `/departamentos`; y que `https://app.cuervo360.com/departamentos` salte a `https://cuervo360.com/departamentos`.

Para volver atrás: `npx wrangler delete --name cuervo360-app` y `npx wrangler deploy -c web-publica/wrangler.jsonc`.

## Antes de publicar

- La base ya tiene las migraciones 0090 a 0092 y la función `fotos-publicas` desplegada (`npx supabase migration list` y `npx supabase functions list`).
- En el panel de Supabase (Authentication → URL Configuration) hay que agregar `https://cuervo360.com` a las URL permitidas (la de `app.` puede quedarse mientras haya enlaces viejos); sin eso los correos de confirmación y de recuperar contraseña no vuelven a la web. **Sin verificar**: se hace en el panel, no hay comando.
- Cloudflare: `npx wrangler whoami` debe mostrar la cuenta dueña del dominio `cuervo360.com`.

## Construir

```bash
node --env-file=.env scripts/construir-app-web.mjs
```

Exporta con `--clear` y **se niega a continuar** si el bundle apunta a un Supabase que no es el de producción (o a uno local), o si lleva una llave JWT con un rol distinto de `anon`. Termina con «app-web/dist listo: N archivos, 1 script(s) en línea permitidos por hash».
Sin `--clear`, Metro reusa su caché y puede incrustar las variables de otra corrida (el 26/10/2026 salió un build con `127.0.0.1:54321`): por eso el script lo lleva siempre.

## Probar en local, con el mismo motor que Cloudflare

```bash
npx wrangler dev -c app-web/wrangler.jsonc --port 8788 --ip 127.0.0.1
```

Comprobar: `/`, `/departamentos`, `/roomies`, `/servicios`, `/departamentos/<id>`, `/servicios/<id>` y `/login` responden 200 (cada sección es su propia página); una ruta inventada y un id de más de 64 caracteres, 404; y que la consola del navegador no muestre violaciones de la CSP.

## Publicar

```bash
npx wrangler deploy -c app-web/wrangler.jsonc
```

Cloudflare crea el DNS de `cuervo360.com` y de `app.cuervo360.com` (dominios propios del Worker `cuervo360-app`). Después, repetir las comprobaciones de arriba contra `https://cuervo360.com`.

## Si algo sale mal

```bash
npx wrangler rollback -c app-web/wrangler.jsonc
```

No toca el panel de admin; las migraciones y el aviso v5 no se tocan.

## Notas

- Las cabeceras (`_headers`) salen de `scripts/app-web-reglas.mjs` y las prueba `test-utils/__tests__/app-web.test.ts`: CSP sin `unsafe-eval`, el único script en línea solo por su hash, conexiones solo al Supabase de producción, `noindex`.
- La web lleva `X-Robots-Tag: noindex` y `robots.txt` con `Disallow: /`: Google no la indexa hasta que se decida quitarlo (en `scripts/app-web-reglas.mjs` y `scripts/construir-app-web.mjs`).
- El Worker (`app-web/worker.mjs`) corre primero en toda petición: redirige el host `app.` al dominio principal y reescribe las fichas (`/departamentos/<id>` y `/servicios/<id>`) a su plantilla; lo demás son archivos. `/explorar` (la dirección del primer día) redirige a `/departamentos`.
