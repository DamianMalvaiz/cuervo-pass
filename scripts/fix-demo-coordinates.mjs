// Corrige datos de prueba ya insertados por seed-demo.mjs antes de que se
// arreglara el bug de coordenadas: las publicaciones tenían un punto al azar
// cerca de la UTVT sin relación con la colonia real de su dirección (ej.
// "Toluca Centro", que está a ~21km, aparecía a 1-2km), y cada cuenta demo
// tenía una "ubicación de universidad" distinta e inventada en vez de la UTVT
// real y fija. No crea cuentas nuevas — solo actualiza latitud/longitud.
//
// Uso: node --env-file=.env scripts/fix-demo-coordinates.mjs

import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Faltan EXPO_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const UTVT = { lat: 19.32568, lng: -99.458244 };
const BIOGRAFIA_DEMO = 'Cuenta de prueba generada para probar sugerencias — Cuervo Pass.';

// Mismas coordenadas geocodificadas (Mapbox) que seed-demo.mjs — deben quedar
// idénticas entre los dos scripts, o las nuevas cuentas y las corregidas
// terminarían con distancias distintas para la misma colonia.
const LOCALIDADES = [
  { colonia: 'Santa María Atarasquillo', lat: 19.325679, lng: -99.458243 },
  { colonia: 'San Pedro Tultepec', lat: 19.266388, lng: -99.5088 },
  { colonia: 'Lerma de Villada Centro', lat: 19.286393, lng: -99.510969 },
  { colonia: 'San Mateo Atenco Centro', lat: 19.26372, lng: -99.52952 },
  { colonia: 'San Francisco Putla', lat: 19.258, lng: -99.545 },
  { colonia: 'Metepec Centro', lat: 19.252617, lng: -99.60566 },
  { colonia: 'San Miguel Totocuitlapilco', lat: 19.235, lng: -99.59 },
  { colonia: 'Toluca Centro', lat: 19.28808, lng: -99.65639 },
  { colonia: 'San Pablo Autopan', lat: 19.267832, lng: -99.672313 },
  { colonia: 'Capultitlán', lat: 19.245, lng: -99.68 },
];

function coordenadaCercaDe(base) {
  const radioKm = Math.random() * 0.6;
  const angulo = Math.random() * 2 * Math.PI;
  const dLat = (radioKm / 111) * Math.cos(angulo);
  const dLng = (radioKm / (111 * Math.cos((base.lat * Math.PI) / 180))) * Math.sin(angulo);
  return { lat: base.lat + dLat, lng: base.lng + dLng };
}

async function main() {
  // 1) Todas las cuentas demo estudian en la misma UTVT — coordenada fija.
  const { data: usuariosActualizados, error: errorUsuarios } = await admin
    .from('usuarios')
    .update({ latitud_universidad: UTVT.lat, longitud_universidad: UTVT.lng })
    .eq('biografia', BIOGRAFIA_DEMO)
    .select('id');
  if (errorUsuarios) throw errorUsuarios;
  console.log(`usuarios corregidos: ${usuariosActualizados.length}`);

  // 2) Publicaciones: solo las de cuentas demo (nunca por whatsapp — el 722 es
  // el lada real de Toluca, una publicación tuya de verdad también podría
  // tenerlo, así que se identifica por dueño, no por prefijo de teléfono).
  const idsUsuariosDemo = usuariosActualizados.map((u) => u.id);
  const { data: publicaciones, error: errorPublicaciones } = await admin
    .from('publicaciones')
    .select('id, direccion')
    .in('usuario_id', idsUsuariosDemo);
  if (errorPublicaciones) throw errorPublicaciones;

  let corregidas = 0;
  let sinColoniaReconocida = 0;
  for (const p of publicaciones) {
    const loc = LOCALIDADES.find((l) => p.direccion.includes(l.colonia));
    if (!loc) {
      sinColoniaReconocida += 1;
      continue;
    }
    const coords = coordenadaCercaDe(loc);
    const { error } = await admin
      .from('publicaciones')
      .update({ latitud: coords.lat, longitud: coords.lng })
      .eq('id', p.id);
    if (error) console.warn(`  falló ${p.id}:`, error.message);
    else corregidas += 1;
  }

  console.log(`publicaciones corregidas: ${corregidas}`);
  if (sinColoniaReconocida > 0) {
    console.log(`publicaciones sin colonia reconocida (no tocadas, probablemente tuyas): ${sinColoniaReconocida}`);
  }
  console.log('Listo.');
}

main();
