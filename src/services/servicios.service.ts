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
  'id, categoria_id, nombre, descripcion, direccion, latitud, longitud, rango_precio, horario, fotos, destacado, origen';

export async function listarCategorias(): Promise<CategoriaServicio[]> {
  const { data, error } = await supabase
    .from('categorias_servicio')
    .select('id, nombre, icono, orden')
    .order('orden', { ascending: true });
  if (error) throw error;
  return (data ?? []) as CategoriaServicio[];
}

/** Escapa los comodines de LIKE: sin esto, buscar «50%» sería buscar «todo». */
const escaparLike = (t: string) => t.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function listarNegocios({
  categoriaId,
  texto,
}: {
  categoriaId?: string;
  texto?: string;
}): Promise<Negocio[]> {
  let consulta = supabase.from('negocios_publicos').select(COLUMNAS_NEGOCIO);
  if (categoriaId) consulta = consulta.eq('categoria_id', categoriaId);
  const buscado = texto?.trim();
  if (buscado) consulta = consulta.ilike('nombre', `%${escaparLike(buscado)}%`);
  const { data, error } = await consulta
    .order('destacado', { ascending: false })
    .order('nombre', { ascending: true });
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
