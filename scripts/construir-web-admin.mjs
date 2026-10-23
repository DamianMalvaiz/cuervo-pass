// Construye el panel de admin web en `web-admin/dist`: exporta la app a web, comprueba a QUÉ Supabase apunta el bundle y escribe las cabeceras.
//   node scripts/construir-web-admin.mjs
// Se publica con: npx wrangler deploy -c web-admin/wrangler.jsonc
//
// Por qué comprueba el bundle: Metro CACHEA las variables EXPO_PUBLIC_*. Un export con la caché vieja puede apuntar a otro proyecto (a uno local, o a
// producción cuando se quería local) sin que nada lo diga. Se exporta con `--clear` y se exige que el bundle contenga la URL de producción y ninguna local.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { construirCabeceras, hashDeScript, scriptsEnLinea } from './web-admin-csp.mjs';

const SALIDA = 'web-admin/dist';
const PRODUCCION = 'https://vhkblnazibvuqgabsazx.supabase.co';

const recorrer = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? recorrer(p) : [p]; });

rmSync(SALIDA, { recursive: true, force: true });
execFileSync('npx', ['expo', 'export', '-p', 'web', '--clear', '--output-dir', SALIDA], { stdio: 'inherit', env: { ...process.env, CI: '1' } });

const archivos = recorrer(SALIDA);
const js = archivos.filter((f) => f.endsWith('.js')).map((f) => readFileSync(f, 'utf8')).join('\n');
if (!js.includes(PRODUCCION)) throw new Error(`El bundle NO apunta a ${PRODUCCION}: no se publica.`);
if (/127\.0\.0\.1:54321|localhost:54321/.test(js)) throw new Error('El bundle apunta a un Supabase LOCAL: no se publica.');

const hashes = new Set(archivos.filter((f) => f.endsWith('.html')).flatMap((f) => scriptsEnLinea(readFileSync(f, 'utf8'))).map(hashDeScript));
writeFileSync(join(SALIDA, '_headers'), construirCabeceras({ supabaseUrl: PRODUCCION, hashes }));
writeFileSync(join(SALIDA, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
console.log(`web-admin/dist listo: ${archivos.length} archivos, ${hashes.size} script(s) en línea permitidos por hash.`);
