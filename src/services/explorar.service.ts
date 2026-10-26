// Explorar sin cuenta · Cuervo 360 · migración 0090.
//
// La web se explora SIN sesión, con datos reducidos: se lee solo de las cinco vistas `explorar_*` (lista blanca; `anon` no tiene nada más en `public`). Las columnas van
// enumeradas y NO incluyen dirección exacta, coordenadas exactas, teléfono, quién publica ni la descripción de una vivienda: la vista no las tiene, y aquí tampoco se piden.
// Las fotos las firma la Edge Function `fotos-publicas`. Todo LANZA si falla (END-11): «no se pudo leer» no es «no hay nada».

import { supabase } from '@/lib/supabase';
import type { CategoriaExplorar, HorarioExplorar, NegocioExplorar, ProductoExplorar, PublicacionExplorar } from '@/types/database.types';

export type { CategoriaExplorar, HorarioExplorar, NegocioExplorar, ProductoExplorar, PublicacionExplorar };

export const COLUMNAS_EXPLORAR_PUBLICACION =
  'id, titulo_publico, tipo, precio_renta, recamaras, amueblado, permite_mascotas, servicios_incluidos, zona, latitud_aprox, longitud_aprox, num_fotos, destacado, calificacion, num_resenas, creado_en';
export const COLUMNAS_EXPLORAR_NEGOCIO =
  'id, categoria_id, nombre, descripcion, zona, latitud_aprox, longitud_aprox, horario, num_fotos, destacado, calificacion, num_resenas, abierto_ahora, creado_en';

export interface FiltroPublicaciones {
  limite: number;
  /** Se aplica en el servidor: filtrar sobre una página ya truncada diría «no hay nada» cuando sí hay (invariante 5). */
  precioMax?: number;
}

/** Destacadas primero y, dentro, las más nuevas. */
export async function listarPublicacionesPublicas({ limite, precioMax }: FiltroPublicaciones): Promise<PublicacionExplorar[]> {
  let q = supabase.from('explorar_publicaciones').select(COLUMNAS_EXPLORAR_PUBLICACION);
  if (precioMax !== undefined) q = q.lte('precio_renta', precioMax);
  const { data, error } = await q.order('destacado', { ascending: false }).order('creado_en', { ascending: false }).limit(limite);
  if (error) throw error;
  return (data ?? []) as PublicacionExplorar[];
}

/** `null` solo si no existe o no es visible; un fallo lanza. */
export async function obtenerPublicacionPublica(id: string): Promise<PublicacionExplorar | null> {
  const { data, error } = await supabase.from('explorar_publicaciones').select(COLUMNAS_EXPLORAR_PUBLICACION).eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as PublicacionExplorar | null) ?? null;
}

export async function listarNegociosPublicos({ limite }: { limite: number }): Promise<NegocioExplorar[]> {
  const { data, error } = await supabase
    .from('explorar_negocios')
    .select(COLUMNAS_EXPLORAR_NEGOCIO)
    .order('destacado', { ascending: false })
    .order('creado_en', { ascending: false })
    .limit(limite);
  if (error) throw error;
  return (data ?? []) as NegocioExplorar[];
}

export async function obtenerNegocioPublico(id: string): Promise<NegocioExplorar | null> {
  const { data, error } = await supabase.from('explorar_negocios').select(COLUMNAS_EXPLORAR_NEGOCIO).eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as NegocioExplorar | null) ?? null;
}

export async function listarCategoriasPublicas(): Promise<CategoriaExplorar[]> {
  const { data, error } = await supabase.from('explorar_categorias').select('id, nombre, icono, orden').order('orden', { ascending: true });
  if (error) throw error;
  return (data ?? []) as CategoriaExplorar[];
}

/** Los productos visibles de un negocio: las estrellas primero, luego en el orden que eligió quien vende. */
export async function listarProductosPublicos(negocioId: string): Promise<ProductoExplorar[]> {
  const { data, error } = await supabase
    .from('explorar_productos')
    .select('id, negocio_id, nombre, precio, seccion, descripcion, num_fotos, estrella, orden')
    .eq('negocio_id', negocioId)
    .order('estrella', { ascending: false })
    .order('orden', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProductoExplorar[];
}

export async function listarHorarioPublico(negocioId: string): Promise<HorarioExplorar[]> {
  const { data, error } = await supabase.from('explorar_horarios').select('negocio_id, dia, abre, cierra').eq('negocio_id', negocioId);
  if (error) throw error;
  return (data ?? []) as HorarioExplorar[];
}

/** URL firmadas (1 h) de las fotos de algo visible. Lanza si la función falla o no responde lo esperado: una galería vacía es un hecho, un fallo no. */
export async function fotosPublicas(tipo: 'publicacion' | 'negocio' | 'producto', id: string): Promise<string[]> {
  const { data, error } = await supabase.functions.invoke('fotos-publicas', { body: { tipo, id } });
  if (error) throw error;
  const fotos = (data as { fotos?: unknown } | null)?.fotos;
  if (!Array.isArray(fotos)) throw new Error('Respuesta inesperada de fotos-publicas');
  return fotos.filter((f): f is string => typeof f === 'string');
}
