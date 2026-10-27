// Servicios · Cuervo 360 · migración 0047.
//
// Los negocios se leen por las VISTAS públicas, nunca por las tablas (están cerradas): `negocios_publicos` y
// `negocio_items_publicos` traen solo lo visible y no exponen quién es el dueño. El filtro de categoría y la
// búsqueda corren en el SERVIDOR (invariante 5): filtrar en el teléfono una página ya recortada haría que la app
// afirmara «no hay nada» cuando sí lo hay. Toda lectura que falla LANZA (invariante 2).

import { recortarHora, type DiaIso, type Turno } from '@/lib/horario';
import { supabase } from '@/lib/supabase';

import type { CategoriaServicio, Negocio, NegocioItem } from '@/types/database.types';

export type { CategoriaServicio, Negocio, NegocioItem };

// Enumeradas (END-28): nada de `select *`.
export const COLUMNAS_NEGOCIO =
  'id, categoria_id, nombre, descripcion, direccion, latitud, longitud, rango_precio, horario, fotos, destacado, origen, calificacion, num_resenas, abierto_ahora';

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
  soloAbiertos,
}: {
  categoriaId?: string;
  texto?: string;
  /** Solo los que SE SABE que están abiertos ahora (los sin horario estructurado no cuentan). Se filtra en el servidor (0070). */
  soloAbiertos?: boolean;
}): Promise<Negocio[]> {
  const { data, error } = await supabase.rpc('negocios_ordenados', {
    p_categoria: categoriaId ?? null,
    p_texto: texto?.trim() || null,
    p_limite: 100,
    p_solo_abiertos: Boolean(soloAbiertos),
  });
  if (error) throw error;
  return (data ?? []) as Negocio[];
}

/** Los turnos de un negocio VISIBLE (vacío = sin horario estructurado). */
export async function obtenerHorarioPublico(negocioId: string): Promise<Turno[]> {
  const { data, error } = await supabase
    .from('negocio_horarios_publicos')
    .select('dia, abre, cierra')
    .eq('negocio_id', negocioId)
    .order('dia', { ascending: true })
    .order('abre', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as { dia: number; abre: string; cierra: string }[]).map((t) => ({ dia: t.dia as DiaIso, abre: recortarHora(t.abre), cierra: recortarHora(t.cierra) }));
}

/** El negocio, su menú y su horario. `null` si no existe o no es visible: no es un fallo. */
export async function obtenerNegocio(id: string): Promise<{ negocio: Negocio; items: NegocioItem[]; turnos: Turno[] } | null> {
  const { data: negocio, error } = await supabase
    .from('negocios_publicos')
    .select(COLUMNAS_NEGOCIO)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!negocio) return null;

  const { data: items, error: errorItems } = await supabase
    .from('negocio_items_publicos')
    .select('id, negocio_id, nombre, precio, orden, seccion, descripcion, foto, fotos, estrella')
    .eq('negocio_id', id)
    .order('orden', { ascending: true });
  if (errorItems) throw errorItems;

  return { negocio: negocio as Negocio, items: (items ?? []) as NegocioItem[], turnos: await obtenerHorarioPublico(id) };
}
