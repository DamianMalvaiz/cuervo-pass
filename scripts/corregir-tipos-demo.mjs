// Corrige el `tipo` de las publicaciones de demo, que la migración 0010 dejó
// todas en 'depa'.
//
// EL DIAGNÓSTICO, porque importa más que el arreglo: la 0010 introdujo la
// columna `tipo` sobre una tabla que ya tenía filas y las etiquetó en bloque
// con `update publicaciones set tipo = 'depa' where tipo is null`. Era lo único
// que podía hacer —no había de dónde sacar el tipo— pero dejó el catálogo
// diciendo «departamento» sobre publicaciones cuya propia descripción dice
// «Cuarto amplio, baño compartido» o «Casa con jardín».
//
// Nadie lo vio en un año porque el filtro de tipo corría en el cliente sobre un
// top-30 y, desde C.3, no corría en absoluto. B.3 lo movió a Postgres, y lo
// primero que hizo el filtro al funcionar fue enseñar que los datos estaban mal.
//
// NO ADIVINA. El catálogo de abajo sale de las PLANTILLAS de `seed-demo.mjs`,
// que ya traen su tipo escrito: cada descripción de producción corresponde 1:1
// con una plantilla de ese archivo, en una redacción anterior. Inferir el tipo
// leyendo palabras sueltas sería exactamente lo que el comentario de
// `seed-demo.mjs` condena —«el motor los adivinaba con includes('mascota'), que
// hace que "sin mascotas por favor" cuente como que sí las acepta»—, así que
// esto es una tabla de equivalencias revisada a mano, no un heurístico.
//
// Una descripción que no esté en la tabla se DEJA COMO ESTÁ y se reporta. Falla
// cerrado: es preferible no tocar una fila que etiquetarla por parecido.
//
// Los vectores no se invalidan: `textoParaEmbedding` usa título y descripción,
// no el tipo (ver backfill-embeddings.mjs:126). Nivel 2 sobrevive intacto.
//
// Uso:
//   node --env-file=.env --env-file=.env.server scripts/corregir-tipos-demo.mjs
//   node --env-file=.env --env-file=.env.server scripts/corregir-tipos-demo.mjs --aplicar
//
// Sin --aplicar solo enseña lo que haría.

import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !clave) {
  console.error('Faltan EXPO_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const admin = createClient(url, clave, { auth: { persistSession: false } });
const aplicar = process.argv.includes('--aplicar');

// descripción exacta → tipo, según la plantilla de seed-demo.mjs que la generó.
const CATALOGO = new Map([
  ['Depa nuevo, un nivel, cocina equipada, sin mascotas por favor.', 'depa'],
  ['Depa amueblado, cerca de la universidad, pet friendly.', 'depa'],
  ['Departamento con servicios incluidos, acepta mascotas pequeñas.', 'depa'],
  ['Estudio independiente, entrada propia, buena iluminación.', 'depa'],
  // «Cuarto en casa compartida» es `cuarto` y no `casa_compartida`: lo que se
  // renta es la habitación. No es una interpretación mía — es el tipo que le
  // pone su plantilla en seed-demo.mjs.
  ['Cuarto en casa compartida, ambiente tranquilo, no fumar dentro.', 'cuarto'],
  ['Cuarto amplio, baño compartido, muy cerca del transporte público.', 'cuarto'],
  ['Habitación en depa compartido con estudiantes, wifi incluido.', 'cuarto'],
  ['Casa con jardín, ideal para 2 personas, se permite fumar en el patio.', 'casa_compartida'],
  // Las diez de sembrar-casas-demo.mjs. Van aquí para que este archivo siga
  // siendo un mapa COMPLETO del catálogo de demo: si faltaran, correr el
  // corrector las reportaría como «sin tocar» y parecería que algo va mal.
  ['Casa completa para compartir entre tres, sala y cocina en común.', 'casa_compartida'],
  ['Casa de dos plantas, se comparte con dos estudiantes tranquilos.', 'casa_compartida'],
  ['Casa con patio y lavadero, buscamos una tercera persona.', 'casa_compartida'],
  ['Casa amueblada para compartir, cada quien su recámara.', 'casa_compartida'],
  ['Casa cerca del campus, se comparte entre estudiantes, no se fuma.', 'casa_compartida'],
  ['Casa con jardín y estacionamiento, ideal para compartir entre dos.', 'casa_compartida'],
  ['Casa tranquila para compartir, servicios incluidos en la renta.', 'casa_compartida'],
  ['Casa amplia con tres recámaras, se comparte entre estudiantes.', 'casa_compartida'],
  ['Casa con cocina equipada, se busca compañero de casa responsable.', 'casa_compartida'],
  ['Casa remodelada para compartir, mascotas pequeñas bienvenidas.', 'casa_compartida'],
]);

const { data, error } = await admin
  .from('publicaciones')
  .select('id, titulo, descripcion, tipo');
if (error) {
  console.error('No se pudo leer publicaciones:', error.message);
  process.exit(1);
}

const cambios = [];
const intactas = [];
for (const p of data) {
  const destino = CATALOGO.get((p.descripcion ?? '').trim());
  if (!destino) intactas.push(p);
  else if (destino !== p.tipo) cambios.push({ ...p, destino });
}

const contar = (filas, campo) =>
  filas.reduce((acc, f) => ({ ...acc, [f[campo]]: (acc[f[campo]] ?? 0) + 1 }), {});

console.log(`publicaciones leídas: ${data.length}`);
console.log('tipos ahora:      ', contar(data, 'tipo'));
console.log(`a corregir:        ${cambios.length}`);
console.log('destino:          ', contar(cambios, 'destino'));
if (intactas.length) {
  console.log(`\nsin tocar (${intactas.length}) — su descripción no está en el catálogo:`);
  for (const p of intactas) console.log(`  ${p.tipo.padEnd(16)} ${JSON.stringify(p.descripcion)}  «${p.titulo}»`);
}

if (!aplicar) {
  console.log('\nEnsayo. Vuelve a correrlo con --aplicar para escribir.');
  process.exit(0);
}

let ok = 0;
for (const c of cambios) {
  const { error: e } = await admin.from('publicaciones').update({ tipo: c.destino }).eq('id', c.id);
  if (e) console.warn(`  falló ${c.id}: ${e.message}`);
  else ok += 1;
}
console.log(`\nactualizadas: ${ok}/${cambios.length}`);

const { data: despues } = await admin.from('publicaciones').select('tipo');
console.log('tipos después:    ', contar(despues, 'tipo'));
