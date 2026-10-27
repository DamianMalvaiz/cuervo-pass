// Favoritos · Cuervo 360 · migración 0044.
//
// Un favorito es PRIVADO: la tabla solo deja leer las filas propias. Las publicaciones se leen por la
// VISTA pública, la misma que usa la ficha, así que una publicación que dejó de ser visible
// (inactiva u oculta por reportes) desaparece de la lista sin que nada se filtre.

import { supabase } from '@/lib/supabase';
import { COLUMNAS_NEGOCIO } from '@/services/servicios.service';
import type { Negocio } from '@/types/database.types';
import { SQL, esCodigo } from '@/lib/erroresPostgres';

/**
 * Lo mínimo para pintar una fila de la lista. Las columnas van ENUMERADAS (END-28): la vista también
 * trae el vector de afinidad, 384 flotantes que ninguna pantalla de aquí lee.
 */
export interface FavoritoPublicacion {
  id: string;
  usuario_id: string;
  titulo: string;
  tipo: 'depa' | 'cuarto' | 'casa_compartida';
  direccion: string;
  latitud: number | null;
  longitud: number | null;
  precio_renta: number;
  fotos: string[] | null;
}

/** Los ids que esta cuenta guardó, los más recientes primero. LANZA si falla (END-11). */
export async function listarMisFavoritosIds(usuarioId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('favoritos')
    .select('publicacion_id')
    .eq('usuario_id', usuarioId)
    .order('creado_en', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((f) => f.publicacion_id as string);
}

/**
 * Guarda una publicación. Idempotente: tocar el corazón dos veces, o guardar desde otro teléfono lo
 * que ya estaba, no es un error. Los demás fallos se lanzan CON su código: CP004 es el tope de 200.
 */
export async function guardarFavorito(usuarioId: string, publicacionId: string): Promise<void> {
  const { error } = await supabase
    .from('favoritos')
    .insert({ usuario_id: usuarioId, publicacion_id: publicacionId });
  if (error && !esCodigo(error, SQL.UNIQUE_VIOLATION)) throw error;
}

export async function quitarFavorito(usuarioId: string, publicacionId: string): Promise<void> {
  const { error } = await supabase
    .from('favoritos')
    .delete()
    .eq('usuario_id', usuarioId)
    .eq('publicacion_id', publicacionId);
  if (error) throw error;
}

/**
 * La lista para la pestaña: las publicaciones guardadas que SIGUEN visibles, en el orden en que se
 * guardaron, y cuántas ya no están disponibles. Sin esa cifra, la lista callaría que faltan.
 */
export async function listarMisFavoritos(
  usuarioId: string
): Promise<{ publicaciones: FavoritoPublicacion[]; noDisponibles: number }> {
  const ids = await listarMisFavoritosIds(usuarioId);
  if (ids.length === 0) return { publicaciones: [], noDisponibles: 0 };

  const { data, error } = await supabase
    .from('publicaciones_publicas')
    // Un LITERAL de una pieza: supabase-js infiere el tipo leyendo esta cadena (ver
    // `obtenerPublicacionPublica`).
    .select('id, usuario_id, titulo, tipo, direccion, latitud, longitud, precio_renta, fotos')
    .in('id', ids);
  if (error) throw error;

  const porId = new Map((data ?? []).map((p) => [p.id as string, p as unknown as FavoritoPublicacion]));
  const publicaciones = ids.flatMap((id) => (porId.has(id) ? [porId.get(id) as FavoritoPublicacion] : []));
  return { publicaciones, noDisponibles: ids.length - publicaciones.length };
}

/** La función de la base rechaza más de 50 ids por llamada (54000): una lista larga se parte en tandas. */
const TANDA = 50;

/**
 * Cuántas personas guardaron cada publicación: el NÚMERO, nunca quién (migración 0045). Devuelve un
 * mapa id → total SOLO de las publicaciones que se pueden ver (o son propias): una que no se puede
 * ver no tiene entrada, y el mapa no inventa un cero por ella (END-11). LANZA si falla.
 */
export async function contarFavoritos(ids: string[]): Promise<Map<string, number>> {
  const conteos = new Map<string, number>();
  for (let i = 0; i < ids.length; i += TANDA) {
    const { data, error } = await supabase.rpc('favoritos_por_publicacion', { p_ids: ids.slice(i, i + TANDA) });
    if (error) throw error;
    for (const fila of data ?? []) conteos.set(fila.publicacion_id, fila.total);
  }
  return conteos;
}

/**
 * Cuántas personas guardaron CADA UNO DE MIS negocios (0088): el número, nunca quién. La función solo responde por los negocios del propio vendedor; uno ajeno no
 * tiene entrada. Va en tandas de 50 (la base rechaza más) y LANZA si falla: un fallo no es «cero personas» (END-11).
 */
export async function contarFavoritosDeMisNegocios(ids: string[]): Promise<Map<string, number>> {
  const conteos = new Map<string, number>();
  for (let i = 0; i < ids.length; i += TANDA) {
    const { data, error } = await supabase.rpc('favoritos_por_negocio', { p_ids: ids.slice(i, i + TANDA) });
    if (error) throw error;
    for (const fila of data ?? []) conteos.set(fila.negocio_id, fila.total);
  }
  return conteos;
}

// ── Favoritos de negocios (0073) ───────────────────────────────────────────────────────────────────────────────

/** Los ids de negocios que esta cuenta guardó, los más recientes primero. LANZA si falla (END-11). */
export async function listarMisNegociosFavoritosIds(usuarioId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('favoritos_negocios')
    .select('negocio_id')
    .eq('usuario_id', usuarioId)
    .order('creado_en', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((f) => f.negocio_id as string);
}

/** Idempotente como `guardarFavorito`. CP004 = tope de 200. */
export async function guardarFavoritoNegocio(usuarioId: string, negocioId: string): Promise<void> {
  const { error } = await supabase.from('favoritos_negocios').insert({ usuario_id: usuarioId, negocio_id: negocioId });
  if (error && !esCodigo(error, SQL.UNIQUE_VIOLATION)) throw error;
}

export async function quitarFavoritoNegocio(usuarioId: string, negocioId: string): Promise<void> {
  const { error } = await supabase.from('favoritos_negocios').delete().eq('usuario_id', usuarioId).eq('negocio_id', negocioId);
  if (error) throw error;
}

/** Los negocios guardados que SIGUEN visibles, en el orden en que se guardaron, y cuántos ya no están disponibles. */
export async function listarMisNegociosFavoritos(usuarioId: string): Promise<{ negocios: Negocio[]; noDisponibles: number }> {
  const ids = await listarMisNegociosFavoritosIds(usuarioId);
  if (ids.length === 0) return { negocios: [], noDisponibles: 0 };
  const { data, error } = await supabase.from('negocios_publicos').select(COLUMNAS_NEGOCIO).in('id', ids);
  if (error) throw error;
  const porId = new Map((data ?? []).map((n) => [(n as unknown as Negocio).id, n as unknown as Negocio]));
  const negocios = ids.flatMap((id) => (porId.has(id) ? [porId.get(id) as Negocio] : []));
  return { negocios, noDisponibles: ids.length - negocios.length };
}
