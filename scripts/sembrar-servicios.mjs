// Siembra el catálogo de Servicios de DEMOSTRACIÓN: categorías y veinticinco negocios INVENTADOS, con foto.
//
// Ningún negocio de aquí existe. Los nombres, direcciones, horarios y precios son ficticios y cada fila se escribe
// con `origen = 'sembrado'` y sin dueño (migración 0047), para que la app los rotule «Negocio de ejemplo». No hay
// reseñas ni calificaciones: serían datos fabricados.
//
// Las FOTOS sí son reales y de uso libre: salen de Wikimedia Commons, con licencia CC BY, CC BY-SA, CC0 o dominio
// público, y NO están relacionadas con los negocios inventados (son fotos genéricas de un puesto de tacos, una
// lavandería…). El script lee de la propia API de Commons el autor, la licencia y la página de cada archivo y escribe
// `docs/atribucion-fotos-servicios.md`; CC BY y CC BY-SA obligan a atribuir.
//
// Idempotente: un negocio sembrado que ya existe (mismo nombre) se omite. `--reiniciar` borra antes los sembrados.
//
// Uso:
//   node --env-file=.env --env-file=.env.server scripts/sembrar-servicios.mjs            # solo enseña
//   node --env-file=.env --env-file=.env.server scripts/sembrar-servicios.mjs --aplicar
//   node --env-file=.env --env-file=.env.server scripts/sembrar-servicios.mjs --aplicar --reiniciar

import { writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const aplicar = process.argv.includes('--aplicar');
const reiniciar = process.argv.includes('--reiniciar');

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !clave) {
  console.error('Faltan EXPO_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const supabase = createClient(url, clave, { auth: { persistSession: false } });

// Centro de referencia: la universidad de demo (la misma que usan los perfiles de prueba).
const BASE = { lat: 19.32568, lon: -99.458244 };
const punto = (dLat, dLon) => ({ latitud: +(BASE.lat + dLat).toFixed(6), longitud: +(BASE.lon + dLon).toFixed(6) });

const CATEGORIAS = [
  { id: 'comida', nombre: 'Comida', icono: 'restaurant-outline', orden: 1 },
  { id: 'cafes', nombre: 'Cafés', icono: 'cafe-outline', orden: 2 },
  { id: 'lavanderia', nombre: 'Lavandería', icono: 'shirt-outline', orden: 3 },
  { id: 'hogar', nombre: 'Hogar', icono: 'hammer-outline', orden: 4 },
  { id: 'papeleria', nombre: 'Papelería', icono: 'document-text-outline', orden: 5 },
  { id: 'belleza', nombre: 'Belleza', icono: 'cut-outline', orden: 6 },
  { id: 'tecnologia', nombre: 'Tecnología', icono: 'phone-portrait-outline', orden: 7 },
  { id: 'salud', nombre: 'Salud', icono: 'medkit-outline', orden: 8 },
];

// `foto`: título EXACTO del archivo en Commons.
const NEGOCIOS = [
  { categoria_id: 'comida', nombre: 'Tacos La Esquina', rango_precio: 1, destacado: true, horario: 'Lun a sáb · 6 pm a 11 pm',
    descripcion: 'Tacos al pastor y de suadero, con salsas de la casa.', direccion: 'Av. Las Torres 120, Lerma', ...punto(0.0021, 0.0014),
    foto: 'File:Puesto de tacos en la colonia del Valle.jpg',
    items: [['Taco al pastor', 18], ['Taco de suadero', 18], ['Orden de gringas', 55], ['Refresco', 20]] },
  { categoria_id: 'comida', nombre: 'Antojitos Doña Mari', rango_precio: 1, horario: 'Lun a sáb · 8 am a 6 pm',
    descripcion: 'Comida corrida y antojitos: sopes, quesadillas y guisados del día.', direccion: 'Calle Hidalgo 45, Lerma', ...punto(-0.0018, 0.0026),
    foto: 'File:Taco stand in Mazatlán.jpg',
    items: [['Comida corrida', 75], ['Sope', 25], ['Quesadilla', 30], ['Agua de sabor', 20]] },
  { categoria_id: 'comida', nombre: 'Pizzería Don Gino', rango_precio: 2, horario: 'Todos los días · 1 pm a 10 pm',
    descripcion: 'Pizzas al horno, por rebanada o completas.', direccion: 'Calle Morelos 210, Lerma', ...punto(0.0032, -0.0019),
    foto: 'File:Pizzeria in Venice.jpg',
    items: [['Rebanada de pizza', 35], ['Pizza mediana', 150], ['Pizza grande', 210]] },
  { categoria_id: 'comida', nombre: 'Tortas El Rincón', rango_precio: 1, horario: 'Lun a vie · 9 am a 5 pm',
    descripcion: 'Tortas calientes y frías, con pan recién horneado.', direccion: 'Av. Las Torres 98, Lerma', ...punto(0.0009, 0.0031),
    foto: 'File:Mexican torta sandwich.jpg',
    items: [['Torta de jamón', 45], ['Torta de milanesa', 60], ['Torta cubana', 75]] },
  { categoria_id: 'cafes', nombre: 'Café La Parada', rango_precio: 2, destacado: true, horario: 'Lun a sáb · 8 am a 9 pm',
    descripcion: 'Café de olla y de especialidad, con lugar para estudiar y conexión wifi.', direccion: 'Av. Las Torres 408, Lerma', ...punto(0.0014, -0.0008),
    foto: 'File:2019 02 Awesome Coffee Shop in Korat.jpg',
    items: [['Café americano', 35], ['Capuchino', 48], ['Latte frío', 52], ['Pan dulce del día', 18]] },
  { categoria_id: 'cafes', nombre: 'Panadería La Espiga', rango_precio: 1, horario: 'Todos los días · 7 am a 8 pm',
    descripcion: 'Pan dulce y de sal horneado cada mañana.', direccion: 'Calle Juárez 33, Lerma', ...punto(-0.0027, -0.0011),
    foto: 'File:Pan dulce en panadería de la Ciudad de México.jpg',
    items: [['Concha', 12], ['Cuernito', 15], ['Bolillo', 4]] },
  { categoria_id: 'lavanderia', nombre: 'Lavandería Burbuja', rango_precio: 1, destacado: true, horario: 'Lun a sáb · 8 am a 8 pm',
    descripcion: 'Autoservicio y por encargo. Lavado, secado y planchado.', direccion: 'Calle Allende 77, Lerma', ...punto(0.0036, 0.0021),
    foto: 'File:Laundromat in korea.jpg',
    items: [['Lavado por kilo', 25], ['Autoservicio (lavadora)', 40], ['Secado', 30]] },
  { categoria_id: 'lavanderia', nombre: 'Lavandería Express Campus', rango_precio: 1, horario: 'Lun a vie · 9 am a 7 pm',
    descripcion: 'Entrega en 24 horas, con servicio a domicilio en la zona universitaria.', direccion: 'Av. Las Torres 15, Lerma', ...punto(-0.0006, 0.0042),
    foto: 'File:Laundromat Washing Machines & Laundry Equipment.jpg',
    items: [['Lavado por kilo', 28], ['Edredón', 120]] },
  { categoria_id: 'hogar', nombre: 'Plomería Rápida Lerma', rango_precio: 2, horario: 'Lun a sáb · 8 am a 7 pm',
    descripcion: 'Fugas, drenajes y cambio de llaves. Presupuesto sin costo.', direccion: 'Calle Reforma 61, Lerma', ...punto(-0.0034, 0.0017),
    foto: 'File:Trenchless Sewer Repair.jpg',
    items: [['Revisión', null], ['Cambio de llave', 250]] },
  { categoria_id: 'hogar', nombre: 'Electricista El Chispa', rango_precio: 2, horario: 'Lun a sáb · 9 am a 6 pm',
    descripcion: 'Instalaciones, contactos y apagadores. Atención a cuartos y departamentos.', direccion: 'Calle Hidalgo 102, Lerma', ...punto(0.0019, -0.0036),
    foto: 'File:Electrician repairing a fun.jpg',
    items: [['Revisión', null], ['Cambio de contacto', 150]] },
  { categoria_id: 'hogar', nombre: 'Cerrajería Segura', rango_precio: 2, horario: 'Todos los días · 24 horas',
    descripcion: 'Apertura de puertas, copia de llaves y cambio de chapas.', direccion: 'Av. Las Torres 250, Lerma', ...punto(-0.0012, -0.0033),
    foto: 'File:Locksmith shop sign - Pristina.JPG',
    items: [['Copia de llave', 25], ['Apertura de puerta', 300]] },
  { categoria_id: 'papeleria', nombre: 'Papelería Útiles del Campus', rango_precio: 1, horario: 'Lun a sáb · 8 am a 8 pm',
    descripcion: 'Papelería, material para proyectos y engargolado.', direccion: 'Calle Morelos 18, Lerma', ...punto(0.0027, 0.0036),
    foto: 'File:Stationery Wholesale Shop notebooks.jpg',
    items: [['Cuaderno profesional', 38], ['Engargolado', 35], ['Plumas (3 piezas)', 20]] },
  { categoria_id: 'papeleria', nombre: 'Copias y Más', rango_precio: 1, horario: 'Lun a vie · 8 am a 7 pm',
    descripcion: 'Copias, impresiones y escaneo a buen precio.', direccion: 'Av. Las Torres 5, Lerma', ...punto(-0.0021, 0.0009),
    foto: 'File:A PHOTOCOPY SHOP.jpg',
    items: [['Copia B/N', 0.8], ['Impresión a color', 5], ['Escaneo', 3]] },
  { categoria_id: 'belleza', nombre: 'Barbería El Cuervo', rango_precio: 1, horario: 'Mar a dom · 10 am a 8 pm',
    descripcion: 'Cortes clásicos, degradados y arreglo de barba.', direccion: 'Calle Juárez 90, Lerma', ...punto(0.0006, -0.0044),
    foto: 'File:Barber shop, Quebec city, Canada.jpg',
    items: [['Corte', 90], ['Barba', 60], ['Corte y barba', 130]] },
  { categoria_id: 'belleza', nombre: 'Estética Brillo', rango_precio: 2, horario: 'Lun a sáb · 10 am a 7 pm',
    descripcion: 'Corte, tinte y peinado. Con cita o sin ella.', direccion: 'Calle Allende 12, Lerma', ...punto(-0.0039, -0.0006),
    foto: 'File:Hair Today Beauty Today salon.jpg',
    items: [['Corte', 120], ['Tinte', 450], ['Peinado', 200]] },
  { categoria_id: 'comida', nombre: 'Hamburguesas Black Crow', rango_precio: 2, horario: 'Todos los días · 2 pm a 11 pm',
    descripcion: 'Hamburguesas de res con papas, hechas al momento.', direccion: 'Av. Las Torres 330, Lerma', ...punto(0.0041, -0.0027),
    foto: 'File:Lunch in Starfish Fast Food Restaurant.jpg',
    items: [['Hamburguesa sencilla', 65], ['Hamburguesa doble', 95], ['Papas a la francesa', 35]] },
  { categoria_id: 'comida', nombre: 'Tamales Doña Chela', rango_precio: 1, horario: 'Lun a sáb · 7 am a 12 pm',
    descripcion: 'Tamales de rajas, de mole y dulces, con atole para el desayuno.', direccion: 'Calle Hidalgo 12, Lerma', ...punto(-0.0042, 0.0033),
    foto: 'File:Tamales Mexicanos sweet corn tamales 03.jpg',
    items: [['Tamal', 18], ['Atole', 20], ['Combo (2 tamales y atole)', 50]] },
  { categoria_id: 'comida', nombre: 'Jugos y Licuados Vita', rango_precio: 1, horario: 'Lun a sáb · 8 am a 6 pm',
    descripcion: 'Jugos naturales, licuados y ensaladas de fruta.', direccion: 'Calle Allende 140, Lerma', ...punto(0.0011, 0.0051),
    foto: 'File:DFC 4435 Freshly squeezed and ready to go rows of vibrant orange juice cups with matching fruit garnishes and colorful straws at a lively market stall.jpg',
    items: [['Jugo de naranja', 30], ['Licuado de plátano', 40], ['Ensalada de fruta', 45]] },
  { categoria_id: 'cafes', nombre: 'Nevería Polar', rango_precio: 1, horario: 'Todos los días · 12 pm a 9 pm',
    descripcion: 'Helados artesanales de sabores de temporada.', direccion: 'Calle Morelos 75, Lerma', ...punto(-0.0016, 0.0047),
    foto: 'File:Venice - Ice cream parlor - 4017.jpg',
    items: [['Helado de una bola', 25], ['Helado de dos bolas', 40], ['Paleta', 20]] },
  { categoria_id: 'tecnologia', nombre: 'TecnoFix Celulares', rango_precio: 2, horario: 'Lun a sáb · 10 am a 7 pm',
    descripcion: 'Cambio de pantalla y batería, y accesorios.', direccion: 'Av. Las Torres 190, Lerma', ...punto(0.0023, -0.0052),
    foto: 'File:Mobile-phone-repair-Gatewalk.jpg',
    items: [['Revisión', null], ['Cambio de batería', 280], ['Mica protectora', 60]] },
  { categoria_id: 'tecnologia', nombre: 'Cyber Net Campus', rango_precio: 1, horario: 'Lun a sáb · 9 am a 9 pm',
    descripcion: 'Computadoras por hora, impresiones y escaneo.', direccion: 'Calle Juárez 8, Lerma', ...punto(-0.0031, -0.0045),
    foto: 'File:Internet Cafe, Apizaco, Mexico.JPG',
    items: [['Computadora por hora', 12], ['Impresión B/N', 2], ['Escaneo', 3]] },
  { categoria_id: 'hogar', nombre: 'Taller de Bicicletas La Rodada', rango_precio: 1, horario: 'Lun a sáb · 9 am a 7 pm',
    descripcion: 'Ajuste de frenos y cambios, parches y refacciones.', direccion: 'Calle Reforma 140, Lerma', ...punto(0.0048, 0.0008),
    foto: 'File:Bike workshop - bicycle repair shop.jpg',
    items: [['Ajuste general', 120], ['Parche de cámara', 40], ['Cambio de cámara', 90]] },
  { categoria_id: 'salud', nombre: 'Farmacia San Rafael', rango_precio: 1, horario: 'Todos los días · 8 am a 10 pm',
    descripcion: 'Medicamentos, artículos de higiene y servicio de inyecciones.', direccion: 'Av. Las Torres 60, Lerma', ...punto(-0.0009, -0.0021),
    foto: 'File:Pharmacy and convenience store - geograph.org.uk - 7916164.jpg',
    items: [['Aplicación de inyección', 30], ['Toma de presión', null]] },
  { categoria_id: 'salud', nombre: 'Consultorio Dental Sonrisa', rango_precio: 2, horario: 'Lun a vie · 10 am a 7 pm · con cita',
    descripcion: 'Limpieza, resinas y revisión general. Descuento a estudiantes.', direccion: 'Calle Allende 33, Lerma', ...punto(0.0035, 0.0042),
    foto: 'File:Dental chair in a dentist clinic.jpg',
    items: [['Consulta', 200], ['Limpieza', 450]] },
  { categoria_id: 'belleza', nombre: 'Uñas Glam', rango_precio: 2, horario: 'Mar a sáb · 11 am a 7 pm',
    descripcion: 'Manicure, pedicure y uñas de gel.', direccion: 'Calle Hidalgo 77, Lerma', ...punto(-0.0045, 0.0012),
    foto: 'File:DZ6 0587 A nail technician carefully files a customers nails at a salon surrounded by color samples and manicure tools.jpg',
    items: [['Manicure', 150], ['Uñas de gel', 320]] },
];

const quitarHtml = (s) => (s ?? '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const UA = { 'User-Agent': 'Cuervo360-demo/1.0 (proyecto escolar; al222211405@gmail.com)' };

async function fotoDeCommons(titulo) {
  const api = new URL('https://commons.wikimedia.org/w/api.php');
  for (const [k, v] of Object.entries({
    action: 'query', titles: titulo, prop: 'imageinfo', iiprop: 'url|extmetadata|mime', iiurlwidth: '1024', format: 'json',
  })) api.searchParams.set(k, v);
  const r = await fetch(api, { headers: UA });
  if (!r.ok) throw new Error(`Commons respondió ${r.status} para ${titulo}`);
  const info = Object.values((await r.json()).query.pages)[0]?.imageinfo?.[0];
  if (!info) throw new Error(`No existe el archivo en Commons: ${titulo}`);
  const licencia = info.extmetadata?.LicenseShortName?.value ?? '';
  if (!/CC BY|CC0|Public domain|PD/i.test(licencia)) throw new Error(`Licencia no admitida (${licencia}) en ${titulo}`);
  if (info.mime !== 'image/jpeg') throw new Error(`No es JPEG: ${titulo}`);
  const img = await fetch(info.thumburl, { headers: UA });
  if (!img.ok) throw new Error(`No se pudo descargar ${titulo} (${img.status})`);
  return {
    bytes: Buffer.from(await img.arrayBuffer()),
    titulo, licencia,
    autor: quitarHtml(info.extmetadata?.Artist?.value) || 'Autor no indicado',
    pagina: info.descriptionurl,
  };
}

console.log(aplicar ? 'MODO: aplicar' : 'MODO: solo enseñar (usa --aplicar para escribir)');

if (aplicar && reiniciar) {
  const { error } = await supabase.from('negocios').delete().eq('origen', 'sembrado');
  if (error) throw error;
  console.log('Negocios sembrados anteriores borrados.');
}

if (aplicar) {
  const { error } = await supabase.from('categorias_servicio').upsert(CATEGORIAS, { onConflict: 'id' });
  if (error) throw error;
}
console.log(`${CATEGORIAS.length} categorías.`);

const { data: existentes, error: errExist } = await supabase.from('negocios').select('nombre').eq('origen', 'sembrado');
if (errExist) throw errExist;
const ya = new Set((existentes ?? []).map((n) => n.nombre));

const atribuciones = [];
let creados = 0;
for (const n of NEGOCIOS) {
  const { foto, items, ...fila } = n;
  const f = await fotoDeCommons(foto);
  atribuciones.push({ negocio: n.nombre, ...f, bytes: undefined });
  if (ya.has(n.nombre)) { console.log(`= ${n.nombre} (ya existe)`); continue; }
  console.log(`+ ${n.nombre} · ${f.licencia} · ${f.autor.slice(0, 40)}`);
  if (!aplicar) continue;

  const { data: creado, error } = await supabase
    .from('negocios').insert({ ...fila, origen: 'sembrado', usuario_id: null }).select('id').single();
  if (error) throw error;
  const ruta = `negocios/${creado.id}/0.jpg`;
  const { error: errSubida } = await supabase.storage.from('fotos').upload(ruta, f.bytes, { contentType: 'image/jpeg', upsert: true });
  if (errSubida) throw errSubida;
  const { error: errFoto } = await supabase.from('negocios').update({ fotos: [ruta] }).eq('id', creado.id);
  if (errFoto) throw errFoto;
  const filas = items.map(([nombre, precio], i) => ({ negocio_id: creado.id, nombre, precio, orden: i }));
  const { error: errItems } = await supabase.from('negocio_items').insert(filas);
  if (errItems) throw errItems;
  creados++;
}

if (aplicar) {
  const md = [
    '# Atribución de las fotos de Servicios',
    '',
    'Los negocios de la sección Servicios que trae la demostración son **inventados** (`origen = sembrado`). Las fotos son',
    'imágenes reales de uso libre de Wikimedia Commons y **no corresponden** a esos negocios: son fotos genéricas del tipo de',
    'lugar. Este archivo lo genera `scripts/sembrar-servicios.mjs` con los datos que da la propia API de Commons.',
    '',
    '| Negocio de ejemplo | Archivo | Autor | Licencia |',
    '|---|---|---|---|',
    ...atribuciones.map((a) => `| ${a.negocio} | [${a.titulo.replace('File:', '')}](${a.pagina}) | ${a.autor.replace(/\|/g, '/')} | ${a.licencia} |`),
    '',
  ].join('\n');
  writeFileSync('docs/atribucion-fotos-servicios.md', md);
  console.log('Escrito docs/atribucion-fotos-servicios.md');
}
console.log(`${aplicar ? 'Creados' : 'Se crearían'}: ${aplicar ? creados : NEGOCIOS.length - ya.size} negocios.`);
