/**
 * Siembra fotografías de demostración en las publicaciones que no tienen.
 *
 * POR QUÉ EXISTE
 * De las 106 publicaciones de demo, 103 no tenían ninguna foto. Un diseño donde
 * la fotografía manda —que es lo que se pidió— con 103 rectángulos vacíos se ve
 * peor que no tener diseño. Estas publicaciones son datos fabricados para la
 * exposición (PRODUCT.md lo autoriza explícitamente), así que sus fotos también
 * lo son.
 *
 * QUÉ HAY QUE PODER DECIR EN LA DEMO
 * "Las publicaciones y sus fotos son datos de demostración. Las imágenes vienen
 * de Unsplash bajo su licencia de uso libre, y la procedencia de cada una está
 * registrada en docs/fotos-de-demo.md. No son fotos de departamentos reales."
 *
 * Decirlo antes de que lo pregunten vale más que esperar a que lo pregunten.
 *
 *   node --env-file=.env scripts/sembrar-fotos.mjs [--forzar]
 *
 * Sin --forzar solo toca publicaciones SIN fotos, así que es seguro repetirlo.
 */
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Faltan EXPO_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const forzar = process.argv.includes('--forzar');
const BUCKET = 'fotos';

// Varias consultas para que la lista no se vea repetida al recorrerla. Son
// interiores de vivienda: nada de oficinas ni de exteriores de rascacielos.
const CONSULTAS = [
  'apartment interior',
  'small apartment living room',
  'student bedroom',
  'studio apartment',
  'simple kitchen apartment',
  'bedroom interior minimal',
  'shared house living room',
];

/**
 * Solo `images.unsplash.com`: los de `plus.unsplash.com` son del catálogo de
 * paga y su licencia NO es la misma. Mezclarlos sería justo el descuido que
 * hace indefendible el material.
 */
async function buscarFotos() {
  const vistas = new Map();
  for (const consulta of CONSULTAS) {
    const r = await fetch(
      `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(consulta)}&per_page=20`,
      { headers: { Accept: 'application/json' } }
    );
    if (!r.ok) {
      console.warn(`  consulta "${consulta}" devolvió ${r.status}, se salta`);
      continue;
    }
    const datos = await r.json();
    for (const foto of datos.results ?? []) {
      const crudo = foto?.urls?.raw ?? '';
      if (!crudo.startsWith('https://images.unsplash.com/')) continue; // descarta el catálogo de paga
      if (vistas.has(foto.id)) continue;
      vistas.set(foto.id, {
        id: foto.id,
        autor: foto?.user?.name ?? 'desconocido',
        usuarioAutor: foto?.user?.username ?? '',
        descripcion: foto?.alt_description ?? '',
        enlace: `https://unsplash.com/photos/${foto.id}`,
        // 1200px de ancho y calidad 70: es lo que la app pide al mostrar, y
        // subir el original de 5000px solo gastaría espacio que se paga.
        descarga: `${crudo.split('?')[0]}?w=1200&q=70&fm=jpg&fit=max`,
      });
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return [...vistas.values()];
}

async function descargar(foto) {
  const r = await fetch(foto.descarga);
  if (!r.ok) throw new Error(`descarga ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function main() {
  console.log('Buscando fotografías…');
  const catalogo = await buscarFotos();
  if (catalogo.length < 8) {
    console.error(`Solo encontré ${catalogo.length} fotos utilizables. Aborto para no repetir la misma ocho veces.`);
    process.exit(1);
  }
  console.log(`  ${catalogo.length} fotografías distintas.`);

  console.log('Descargando…');
  const binarios = [];
  for (const foto of catalogo) {
    try {
      binarios.push({ foto, datos: await descargar(foto) });
      process.stdout.write('.');
    } catch (e) {
      process.stdout.write('x');
    }
  }
  console.log(`\n  ${binarios.length} descargadas.`);

  const consulta = admin.from('publicaciones').select('id, usuario_id, fotos, titulo');
  const { data: publicaciones, error } = await consulta;
  if (error) throw error;

  const objetivo = forzar
    ? publicaciones
    : publicaciones.filter((p) => !p.fotos || p.fotos.length === 0);
  console.log(`${objetivo.length} publicaciones a sembrar (de ${publicaciones.length}).`);

  const procedencia = [];
  let hechas = 0;

  for (const [indicePub, p] of objetivo.entries()) {
    // Reparto determinista: la misma publicación recibe siempre las mismas
    // fotos, así que volver a correr el script no baraja la demo.
    const cuantas = 2 + (indicePub % 4); // entre 2 y 5, como el tope de la tabla
    const rutas = [];

    for (let i = 0; i < cuantas; i++) {
      const elegida = binarios[(indicePub * 3 + i) % binarios.length];
      // La ruta respeta la convención que esperan las policies de Storage
      // (0002 y 0019): publicaciones/<usuario>/<publicacion>/<indice>.jpg. Sin
      // eso, el dueño no podría reemplazar ni borrar su propia foto.
      const ruta = `publicaciones/${p.usuario_id}/${p.id}/${i}.jpg`;
      const { error: errorSubida } = await admin.storage
        .from(BUCKET)
        .upload(ruta, elegida.datos, { contentType: 'image/jpeg', upsert: true });
      if (errorSubida) {
        console.warn(`\n  subida falló (${p.id}/${i}): ${errorSubida.message}`);
        continue;
      }
      rutas.push(ruta);
      procedencia.push({ publicacion: p.id, indice: i, ...elegida.foto });
    }

    if (rutas.length === 0) continue;
    const { error: errorUpdate } = await admin.from('publicaciones').update({ fotos: rutas }).eq('id', p.id);
    if (errorUpdate) {
      console.warn(`\n  update falló (${p.id}): ${errorUpdate.message}`);
      continue;
    }
    hechas += 1;
    if (hechas % 10 === 0) process.stdout.write(`\n  ${hechas}/${objetivo.length}`);
    else process.stdout.write('.');
  }

  console.log(`\n${hechas} publicaciones con fotografía.`);

  // El registro de procedencia. Una imagen que no se sabe de dónde salió no se
  // puede defender, y en un proyecto sobre protección de datos eso importa más.
  const usadas = new Map();
  for (const r of procedencia) if (!usadas.has(r.id)) usadas.set(r.id, r);

  const lineas = [
    '# Fotografías de demostración',
    '',
    `Generado por \`scripts/sembrar-fotos.mjs\` el ${new Date().toISOString().slice(0, 10)}.`,
    '',
    '## Qué son y qué no son',
    '',
    'Las publicaciones de Cuervo Pass son **datos de demostración fabricados**,',
    'creados para poder exponer la app con un catálogo realista (PRODUCT.md lo',
    'autoriza expresamente). Sus fotografías también lo son: **no corresponden a',
    'los departamentos reales de esas direcciones**, y ninguna fue tomada por el',
    'equipo del proyecto.',
    '',
    'Provienen de [Unsplash](https://unsplash.com), bajo la',
    '[Licencia de Unsplash](https://unsplash.com/license), que permite su uso',
    'gratuito incluso comercial y sin exigir atribución. Se atribuye de todas',
    'formas: no reconocer de dónde viene el material es exactamente lo que este',
    'proyecto critica en otros lados.',
    '',
    '## Qué decir si lo preguntan en la exposición',
    '',
    '> Las publicaciones y sus fotos son datos de demostración. Las imágenes son',
    '> de Unsplash, con licencia de uso libre, y la procedencia de cada una está',
    '> en este archivo. No son fotos de departamentos reales.',
    '',
    `## Las ${usadas.size} imágenes utilizadas`,
    '',
    '| Autor | Descripción | Origen |',
    '|---|---|---|',
    ...[...usadas.values()].map(
      (f) => `| ${f.autor} | ${(f.descripcion || '—').replace(/\|/g, '/')} | [${f.id}](${f.enlace}) |`
    ),
    '',
  ];
  writeFileSync('docs/fotos-de-demo.md', lineas.join('\n'), 'utf-8');
  console.log('Procedencia registrada en docs/fotos-de-demo.md');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
