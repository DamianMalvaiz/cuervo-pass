// Convierte el horario en TEXTO de los negocios de ejemplo (origen «sembrado») a turnos estructurados (migración 0070), para que «Abierto ahora» funcione con ellos.
//
// Usa el MISMO analizador que la app (`src/lib/horario.ts`, sin dependencias; Node lo importa tal cual). Lo que el analizador no entiende («Lunes a Sábado», sin horas) se
// DEJA sin horario estructurado: no se inventa. Solo toca negocios sembrados que todavía no tienen turnos; es idempotente.
//
//   node --env-file=.env --env-file=.env.server scripts/horarios-sembrados.mjs            # plan
//   node --env-file=.env --env-file=.env.server scripts/horarios-sembrados.mjs --aplicar   # escribe

import { createClient } from '@supabase/supabase-js';

import { parsearHorarioTexto, resumenDeTurnos } from '../src/lib/horario.ts';

const aplicar = process.argv.includes('--aplicar');
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !clave) { console.error('Faltan EXPO_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.'); process.exit(1); }
const supabase = createClient(url, clave, { auth: { persistSession: false } });

const { data: negocios, error } = await supabase.from('negocios').select('id, nombre, horario').eq('origen', 'sembrado');
if (error) throw error;
const { data: yaTienen, error: e2 } = await supabase.from('negocio_horarios').select('negocio_id');
if (e2) { console.error('No se pudo leer negocio_horarios (¿ya aplicaste la migración 0070?):', e2.message); process.exit(1); }
const con = new Set((yaTienen ?? []).map((f) => f.negocio_id));

let convertidos = 0, sinHoras = 0, omitidos = 0;
const filas = [];
for (const n of negocios) {
  if (con.has(n.id)) { omitidos++; continue; }
  const turnos = parsearHorarioTexto(n.horario);
  if (!turnos) { sinHoras++; console.log(`  sin horas (se deja): ${n.nombre} · «${n.horario ?? ''}»`); continue; }
  convertidos++;
  console.log(`  ${n.nombre.padEnd(30)} «${n.horario}» → ${turnos.length} turnos · ${resumenDeTurnos(turnos)}`);
  for (const t of turnos) filas.push({ negocio_id: n.id, dia: t.dia, abre: t.abre, cierra: t.cierra });
}
console.log(`\nSembrados: ${negocios.length} · a convertir: ${convertidos} (${filas.length} turnos) · sin horas: ${sinHoras} · ya tenían: ${omitidos}`);
if (!aplicar) { console.log('NO se escribió nada. Usa --aplicar.'); process.exit(0); }

for (let i = 0; i < filas.length; i += 500) {
  const { error: e } = await supabase.from('negocio_horarios').insert(filas.slice(i, i + 500));
  if (e) { console.error(e.message); process.exit(1); }
}
console.log('Listo.');
