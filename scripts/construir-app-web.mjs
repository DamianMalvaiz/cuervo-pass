// Construye la web de Cuervo 360 (cuervo360.com; Expo, `expo export --platform web`) en `app-web/dist`, comprueba A QUÉ Supabase apunta el bundle y escribe las cabeceras.
//   node --env-file=.env scripts/construir-app-web.mjs
// Se publica con: npx wrangler deploy -c app-web/wrangler.jsonc
//
// Por qué se comprueba el bundle: sin `--clear`, Metro reusa su caché y puede incrustar las variables de OTRA corrida (a un Supabase local); el 26/10/2026 un build así salió con
// `127.0.0.1:54321` y nada lo decía. Se exige que la URL sea la de producción, que el bundle la contenga y no contenga ninguna local, y que toda llave JWT que lleve sea la
// pública (`anon`): una `service_role` aquí sería una fuga.
import { execFileSync } from 'node:child_process';
import { copyFileSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { construirCabeceras, hashDeScript, nombreSinCorchetes, rolesDeJwt, scriptsEnLinea } from './app-web-reglas.mjs';

const SALIDA = 'app-web/dist';
const PRODUCCION = 'https://vhkblnazibvuqgabsazx.supabase.co';

const recorrer = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? recorrer(p) : [p]; });

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const clave = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
if (!url || !clave) throw new Error('Faltan EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Corre: node --env-file=.env scripts/construir-app-web.mjs');
if (url !== PRODUCCION) throw new Error(`La URL de las variables (${url}) no es la de producción (${PRODUCCION}): no se construye.`);

rmSync(SALIDA, { recursive: true, force: true });
execFileSync('npx', ['expo', 'export', '--platform', 'web', '--clear', '--output-dir', SALIDA], { stdio: 'inherit', env: process.env });

const js = recorrer(SALIDA).filter((f) => f.endsWith('.js')).map((f) => readFileSync(f, 'utf8')).join('\n');
if (!js.includes(PRODUCCION)) throw new Error(`El bundle NO apunta a ${PRODUCCION}: no se publica.`);
if (/127\.0\.0\.1:54321|localhost:54321/.test(js)) throw new Error('El bundle apunta a un Supabase LOCAL: no se publica.');
const ajenos = rolesDeJwt(js).filter((rol) => rol !== 'anon');
if (ajenos.length > 0) throw new Error(`El bundle lleva una llave con rol «${ajenos[0]}»: solo puede llevar la pública (anon). No se publica.`);

// Sin corchetes en los nombres (el Worker apunta a `_id`), la página de «no encontrado» con el nombre que Cloudflare espera, y sin el mapa de rutas de desarrollo.
for (const f of recorrer(SALIDA)) {
  const nuevo = nombreSinCorchetes(f);
  if (nuevo !== f) { mkdirSync(dirname(nuevo), { recursive: true }); renameSync(f, nuevo); }
}
copyFileSync(join(SALIDA, '+not-found.html'), join(SALIDA, '404.html'));
rmSync(join(SALIDA, '_sitemap.html'), { force: true });

// `cuervo360.com` ya servía el aviso de privacidad y la página a la que llegan los correos (`/privacidad`, `/abrir-app`): están enlazados desde fuera de este repositorio (plantillas de correo,
// avisos), así que conservan su dirección exacta. Salen de la misma fuente que antes (`construir-web-publica.mjs`, que lee el aviso de la app); no llevan scripts y su CSP cabe dentro de la de la app.
execFileSync(process.execPath, ['scripts/construir-web-publica.mjs'], { stdio: 'inherit' });
for (const pagina of ['privacidad.html', 'abrir-app.html']) copyFileSync(join('web-publica/dist', pagina), join(SALIDA, pagina));

const archivos = recorrer(SALIDA);
const hashes = new Set(archivos.filter((f) => f.endsWith('.html')).flatMap((f) => scriptsEnLinea(readFileSync(f, 'utf8'))).map(hashDeScript));
writeFileSync(join(SALIDA, '_headers'), construirCabeceras({ supabaseUrl: PRODUCCION, hashes }));
writeFileSync(join(SALIDA, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
console.log(`app-web/dist listo: ${archivos.length} archivos, ${hashes.size} script(s) en línea permitidos por hash.`);
