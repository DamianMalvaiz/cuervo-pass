// Evaluación del ranking de Servicios (migración 0055): ¿qué tan sensible es el orden a los pesos que elegimos?
//
// Solo LEE `negocios_publicos` (con la llave de servicio) y recalcula el puntaje aquí, con la MISMA fórmula que
// `negocios_ordenados`. No escribe nada. Si la fórmula del SQL cambia, esta copia hay que cambiarla con ella.
//
// Uso:
//   node --env-file=.env --env-file=.env.server scripts/evaluar-ranking.mjs [--lat <n> --lon <n>] [--cat <categoria>]
// Sin --lat/--lon toma la ubicación de universidad de la primera cuenta que la tenga; sin ella, la cercanía es neutra.

import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !clave) { console.error('Faltan EXPO_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.'); process.exit(1); }
const supabase = createClient(url, clave, { auth: { persistSession: false } });

const args = process.argv.slice(2);
const valor = (b) => { const i = args.indexOf(b); return i === -1 ? null : args[i + 1]; };

const km = (la1, lo1, la2, lo2) => {
  const r = Math.PI / 180, dLa = (la2 - la1) * r, dLo = (lo2 - lo1) * r;
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLo / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
};

const BASE = { wCerca: 0.45, wCalidad: 0.45, wNuevo: 0.10, escalaKm: 1.5, prior: 3.5, pesoPrior: 3 };

function puntaje(n, yo, p) {
  const d = yo && n.latitud != null && n.longitud != null ? km(yo.lat, yo.lon, Number(n.latitud), Number(n.longitud)) : null;
  const cerca = d == null ? 0.5 : 1 / (1 + d / p.escalaKm);
  const v = n.num_resenas ?? 0, R = n.calificacion ?? 0;
  const calidad = ((v * R + p.pesoPrior * p.prior) / (v + p.pesoPrior) - 1) / 4;
  const dias = (Date.now() - new Date(n.creado_en).getTime()) / 86400000;
  const nuevo = Math.max(0, 1 - dias / 30);
  return { total: p.wCerca * cerca + p.wCalidad * calidad + p.wNuevo * nuevo, d };
}

const ordenar = (negocios, yo, p) =>
  negocios.map((n) => ({ n, ...puntaje(n, yo, p) }))
    .sort((a, b) => (b.n.destacado - a.n.destacado) || (b.total - a.total) || a.n.nombre.localeCompare(b.n.nombre, 'es'));

let consulta = supabase.from('negocios_publicos').select('*');
if (valor('--cat')) consulta = consulta.eq('categoria_id', valor('--cat'));
const { data: negocios, error } = await consulta;
if (error) throw error;
if (!negocios?.length) { console.log('No hay negocios visibles.'); process.exit(0); }

let yo = null;
if (valor('--lat') && valor('--lon')) yo = { lat: Number(valor('--lat')), lon: Number(valor('--lon')) };
else {
  const { data } = await supabase.from('usuarios').select('latitud_universidad, longitud_universidad')
    .not('latitud_universidad', 'is', null).limit(1);
  if (data?.[0]) yo = { lat: data[0].latitud_universidad, lon: data[0].longitud_universidad };
}
console.log(`Negocios: ${negocios.length} · con reseñas: ${negocios.filter((n) => (n.num_resenas ?? 0) > 0).length} · ubicación del usuario: ${yo ? 'sí' : 'NO (cercanía neutra)'}\n`);

const base = ordenar(negocios, yo, BASE);
console.log('Orden base (top 10):');
base.slice(0, 10).forEach((x, i) =>
  console.log(`${String(i + 1).padStart(2)}. ${x.n.nombre.padEnd(34)} ${x.n.destacado ? '★dest ' : '      '}${x.d == null ? '  ?  km' : x.d.toFixed(1).padStart(5) + ' km'}  puntaje ${x.total.toFixed(3)}`));

// Sensibilidad: cuánto cambia el top 5 y cuánto se mueve cada negocio al variar UN parámetro.
const variantes = {
  'cercanía 0.60 / calidad 0.30 / novedad 0.10': { wCerca: 0.60, wCalidad: 0.30 },
  'cercanía 0.30 / calidad 0.60 / novedad 0.10': { wCerca: 0.30, wCalidad: 0.60 },
  'sin novedad (0.50 / 0.50 / 0)': { wCerca: 0.50, wCalidad: 0.50, wNuevo: 0 },
  'escala 0.75 km (castiga más la distancia)': { escalaKm: 0.75 },
  'escala 3 km (castiga menos)': { escalaKm: 3 },
  'prior 4.0': { prior: 4.0 },
};
const top5 = (o) => new Set(o.slice(0, 5).map((x) => x.n.id));
const posBase = new Map(base.map((x, i) => [x.n.id, i]));
console.log('\nSensibilidad (top-5 en común con el orden base · desplazamiento medio / máximo de posición):');
for (const [nombre, cambio] of Object.entries(variantes)) {
  const o = ordenar(negocios, yo, { ...BASE, ...cambio });
  const comun = [...top5(o)].filter((id) => top5(base).has(id)).length;
  const desp = o.map((x, i) => Math.abs(i - posBase.get(x.n.id)));
  const media = desp.reduce((a, b) => a + b, 0) / desp.length;
  console.log(`  ${nombre.padEnd(46)} ${comun}/5 · ${media.toFixed(1)} / ${Math.max(...desp)}`);
}
if (!negocios.some((n) => (n.num_resenas ?? 0) > 0))
  console.log('\nNota: ningún negocio tiene reseñas, así que "calidad" vale lo mismo para todos y los pesos de calidad no mueven el orden.');
