// Construye el panel de admin web (`panel-admin/`, Vite + React) en `web-admin/dist`, comprueba A QUÉ Supabase apunta el bundle y escribe las cabeceras.
//   node --env-file=.env scripts/construir-web-admin.mjs
// Se publica con: npx wrangler deploy -c web-admin/wrangler.jsonc
//
// Por qué comprueba el bundle: un build con las variables equivocadas puede apuntar a otro proyecto (a uno local, o a otro) sin que nada lo diga. Se exige que la
// URL de las variables sea la de producción y que el bundle la contenga y no contenga ninguna local.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { construirCabeceras, hashDeScript, scriptsEnLinea } from './web-admin-csp.mjs';

const SALIDA = 'web-admin/dist';
const PRODUCCION = 'https://vhkblnazibvuqgabsazx.supabase.co';

const recorrer = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? recorrer(p) : [p]; });

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const clave = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
if (!url || !clave) throw new Error('Faltan EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Corre: node --env-file=.env scripts/construir-web-admin.mjs');
if (url !== PRODUCCION) throw new Error(`La URL de las variables (${url}) no es la de producción (${PRODUCCION}): no se construye.`);

rmSync(SALIDA, { recursive: true, force: true });
execFileSync('npm', ['--prefix', 'panel-admin', 'run', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: clave },
});

const archivos = recorrer(SALIDA);
const js = archivos.filter((f) => f.endsWith('.js')).map((f) => readFileSync(f, 'utf8')).join('\n');
if (!js.includes(PRODUCCION)) throw new Error(`El bundle NO apunta a ${PRODUCCION}: no se publica.`);
if (/127\.0\.0\.1:54321|localhost:54321/.test(js)) throw new Error('El bundle apunta a un Supabase LOCAL: no se publica.');

const hashes = new Set(archivos.filter((f) => f.endsWith('.html')).flatMap((f) => scriptsEnLinea(readFileSync(f, 'utf8'))).map(hashDeScript));
writeFileSync(join(SALIDA, '_headers'), construirCabeceras({ supabaseUrl: PRODUCCION, hashes }));
writeFileSync(join(SALIDA, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
console.log(`web-admin/dist listo: ${archivos.length} archivos, ${hashes.size} script(s) en línea permitidos por hash.`);
