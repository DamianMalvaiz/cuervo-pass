// Completa los datos de los roomies de DEMOSTRACIÓN para que la compatibilidad (0066) tenga con qué comparar.
//
// Medido el 18/10/2026: en los 30 roomies activos de las cuentas demo, `nivel_ruido` es nulo en todos, `horario_predominante` es «mixto» en todos y
// `presupuesto_aportacion` es nulo en todos. Sin esos datos la compatibilidad solo puede comparar tabaco y mascotas, y la demo no enseña razones de ruido,
// horario ni aportación. Estas cuentas (@cuervopass-demo.test) son FABRICADAS y rotuladas como tales: completarlas no inventa datos de nadie.
//
// Determinista: el valor sale de un hash del id, así que correrlo dos veces deja lo mismo. Solo toca cuentas @cuervopass-demo.test.
//
//   node --env-file=.env --env-file=.env.server scripts/completar-roomies-demo.mjs            # muestra el plan
//   node --env-file=.env --env-file=.env.server scripts/completar-roomies-demo.mjs --aplicar   # escribe

import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !clave) { console.error('Faltan EXPO_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.'); process.exit(1); }
const aplicar = process.argv.includes('--aplicar');
const admin = createClient(url, clave, { auth: { persistSession: false } });

const pick = (id, sal, opciones) => opciones[parseInt(createHash('sha256').update(id + sal).digest('hex').slice(0, 8), 16) % opciones.length];
const entre = (id, sal, a, b) => a + (parseInt(createHash('sha256').update(id + sal).digest('hex').slice(0, 8), 16) % (b - a + 1));

const { data: roomies, error } = await admin.from('roomies').select('usuario_id, presupuesto_aportacion').eq('estado', 'activo');
if (error) throw error;

// Solo cuentas de demostración: se comprueba el correo de CADA una, no se asume.
const demo = [];
for (const r of roomies) {
  const { data } = await admin.auth.admin.getUserById(r.usuario_id);
  if (data?.user?.email?.endsWith('@cuervopass-demo.test')) demo.push(r);
}
console.log(`Roomies activos: ${roomies.length} · de demostración: ${demo.length}${aplicar ? '' : '  (NO se escribe nada; usa --aplicar)'}\n`);

const resumen = { ruido: {}, horario: {} };
for (const r of demo) {
  const id = r.usuario_id;
  const ruido = pick(id, 'ruido', ['bajo', 'bajo', 'medio', 'medio', 'alto']);
  const horario = pick(id, 'horario', ['diurno', 'diurno', 'nocturno', 'mixto']);
  const aporte = r.presupuesto_aportacion ?? entre(id, 'aporte', 1500, 3500);
  resumen.ruido[ruido] = (resumen.ruido[ruido] ?? 0) + 1;
  resumen.horario[horario] = (resumen.horario[horario] ?? 0) + 1;
  if (!aplicar) continue;
  const { error: e1 } = await admin.from('usuarios').update({ nivel_ruido: ruido, horario_predominante: horario }).eq('id', id);
  const { error: e2 } = r.presupuesto_aportacion == null
    ? await admin.from('roomies').update({ presupuesto_aportacion: aporte }).eq('usuario_id', id)
    : { error: null };
  if (e1 || e2) { console.error(`${id}: ${(e1 ?? e2).message}`); process.exit(1); }
}
console.log('Ruido:', resumen.ruido, ' Horario:', resumen.horario);
if (aplicar) console.log('\nListo. Los vectores no cambian.');
