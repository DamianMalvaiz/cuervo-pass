// Servicios · Cuervo 360 · migración 0047.
//
// Los negocios se leen por las VISTAS públicas, nunca por las tablas (están cerradas): `negocios_publicos` y
// `negocio_items_publicos` traen solo lo visible y no exponen quién es el dueño. El filtro de categoría y la
// búsqueda corren en el SERVIDOR (invariante 5): filtrar en el teléfono una página ya recortada haría que la app
// afirmara «no hay nada» cuando sí lo hay. Toda lectura que falla LANZA (invariante 2).

import { supabase } from '@/lib/supabase';

import type { CategoriaServicio, Negocio, NegocioItem } from '@/types/database.types';

export type { CategoriaServicio, Negocio, NegocioItem };

// Enumeradas (END-28): nada de `select *`.
const COLUMNAS_NEGOCIO =
  'id, categoria_id, nombre, descripcion, direccion, latitud, longitud, rango_precio, horario, fotos, destacado, origen, calificacion, num_resenas';

export async function listarCategorias(): Promise<CategoriaServicio[]> {
  const { data, error } = await supabase
    .from('categorias_servicio')
    .select('id, nombre, icono, orden')
    .order('orden', { ascending: true });
  if (error) throw error;
  return (data ?? []) as CategoriaServicio[];
}

/**
 * La lista de Servicios, ORDENADA en el servidor (`negocios_ordenados`, 0055): destacados primero y, dentro de cada nivel,
 * por un puntaje de cercanía a tu universidad, calidad (reseñas) y novedad. La categoría y la búsqueda (con los comodines de
 * LIKE ya escapados) también se aplican allí: filtrar en el teléfono una página recortada haría que la app dijera «no hay
 * nada» cuando sí lo hay. Cada negocio trae `distancia_km` (o null si falta el dato) y `puntaje`.
 */
export async function listarNegocios({
  categoriaId,
  texto,
}: {
  categoriaId?: string;
  texto?: string;
}): Promise<Negocio[]> {
  const { data, error } = await supabase.rpc('negocios_ordenados', {
    p_categoria: categoriaId ?? null,
    p_texto: texto?.trim() || null,
    p_limite: 100,
  });
  if (error) throw error;
  return (data ?? []) as Negocio[];
}

/** El negocio y su menú. `null` si no existe o no es visible: no es un fallo. */
export async function obtenerNegocio(id: string): Promise<{ negocio: Negocio; items: NegocioItem[] } | null> {
  const { data: negocio, error } = await supabase
    .from('negocios_publicos')
    .select(COLUMNAS_NEGOCIO)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!negocio) return null;

  const { data: items, error: errorItems } = await supabase
    .from('negocio_items_publicos')
    .select('id, negocio_id, nombre, precio, orden, seccion, descripcion, foto')
    .eq('negocio_id', id)
    .order('orden', { ascending: true });
  if (errorItems) throw errorItems;

  return { negocio: negocio as Negocio, items: (items ?? []) as NegocioItem[] };
}
