// Genera cuentas y publicaciones de prueba cerca de la UTVT, para poder ver
// sugerencias de verdad (no solo las que uno mismo publicó) en el emulador/
// dispositivo durante el desarrollo. NUNCA correr esto contra un proyecto que
// no sea de desarrollo/demo — usa el service_role key, que salta RLS.
//
// Uso:
//   1. Agrega SUPABASE_SERVICE_ROLE_KEY=<tu key> a .env (Project Settings > API
//      en supabase.com — la secreta, NUNCA la anon/public, y NUNCA con prefijo
//      EXPO_PUBLIC_ para que jamás termine en el bundle de la app).
//   2. node --env-file=.env scripts/seed-demo.mjs
//
// Todas las cuentas comparten la misma contraseña (PASSWORD_DEMO) para poder
// iniciar sesión en cualquiera de ellas y probar el chat con tu cuenta real.

import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Faltan EXPO_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env — revisa el paso 1 de arriba.');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const UTVT = { lat: 19.32568, lng: -99.458244 };
const PASSWORD_DEMO = 'Prueba123!';
const TOTAL_USUARIOS = 100;

const NOMBRES = [
  'María', 'José', 'Ana', 'Luis', 'Karla', 'Carlos', 'Fernanda', 'Diego', 'Paola', 'Jorge',
  'Valeria', 'Miguel', 'Daniela', 'Alejandro', 'Sofía', 'Ricardo', 'Andrea', 'Emilio', 'Ximena', 'Óscar',
];
const APELLIDOS = [
  'García', 'Hernández', 'López', 'Martínez', 'Pérez', 'González', 'Sánchez', 'Ramírez', 'Torres', 'Flores',
  'Rivera', 'Gómez', 'Díaz', 'Reyes', 'Morales', 'Cruz', 'Ortiz', 'Vargas', 'Castillo', 'Jiménez',
];

// Localidades/municipios reales alrededor de la UTVT (Santa María Atarasquillo,
// Lerma) — coordenadas geocodificadas de verdad (Mapbox), no inventadas, para
// que la distancia mostrada corresponda con la dirección de texto. Antes esta
// lista solo traía el texto y las coordenadas se ponían al azar cerca de la
// UTVT sin relación con la colonia elegida — daba distancias falsas
// (ej. "Toluca Centro", que está a ~21km, aparecía a 1-2km).
const LOCALIDADES = [
  { colonia: 'Santa María Atarasquillo', municipio: 'Lerma', estado: 'México', cp: '52044', lat: 19.325679, lng: -99.458243 },
  { colonia: 'San Pedro Tultepec', municipio: 'Lerma', estado: 'México', cp: '52072', lat: 19.266388, lng: -99.5088 },
  { colonia: 'Lerma de Villada Centro', municipio: 'Lerma', estado: 'México', cp: '52000', lat: 19.286393, lng: -99.510969 },
  { colonia: 'San Mateo Atenco Centro', municipio: 'San Mateo Atenco', estado: 'México', cp: '50100', lat: 19.26372, lng: -99.52952 },
  { colonia: 'San Francisco Putla', municipio: 'San Mateo Atenco', estado: 'México', cp: '50104', lat: 19.258, lng: -99.545 },
  { colonia: 'Metepec Centro', municipio: 'Metepec', estado: 'México', cp: '52140', lat: 19.252617, lng: -99.60566 },
  { colonia: 'San Miguel Totocuitlapilco', municipio: 'Metepec', estado: 'México', cp: '52166', lat: 19.235, lng: -99.59 },
  { colonia: 'Toluca Centro', municipio: 'Toluca', estado: 'México', cp: '50000', lat: 19.28808, lng: -99.65639 },
  { colonia: 'San Pablo Autopan', municipio: 'Toluca', estado: 'México', cp: '50170', lat: 19.267832, lng: -99.672313 },
  { colonia: 'Capultitlán', municipio: 'Toluca', estado: 'México', cp: '50296', lat: 19.245, lng: -99.68 },
];

const CALLES = [
  'Av. Solidaridad', 'Calle Reforma', 'Privada Hidalgo', 'Av. Independencia', 'Calle Morelos',
  'Callejón del Refugio', 'Av. Las Torres', 'Calle Juárez', 'Privada Guadalupe', 'Camino Real',
];

const DESCRIPCIONES = [
  'Depa amueblado, cerca de la universidad, pet friendly.',
  'Cuarto en casa compartida, ambiente tranquilo, no fumar dentro.',
  'Departamento con servicios incluidos, acepta mascotas pequeñas.',
  'Estudio independiente, entrada propia, buena iluminación.',
  'Casa con jardín, ideal para 2 personas, se permite fumar en el patio.',
  'Habitación en depa compartido con estudiantes, wifi incluido.',
  'Depa nuevo, un nivel, cocina equipada, sin mascotas por favor.',
  'Cuarto amplio, baño compartido, muy cerca del transporte público.',
];

function aleatorio(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

function enteroEntre(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sinAcentos(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Punto aleatorio a máximo ~600m de la colonia elegida — variación realista
// de calle sin alejarse de la ubicación real de esa colonia.
function coordenadaCercaDe(base) {
  const radioKm = Math.random() * 0.6;
  const angulo = Math.random() * 2 * Math.PI;
  const dLat = (radioKm / 111) * Math.cos(angulo);
  const dLng = (radioKm / (111 * Math.cos((base.lat * Math.PI) / 180))) * Math.sin(angulo);
  return { lat: base.lat + dLat, lng: base.lng + dLng };
}

async function crearPublicacion(usuarioId, indice) {
  const loc = aleatorio(LOCALIDADES);
  const coords = coordenadaCercaDe(loc);
  const direccion = `${aleatorio(CALLES)} ${enteroEntre(5, 450)}, ${loc.colonia}, ${loc.municipio}, ${loc.estado}, CP ${loc.cp}`;
  const { error } = await admin.from('publicaciones').insert({
    usuario_id: usuarioId,
    direccion,
    latitud: coords.lat,
    longitud: coords.lng,
    precio_renta: enteroEntre(1500, 6000),
    descripcion: aleatorio(DESCRIPCIONES),
    fotos: [],
    whatsapp: `722${enteroEntre(1000000, 9999999)}`,
    activa: true,
  });
  if (error) console.warn(`  [${indice}] insert publicacion falló:`, error.message);
}

async function main() {
  console.log(`Creando ${TOTAL_USUARIOS} usuarios de prueba cerca de la UTVT...`);
  let creados = 0;

  for (let i = 1; i <= TOTAL_USUARIOS; i++) {
    const nombre = aleatorio(NOMBRES);
    const apellidoP = aleatorio(APELLIDOS);
    const apellidoM = aleatorio(APELLIDOS);
    const email = `demo.roomie${String(i).padStart(3, '0')}@cuervopass-demo.test`;

    const { data: creado, error: errorAuth } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD_DEMO,
      email_confirm: true,
    });
    if (errorAuth || !creado?.user) {
      console.warn(`  [${i}] auth falló (${email}):`, errorAuth?.message);
      continue;
    }

    const presupuestoMin = enteroEntre(1500, 3000);
    const presupuestoMax = presupuestoMin + enteroEntre(800, 3000);

    const { error: errorUsuario } = await admin.from('usuarios').insert({
      id: creado.user.id,
      nombre_usuario: sinAcentos(`${nombre}${i}`).toLowerCase(),
      nombre_completo: `${nombre} ${apellidoP} ${apellidoM}`,
      biografia: 'Cuenta de prueba generada para probar sugerencias — Cuervo Pass.',
      presupuesto_min: presupuestoMin,
      presupuesto_max: presupuestoMax,
      mascotas: Math.random() < 0.4,
      fuma: Math.random() < 0.2,
      busca_roomie: Math.random() < 0.3,
      universidad: 'Universidad Tecnológica del Valle de Toluca (UTVT)',
      // Todos estudian en la misma UTVT — coordenadas fijas y reales, no un
      // punto al azar (antes cada cuenta demo tenía una "ubicación de
      // universidad" distinta e inventada, lo cual no tiene sentido).
      latitud_universidad: UTVT.lat,
      longitud_universidad: UTVT.lng,
      activo: true,
    });
    if (errorUsuario) {
      console.warn(`  [${i}] insert usuarios falló:`, errorUsuario.message);
      continue;
    }

    creados += 1;

    // ~72% publica 1 depa, ~13% publica 2, el resto no publica (para que
    // Roomings también tenga candidatos sin publicación, como en la vida real).
    const dado = Math.random();
    const numPublicaciones = dado < 0.13 ? 2 : dado < 0.85 ? 1 : 0;
    for (let p = 0; p < numPublicaciones; p++) {
      await crearPublicacion(creado.user.id, i);
    }

    if (i % 10 === 0) console.log(`  ${i}/${TOTAL_USUARIOS} listos...`);
    await new Promise((resolver) => setTimeout(resolver, 150));
  }

  console.log(`\nListo: ${creados}/${TOTAL_USUARIOS} cuentas creadas.`);
  console.log(`Contraseña de todas: ${PASSWORD_DEMO}`);
  console.log('Ejemplo de correo: demo.roomie001@cuervopass-demo.test (hasta 100)');
}

main();
