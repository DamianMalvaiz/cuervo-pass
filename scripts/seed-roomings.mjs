// Complemento de seed-demo.mjs: crea la fila en `roomings` para las cuentas
// demo que ya quedaron con usuarios.busca_roomie = true — seed-demo.mjs marcó
// ese campo pero nunca insertó en la tabla que la pantalla Roomings realmente
// lee, así que la lista salía vacía aunque el switch se viera "activado".
//
// Uso: node --env-file=.env scripts/seed-roomings.mjs

import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Faltan EXPO_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const DESCRIPCIONES_BUSQUEDA = [
  'Busco roomie tranquilo/a, horario de clases por la mañana, me gusta el orden.',
  'Busco compartir depa cerca de la UTVT, presupuesto ajustado, no fumador.',
  'Estudio en UTVT, busco roomie para depa de 2 cuartos, acepto mascotas.',
  'Busco alguien responsable para compartir gastos, ambiente relajado.',
  'Roomie que no fume dentro del depa, me gusta cocinar y compartir.',
  'Busco compartir renta cerca del transporte, horario flexible.',
];

function aleatorio(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

async function main() {
  const { data: usuariosDemo, error: errorUsuarios } = await admin
    .from('usuarios')
    .select('id')
    .eq('busca_roomie', true)
    .eq('biografia', 'Cuenta de prueba generada para probar sugerencias — Cuervo Pass.');
  if (errorUsuarios) {
    console.error('No se pudo leer usuarios:', errorUsuarios.message);
    process.exit(1);
  }

  console.log(`Creando roomings para ${usuariosDemo.length} cuentas demo con busca_roomie = true...`);
  let creados = 0;
  for (const usuario of usuariosDemo) {
    const { error } = await admin.from('roomings').upsert(
      { usuario_id: usuario.id, descripcion_busqueda: aleatorio(DESCRIPCIONES_BUSQUEDA), estado: 'activo' },
      { onConflict: 'usuario_id' }
    );
    if (error) {
      console.warn(`  falló para ${usuario.id}:`, error.message);
      continue;
    }
    creados += 1;
  }

  console.log(`Listo: ${creados}/${usuariosDemo.length} roomings creados.`);
}

main();
