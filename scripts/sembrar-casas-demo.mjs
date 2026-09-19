// Siembra publicaciones de tipo `casa_compartida` cerca de la UTVT.
//
// POR QUÉ EXISTE
// Tras corregir el tipo de las 104 publicaciones que la migración 0010 había
// etiquetado todas como 'depa' (ver corregir-tipos-demo.mjs), el catálogo quedó
// con solo 7 casas compartidas — y cuatro de ellas a 17-25 km de la UTVT, o sea
// fuera del filtro duro de cualquier perfil razonable. Medido con un perfil de
// 15 km y $5 000: el chip «Casa compartida» devolvía UNA fila.
//
// El filtro hace lo correcto; lo que falta son datos. Estas publicaciones son
// fabricadas a propósito para la exposición, igual que las otras 104, y
// PRODUCT.md lo autoriza explícitamente.
//
// LA CUENTA DUEÑA SE ELIGE POR DOMINIO, NO POR DESCARTE. Solo se usan cuentas
// cuyo correo termina en @cuervopass-demo.test. Elegirlas por «las que no tienen
// publicación» habría incluido la cuenta real del autor, que justo no tiene
// ninguna: un descarte no distingue «cuenta de prueba» de «cuenta que todavía no
// publica».
//
// Coordenadas REALES de colonias reales, tomadas de seed-demo.mjs, con una
// variación de calle de ±600 m. No son puntos al azar cerca de la UTVT: ese
// error ya se cometió una vez y daba distancias que no correspondían con la
// dirección escrita.
//
// Lo que este script NO hace, a propósito:
//   - fotos    → `node ... scripts/sembrar-fotos.mjs` (solo toca las que no tienen)
//   - vectores → `node ... --env-file=ai-service/.env scripts/backfill-embeddings.mjs`
//     El tercer --env-file no es opcional: `AI_SHARED_TOKEN` vive solo ahí, y
//     sin él el servicio responde 401.
//
// Uso:
//   node --env-file=.env --env-file=.env.server scripts/sembrar-casas-demo.mjs
//   node --env-file=.env --env-file=.env.server scripts/sembrar-casas-demo.mjs --aplicar

import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !clave) {
  console.error('Faltan EXPO_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const admin = createClient(url, clave, { auth: { persistSession: false } });
const aplicar = process.argv.includes('--aplicar');

const DOMINIO_DEMO = '@cuervopass-demo.test';
const UTVT = { lat: 19.32568, lng: -99.458244 };

// Las cinco localidades de seed-demo.mjs que caen dentro de ~13 km de la UTVT.
// Las otras cinco (Metepec, Toluca, Capultitlán) están a 17-25 km y son
// justamente las que el filtro duro descarta.
const LOCALIDADES = [
  { colonia: 'Santa María Atarasquillo', municipio: 'Lerma', estado: 'México', cp: '52044', lat: 19.325679, lng: -99.458243 },
  { colonia: 'Lerma de Villada Centro', municipio: 'Lerma', estado: 'México', cp: '52000', lat: 19.286393, lng: -99.510969 },
  { colonia: 'San Pedro Tultepec', municipio: 'Lerma', estado: 'México', cp: '52072', lat: 19.266388, lng: -99.5088 },
  { colonia: 'San Mateo Atenco Centro', municipio: 'San Mateo Atenco', estado: 'México', cp: '50100', lat: 19.26372, lng: -99.52952 },
  { colonia: 'San Francisco Putla', municipio: 'San Mateo Atenco', estado: 'México', cp: '50104', lat: 19.258, lng: -99.545 },
];

const CALLES = [
  'Av. Solidaridad', 'Calle Reforma', 'Privada Hidalgo', 'Av. Independencia', 'Calle Morelos',
  'Callejón del Refugio', 'Av. Las Torres', 'Calle Juárez', 'Privada Guadalupe', 'Camino Real',
];

// Diez descripciones DISTINTAS y no una repetida diez veces: el vector se
// construye de título y descripción, así que diez copias darían diez afinidades
// idénticas y el ranking de ese chip no ordenaría nada.
//
// Estas mismas cadenas están en el CATALOGO de corregir-tipos-demo.mjs, para
// que ese script siga siendo un mapa completo del catálogo de demo.
const CASAS = [
  { desc: 'Casa completa para compartir entre tres, sala y cocina en común.', rec: 3, mascotas: false, amueblado: false, servicios: false },
  { desc: 'Casa de dos plantas, se comparte con dos estudiantes tranquilos.', rec: 3, mascotas: false, amueblado: true, servicios: false },
  { desc: 'Casa con patio y lavadero, buscamos una tercera persona.', rec: 3, mascotas: true, amueblado: false, servicios: false },
  { desc: 'Casa amueblada para compartir, cada quien su recámara.', rec: 2, mascotas: false, amueblado: true, servicios: true },
  { desc: 'Casa cerca del campus, se comparte entre estudiantes, no se fuma.', rec: 2, mascotas: false, amueblado: true, servicios: false },
  { desc: 'Casa con jardín y estacionamiento, ideal para compartir entre dos.', rec: 2, mascotas: true, amueblado: false, servicios: false },
  { desc: 'Casa tranquila para compartir, servicios incluidos en la renta.', rec: 3, mascotas: false, amueblado: false, servicios: true },
  { desc: 'Casa amplia con tres recámaras, se comparte entre estudiantes.', rec: 3, mascotas: false, amueblado: false, servicios: false },
  { desc: 'Casa con cocina equipada, se busca compañero de casa responsable.', rec: 2, mascotas: false, amueblado: true, servicios: false },
  { desc: 'Casa remodelada para compartir, mascotas pequeñas bienvenidas.', rec: 2, mascotas: true, amueblado: true, servicios: true },
];

// Precios dentro del presupuesto típico de las cuentas demo (1 500 - 6 000), y
// por debajo de $5 000 para que sobrevivan al tope de un perfil corriente: una
// casa de $5 800 es realista y también es invisible, que era el problema.
const PRECIOS = [2200, 2600, 2900, 3100, 3400, 3600, 3900, 4200, 4500, 4800];

const enteroEntre = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const aleatorio = (l) => l[Math.floor(Math.random() * l.length)];

function coordenadaCercaDe(base) {
  const radioKm = Math.random() * 0.6;
  const angulo = Math.random() * 2 * Math.PI;
  return {
    lat: base.lat + (radioKm / 111) * Math.cos(angulo),
    lng: base.lng + (radioKm / (111 * Math.cos((base.lat * Math.PI) / 180))) * Math.sin(angulo),
  };
}

const km = (a, b, c, d) => {
  const R = 6371, r = (x) => (x * Math.PI) / 180;
  const h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

// ── cuentas demo, por dominio ──────────────────────────────────────────────
const correos = new Map();
for (let pagina = 1; ; pagina++) {
  const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 });
  if (error) { console.error('listUsers falló:', error.message); process.exit(1); }
  for (const u of data.users) correos.set(u.id, u.email ?? '');
  if (data.users.length < 200) break;
}
const demo = [...correos].filter(([, correo]) => correo.endsWith(DOMINIO_DEMO)).map(([id]) => id);
if (demo.length < CASAS.length) {
  console.error(`Solo hay ${demo.length} cuentas ${DOMINIO_DEMO} y hacen falta ${CASAS.length}.`);
  process.exit(1);
}

// Se reparten entre las que MENOS publicaciones tienen, para no amontonar diez
// casas en una cuenta que ya publicaba dos cosas.
const { data: pubs } = await admin.from('publicaciones').select('usuario_id');
const cuantas = new Map(demo.map((id) => [id, 0]));
for (const p of pubs) if (cuantas.has(p.usuario_id)) cuantas.set(p.usuario_id, cuantas.get(p.usuario_id) + 1);
const duenos = [...cuantas].sort((a, b) => a[1] - b[1]).slice(0, CASAS.length).map(([id]) => id);

const filas = CASAS.map((casa, i) => {
  const loc = LOCALIDADES[i % LOCALIDADES.length];
  const coords = coordenadaCercaDe(loc);
  return {
    usuario_id: duenos[i],
    // Mismo patrón de título que las otras 104, para que el catálogo no se lea
    // en dos niveles. Un título distinto delataría cuáles son las nuevas.
    titulo: `Publicación en ${aleatorio(CALLES)} ${enteroEntre(5, 450)}`,
    tipo: 'casa_compartida',
    direccion: `${aleatorio(CALLES)} ${enteroEntre(5, 450)}, ${loc.colonia}, ${loc.municipio}, ${loc.estado}, CP ${loc.cp}`,
    latitud: coords.lat,
    longitud: coords.lng,
    geocodificado_por: 'catalogo-demo-verificado-a-mano',
    pendiente_geocoding: false,
    precio_renta: PRECIOS[i],
    descripcion: casa.desc,
    permite_mascotas: casa.mascotas,
    amueblado: casa.amueblado,
    servicios_incluidos: casa.servicios,
    recamaras: casa.rec,
    fotos: [],
    whatsapp: `722${enteroEntre(1000000, 9999999)}`,
    activa: true,
  };
});

console.log(`cuentas ${DOMINIO_DEMO}: ${demo.length}`);
console.log(`casas a crear: ${filas.length}\n`);
for (const f of filas)
  console.log(`  $${String(f.precio_renta).padStart(4)}  ${km(UTVT.lat, UTVT.lng, f.latitud, f.longitud).toFixed(1).padStart(4)} km  ${f.rec ?? ''}${f.descripcion}`);

if (!aplicar) {
  console.log('\nEnsayo. Vuelve a correrlo con --aplicar para escribir.');
  process.exit(0);
}

const { data: creadas, error } = await admin.from('publicaciones').insert(filas).select('id');
if (error) { console.error('\ninsert falló:', error.message); process.exit(1); }
console.log(`\ncreadas: ${creadas.length}`);

const { data: todas } = await admin.from('publicaciones').select('tipo');
const porTipo = todas.reduce((a, p) => ({ ...a, [p.tipo]: (a[p.tipo] ?? 0) + 1 }), {});
console.log('catálogo ahora:', porTipo);
console.log('\nFaltan dos pasos, y ninguno lo hace este script:');
console.log('  node --env-file=.env --env-file=.env.server scripts/sembrar-fotos.mjs');
console.log('  node --env-file=.env --env-file=.env.server --env-file=ai-service/.env scripts/backfill-embeddings.mjs');
