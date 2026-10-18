// Carga el catálogo de códigos postales (SEPOMEX / INEGI) a la tabla `codigos_postales` (migración 0069).
//
// El catálogo sale del paquete `@webrek/mx-cp`, que ahora es SOLO una herramienta de desarrollo: dejó de ir dentro de la app (eran 9.6 MB, el 72 % del
// JavaScript). La app consulta la base por la RPC `buscar_codigo_postal`.
//
// Idempotente: usa upsert por (cp, asentamiento). Por omisión solo CUENTA y muestra; para escribir, `--aplicar`.
//   node --env-file=.env --env-file=.env.server scripts/cargar-codigos-postales.mjs            # plan
//   node --env-file=.env --env-file=.env.server scripts/cargar-codigos-postales.mjs --aplicar   # escribe en la base

import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createClient } from '@supabase/supabase-js';
import { buscaCP } from '@webrek/mx-cp';

const aplicar = process.argv.includes('--aplicar');

// Todos los códigos: las claves de cada trozo por prefijo del paquete (lo mismo que él carga bajo demanda).
const dist = dirname(fileURLToPath(import.meta.resolve('@webrek/mx-cp')));
const codigos = [];
for (const archivo of readdirSync(dist).filter((f) => /^\d{2}-.+\.js$/.test(f))) {
  const modulo = await import(pathToFileURL(join(dist, archivo)).href);
  codigos.push(...Object.keys(modulo.default));
}
codigos.sort();

const filas = [];
let sinDatos = 0;
for (const cp of codigos) {
  const r = await buscaCP(cp);
  if (!r || !r.asentamientos?.length) { sinDatos++; continue; }
  const ciudad = r.ciudad && r.ciudad !== 'NULL' ? r.ciudad : null;
  const vistos = new Set();
  for (const a of r.asentamientos) {
    // La clave primaria es (cp, asentamiento): un nombre repetido dentro del mismo código se queda una vez.
    if (vistos.has(a.nombre)) continue;
    vistos.add(a.nombre);
    filas.push({ cp, estado: r.estado, municipio: r.municipio, ciudad, asentamiento: a.nombre, tipo: a.tipo ?? null });
  }
}

console.log(`Códigos postales: ${codigos.length} (${sinDatos} sin asentamientos) · filas a cargar: ${filas.length}`);
console.log('Muestra:', JSON.stringify(filas.find((f) => f.cp === '52044') ?? filas[0]));
if (!aplicar) { console.log('\nNO se escribió nada. Usa --aplicar.'); process.exit(0); }

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !clave) { console.error('Faltan EXPO_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.'); process.exit(1); }
const supabase = createClient(url, clave, { auth: { persistSession: false } });

const LOTE = 1000;
for (let i = 0; i < filas.length; i += LOTE) {
  const { error } = await supabase.from('codigos_postales').upsert(filas.slice(i, i + LOTE), { onConflict: 'cp,asentamiento' });
  if (error) { console.error(`Lote ${i / LOTE}: ${error.message}`); process.exit(1); }
  if ((i / LOTE) % 20 === 0) console.log(`  ${Math.min(i + LOTE, filas.length)}/${filas.length}`);
}
const { count } = await supabase.from('codigos_postales').select('*', { count: 'exact', head: true });
console.log(`\nListo. Filas en la tabla: ${count}`);
