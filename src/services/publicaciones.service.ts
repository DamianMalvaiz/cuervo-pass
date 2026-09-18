// Documento maestro v5 · §14, §17, §18, §27.
//
// Cambio de fondo frente a v3: el motor de sugerencias ya NO vive aquí. Antes
// se traían todas las publicaciones activas y se puntuaban en JavaScript, lo
// que significaba (a) bajar el catálogo completo al teléfono y (b) filtrar con
// heurísticas de subcadenas sobre la descripción. Ahora el Nivel 1 y el Nivel 2
// son funciones de Postgres (migración 0014) y esto solo las llama.

import { generarEmbedding } from '@/lib/aiService';
import { geocodificarDireccion } from '@/lib/geocoding';
import { subirFotoPublicacion } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import type { Publicacion, PublicacionSugerida, TipoPublicacion } from '@/types/database.types';

// El título y la descripción son lo semánticamente rico ("pet friendly",
// "silencioso"); si no hay ninguno, cae a algo genérico en vez de fallar (el
// endpoint rechaza texto vacío).
function textoParaEmbedding(datos: { titulo: string; descripcion?: string; direccion: string }): string {
  const partes = [datos.titulo, datos.descripcion?.trim()].filter(Boolean);
  return partes.length ? partes.join('. ') : `Departamento en ${datos.direccion}`;
}

// Nunca bloquea crear/editar la publicación si el microservicio falla (§27):
// vector_embedding queda null y esa publicación simplemente no participa en el
// reordenamiento de Nivel 2 hasta que se reintente (editar y guardar de nuevo).
async function generarEmbeddingSeguro(datos: {
  titulo: string;
  descripcion?: string;
  direccion: string;
}): Promise<number[] | null> {
  try {
    return await generarEmbedding(textoParaEmbedding(datos));
  } catch (e) {
    console.warn('generarEmbedding (publicación) falló:', e);
    return null;
  }
}

// ═══════════════════ Sugerencias ═══════════════════

export interface ResultadoSugerencias {
  datos: PublicacionSugerida[];
  /** 1 = filtros ponderados. 2 = además reordenado por similitud semántica. */
  nivel: 1 | 2;
}

/**
 * §18 — degradación real, no una frase en una tabla.
 *
 * Si el perfil o las publicaciones no tienen vector —usuario que no consintió
 * el análisis con IA, microservicio caído al momento de publicar— el Nivel 2
 * devuelve menos filas o ninguna, y se cae al Nivel 1.
 *
 * El `nivel` se muestra en pantalla durante la demo a propósito: poder decir
 * "esto corre en Nivel 2; si apago el contenedor la app sigue funcionando en
 * Nivel 1" — y demostrarlo en vivo — vale más que cualquier feature extra.
 */
export async function obtenerSugerencias(limite = 20): Promise<ResultadoSugerencias> {
  const conIA = await supabase.rpc('sugerencias_con_ranking', { p_limite: limite });
  if (!conIA.error && conIA.data?.length) {
    return { datos: conIA.data as PublicacionSugerida[], nivel: 2 };
  }
  if (conIA.error) console.warn('sugerencias_con_ranking falló:', conIA.error.message);

  const base = await supabase.rpc('sugerencias_publicaciones', { p_limite: limite });
  if (base.error) throw base.error;
  return { datos: (base.data ?? []) as PublicacionSugerida[], nivel: 1 };
}

// ═══════════════════ Lectura ═══════════════════

/**
 * Detalle de una publicación ajena: sale de la VISTA pública, que no trae el
 * teléfono. Leer la tabla directamente devolvería cero filas para cualquiera
 * que no sea el dueño (policy publicaciones_select_propias) — que es
 * exactamente el síntoma de AUD-01, y por eso conviene tenerlo claro aquí.
 */
export async function obtenerPublicacionPublica(id: string) {
  const { data, error } = await supabase
    .from('publicaciones_publicas')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Mis propias publicaciones: aquí sí se lee la tabla, y el teléfono viene incluido. */
export async function listarMisPublicaciones(usuarioId: string) {
  const { data, error } = await supabase
    .from('publicaciones')
    .select('*')
    .eq('usuario_id', usuarioId)
    .order('creado_en', { ascending: false });
  if (error) throw error;
  return data as Publicacion[];
}

export async function obtenerMiPublicacion(id: string) {
  const { data, error } = await supabase.from('publicaciones').select('*').eq('id', id).single();
  if (error) throw error;
  return data as Publicacion;
}

/** Contactos recibidos por publicación, para "Mis publicaciones". Función de
 *  Postgres porque son filas ajenas: el dueño ve CUÁNTOS, nunca quién (§13). */
export async function contarContactosRecibidos(): Promise<Map<string, number>> {
  const { data, error } = await supabase.rpc('contactos_de_mis_publicaciones');
  if (error) {
    console.warn('contactos_de_mis_publicaciones falló:', error.message);
    return new Map();
  }
  return new Map((data ?? []).map((f) => [f.publicacion_id, Number(f.total)]));
}

// ═══════════════════ Escritura ═══════════════════

// Una foto ya subida (viene con su ruta en el bucket) o una recién elegida en
// el dispositivo (viene con su uri local, `file://...`).
export type FotoEntrada = { url: string; esNueva: false } | { uri: string; esNueva: true };

export interface DatosPublicacion {
  usuarioId: string;
  titulo: string;
  tipo: TipoPublicacion;
  direccion: string;
  precioRenta: number;
  descripcion?: string;
  permiteMascotas: boolean;
  amueblado: boolean;
  serviciosIncluidos: boolean;
  recamaras: number;
  whatsapp: string;
  fotos: FotoEntrada[];
}

async function resolverFotos(usuarioId: string, publicacionId: string, fotos: FotoEntrada[]): Promise<string[]> {
  return Promise.all(
    fotos.map((foto, indice) =>
      foto.esNueva ? subirFotoPublicacion(usuarioId, publicacionId, indice, foto.uri) : foto.url
    )
  );
}

function columnasComunes(datos: DatosPublicacion) {
  return {
    titulo: datos.titulo,
    tipo: datos.tipo,
    direccion: datos.direccion,
    precio_renta: datos.precioRenta,
    descripcion: datos.descripcion,
    // Atributos EXPLÍCITOS. v3 los adivinaba con `descripcion.includes('mascota')`,
    // que hace que "NO acepto mascotas" cuente como que sí — y un filtro duro no
    // se puede construir sobre eso (§11).
    permite_mascotas: datos.permiteMascotas,
    amueblado: datos.amueblado,
    servicios_incluidos: datos.serviciosIncluidos,
    recamaras: datos.recamaras,
    whatsapp: datos.whatsapp,
  };
}

export async function crearPublicacion(datos: DatosPublicacion): Promise<Publicacion> {
  // §27: si el geocoding falla, la publicación se guarda igual con
  // `pendiente_geocoding = true` y se reintenta desde "Mis publicaciones".
  const [coords, vectorEmbedding] = await Promise.all([
    geocodificarDireccion(datos.direccion),
    generarEmbeddingSeguro(datos),
  ]);

  const { data: fila, error } = await supabase
    .from('publicaciones')
    .insert({
      usuario_id: datos.usuarioId,
      ...columnasComunes(datos),
      latitud: coords?.lat ?? null,
      longitud: coords?.lng ?? null,
      geocodificado_por: coords?.proveedor ?? null,
      pendiente_geocoding: coords == null,
      ...(vectorEmbedding ? { vector_embedding: vectorEmbedding } : {}),
    })
    .select()
    .single();
  if (error) throw error;
  const publicacion = fila as Publicacion;

  if (datos.fotos.length === 0) return publicacion;

  // Las fotos se suben DESPUÉS del insert porque necesitan el id que Postgres
  // genera para armar la ruta publicaciones/<usuario>/<id>/n.jpg que las
  // policies de Storage esperan.
  const rutas = await resolverFotos(datos.usuarioId, publicacion.id, datos.fotos);

  const { data: actualizada, error: errorUpdate } = await supabase
    .from('publicaciones')
    .update({ fotos: rutas })
    .eq('id', publicacion.id)
    .select()
    .single();
  if (errorUpdate) throw errorUpdate;
  return actualizada as Publicacion;
}

export async function actualizarPublicacion(publicacionId: string, datos: DatosPublicacion): Promise<Publicacion> {
  const [rutas, coords, vectorEmbedding] = await Promise.all([
    resolverFotos(datos.usuarioId, publicacionId, datos.fotos),
    geocodificarDireccion(datos.direccion),
    generarEmbeddingSeguro(datos),
  ]);
  const { data, error } = await supabase
    .from('publicaciones')
    .update({
      ...columnasComunes(datos),
      latitud: coords?.lat ?? null,
      longitud: coords?.lng ?? null,
      geocodificado_por: coords?.proveedor ?? null,
      pendiente_geocoding: coords == null,
      fotos: rutas,
      ...(vectorEmbedding ? { vector_embedding: vectorEmbedding } : {}),
    })
    .eq('id', publicacionId)
    .select()
    .single();
  if (error) throw error;
  return data as Publicacion;
}

export async function cambiarEstadoPublicacion(id: string, activa: boolean) {
  const { error } = await supabase.from('publicaciones').update({ activa }).eq('id', id);
  if (error) throw error;
}

/**
 * §27 — reintento del geocoding. v3 prometía un reintento "en segundo plano"
 * sin nada que lo hiciera; aquí se dispara al abrir "Mis publicaciones".
 * Devuelve cuántas se resolvieron.
 */
export async function reintentarGeocodingPendiente(publicaciones: Publicacion[]): Promise<number> {
  const pendientes = publicaciones.filter((p) => p.pendiente_geocoding);
  let resueltas = 0;
  // En serie, no en paralelo: Nominatim admite una petición por segundo y
  // dispararlas todas juntas es la forma más rápida de que te bloqueen (§9).
  for (const p of pendientes) {
    const coords = await geocodificarDireccion(p.direccion);
    if (!coords) continue;
    const { error } = await supabase
      .from('publicaciones')
      .update({
        latitud: coords.lat,
        longitud: coords.lng,
        geocodificado_por: coords.proveedor,
        pendiente_geocoding: false,
      })
      .eq('id', p.id);
    if (!error) resueltas += 1;
  }
  return resueltas;
}

// ═══════════════════ Contacto y moderación ═══════════════════

/**
 * AUD-04 — el teléfono no se lee, se pide.
 *
 * `publicaciones_publicas` no trae la columna `whatsapp`: el número solo sale
 * de esta función, que aplica una cuota de 25 revelaciones diarias y registra
 * el contacto sin duplicar. v4 tenía la función pero sin cuota, lo que
 * registraba el scraping en vez de impedirlo.
 */
export async function revelarContacto(publicacionId: string, score?: number | null): Promise<string> {
  const { data, error } = await supabase.rpc('revelar_contacto', {
    p_publicacion_id: publicacionId,
    p_score: score ?? null,
  });
  if (error) throw error;
  return data as string;
}

/** El ocultamiento automático a los 3 reportes lo hace el trigger `al_reportar`
 *  (migración 0012). v3 lo prometía y no había nada que lo hiciera. */
export async function reportarPublicacion(reportadoPor: string, publicacionId: string, motivo: string) {
  const { error } = await supabase
    .from('reportes')
    .insert({ reportado_por: reportadoPor, publicacion_id: publicacionId, motivo });
  if (error) throw error;
}
