# Publicar la web de la app (app.cuervo360.com)

La web de la app (`app-web/`) es un Worker de Cloudflare con los archivos estáticos que exporta Expo. **No toca** `cuervo360.com` (la página estática de `web-publica/`) ni el panel de admin.
Los comandos de «Construir» y «Probar en local» se corrieron el 26/10/2026; el `wrangler deploy` está **sin verificar** hasta el primer despliegue real.

## Antes de publicar

- La base ya tiene las migraciones 0090 a 0092 y la función `fotos-publicas` desplegada (`npx supabase migration list` y `npx supabase functions list`).
- En el panel de Supabase (Authentication → URL Configuration) hay que agregar `https://app.cuervo360.com` a las URL permitidas; sin eso los correos de confirmación y de recuperar contraseña no vuelven a la web. **Sin verificar**: se hace en el panel, no hay comando.
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

Cloudflare crea el DNS de `app.cuervo360.com` (dominio propio del Worker `cuervo360-app`). Después, repetir las comprobaciones de arriba contra `https://app.cuervo360.com`.

## Si algo sale mal

```bash
npx wrangler rollback -c app-web/wrangler.jsonc
```

Es independiente de `cuervo360.com`; las migraciones y el aviso v5 no se tocan.

## Notas

- Las cabeceras (`_headers`) salen de `scripts/app-web-reglas.mjs` y las prueba `test-utils/__tests__/app-web.test.ts`: CSP sin `unsafe-eval`, el único script en línea solo por su hash, conexiones solo al Supabase de producción, `noindex`.
- La web lleva `X-Robots-Tag: noindex` y `robots.txt` con `Disallow: /`: Google no la indexa hasta que se decida quitarlo (en `scripts/app-web-reglas.mjs` y `scripts/construir-app-web.mjs`).
- El Worker (`app-web/worker.mjs`) solo reescribe las fichas (`/departamentos/<id>` y `/servicios/<id>`) a su plantilla; lo demás son archivos. `/explorar` (la dirección del primer día) redirige a `/departamentos`.
