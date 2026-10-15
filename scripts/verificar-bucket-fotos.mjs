#!/usr/bin/env node
//
// Verifica que el bucket `fotos` APLICA sus límites · hallazgo del 15/10/2026
//
//   node --env-file=.env --env-file=.env.server scripts/verificar-bucket-fotos.mjs
//
// Sube de verdad tres sondas a un prefijo propio (`sondas/`) y las borra al
// terminar:
//
//   1. una foto normal, que DEBE aceptarse: un límite que rechaza lo legítimo es
//      peor que no tenerlo;
//   2. un archivo de 6 MiB, que DEBE rechazarse por tamaño;
//   3. un archivo de otro tipo, que DEBE rechazarse por tipo.
//
// Por qué existe además de las aserciones 97 y 98 de `supabase/tests/rls.test.sql`:
// esas comprueban que la CONFIGURACIÓN dice 5 MiB e image/jpeg. Que Storage la
// APLIQUE es otra pregunta, y pgTAP no habla con la API de Storage. Una columna con
// el valor correcto no prueba que se haga cumplir.
//
// Usa la clave de servicio, así que no depende de ninguna cuenta ni de la policy de
// subida: lo que se mide es el límite del BUCKET, que aplica a todos. Sale con
// código 1 si alguna sonda se comporta distinto de lo esperado.

import { createClient } from '@supabase/supabase-js';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const CLAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !CLAVE) {
  console.error('Faltan EXPO_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. Ver AGENTS.md → Secretos.');
  process.exit(1);
}

const BUCKET = 'fotos';
const MIB = 1024 * 1024;
const admin = createClient(URL, CLAVE, { auth: { persistSession: false } });
const prefijo = `sondas/${Date.now()}`;

/** Cabecera JPEG real seguida de relleno: no es una imagen válida, ni hace falta. */
const jpeg = (bytes) => {
  const b = Buffer.alloc(bytes, 0x20);
  b.set([0xff, 0xd8, 0xff, 0xe0], 0);
  return b;
};

const sondas = [
  { nombre: 'una foto normal (50 KB, image/jpeg) se ACEPTA', ruta: `${prefijo}/normal.jpg`, datos: jpeg(50 * 1024), tipo: 'image/jpeg', debeAceptarse: true },
  { nombre: 'un archivo de 6 MiB se RECHAZA por tamaño', ruta: `${prefijo}/grande.jpg`, datos: jpeg(6 * MIB), tipo: 'image/jpeg', debeAceptarse: false },
  { nombre: 'un archivo text/plain se RECHAZA por tipo', ruta: `${prefijo}/texto.txt`, datos: Buffer.from('no soy una foto'), tipo: 'text/plain', debeAceptarse: false },
  { nombre: 'un archivo image/png se RECHAZA por tipo', ruta: `${prefijo}/otra.png`, datos: jpeg(10 * 1024), tipo: 'image/png', debeAceptarse: false },
];

const aceptadas = [];
let fallos = 0;

for (const s of sondas) {
  const { error } = await admin.storage.from(BUCKET).upload(s.ruta, s.datos, { contentType: s.tipo });
  const seAcepto = !error;
  if (seAcepto) aceptadas.push(s.ruta);
  const bien = seAcepto === s.debeAceptarse;
  if (!bien) fallos += 1;
  const motivo = error ? ` (${error.message ?? error.statusCode})` : '';
  console.log(`${bien ? '  ok   ' : '  FALLA'} ${s.nombre}${bien ? '' : ' — hizo lo contrario'}${motivo}`);
}

// Limpieza: solo lo que SÍ se subió. Va por la API de Storage, no por SQL.
if (aceptadas.length) {
  const { error } = await admin.storage.from(BUCKET).remove(aceptadas);
  if (error) console.warn(`  aviso: no se pudieron borrar las sondas (${aceptadas.join(', ')}): ${error.message}`);
}

console.log(fallos === 0 ? '\n  El bucket aplica sus límites.' : `\n  ${fallos} sonda(s) no se comportaron como se esperaba.`);
process.exit(fallos === 0 ? 0 : 1);
