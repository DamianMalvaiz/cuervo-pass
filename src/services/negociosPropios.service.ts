// Mi negocio · Cuervo 360 · migración 0052.
//
// Un comerciante aprobado crea, edita y borra su negocio y su menú. El cliente lee SUS negocios desde la tabla (la política
// acota las filas a las propias, también los inactivos) y escribe por columnas: `destacado`, `origen` y la ocultación por
// reportes NO se pueden fijar desde aquí (privilegios por columna). Toda lectura que falla LANZA (END-11).

import { borrarFotos } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import type { NegocioItem, NegocioPropio } from '@/types/database.types';

export type { NegocioPropio };

export interface DatosNegocio {
  categoria_id: string;
  nombre: string;
  descripcion: string | null;
  direccion: string;
  latitud: number | null;
  longitud: number | null;
  rango_precio: number | null;
  horario: string | null;
  activo: boolean;
}

// Enumeradas (END-28).
const COLUMNAS =
  'id, categoria_id, nombre, descripcion, direccion, latitud, longitud, rango_precio, horario, fotos, destacado, origen, activo, oculto_por_reportes';

export async function listarMisNegocios(usuarioId: string): Promise<NegocioPropio[]> {
  const { data, error } = await supabase
    .from('negocios')
    .select(COLUMNAS)
    .eq('usuario_id', usuarioId)
    .order('creado_en', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as NegocioPropio[];
}

/** Un negocio propio con su menú, o `null` si no existe o no es tuyo (no es un fallo). */
export async function obtenerMiNegocio(
  id: string
): Promise<{ negocio: NegocioPropio; items: NegocioItem[] } | null> {
  const { data: negocio, error } = await supabase.from('negocios').select(COLUMNAS).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!negocio) return null;
  const { data: items, error: errorItems } = await supabase
    .from('negocio_items')
    .select('id, negocio_id, nombre, precio, orden')
    .eq('negocio_id', id)
    .order('orden', { ascending: true });
  if (errorItems) throw errorItems;
  return { negocio: negocio as unknown as NegocioPropio, items: (items ?? []) as NegocioItem[] };
}

/** Crea el negocio SIN fotos (las fotos viven en una carpeta con el id, que aún no existe) y devuelve su id. */
export async function crearNegocio(usuarioId: string, datos: DatosNegocio): Promise<string> {
  const { data, error } = await supabase
    .from('negocios')
    .insert({ usuario_id: usuarioId, ...datos, fotos: [] })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function actualizarNegocio(id: string, cambios: Partial<DatosNegocio> & { fotos?: string[] }): Promise<void> {
  const { error } = await supabase.from('negocios').update(cambios).eq('id', id);
  if (error) throw error;
}

export interface ItemParaGuardar {
  id?: string;
  nombre: string;
  precio: number | null;
}

/**
 * Deja el menú como se pidió: borra los que ya no están, actualiza los que siguen (con su nuevo orden) e inserta los
 * nuevos. No es atómico —son varias peticiones—, pero cada paso es idempotente: repetirlo tras un corte llega al mismo
 * resultado. LANZA con el primer error.
 */
export async function guardarMenu(negocioId: string, items: ItemParaGuardar[]): Promise<void> {
  const { data: actuales, error } = await supabase.from('negocio_items').select('id').eq('negocio_id', negocioId);
  if (error) throw error;

  const quedan = new Set(items.filter((i) => i.id).map((i) => i.id as string));
  const sobran = ((actuales ?? []) as { id: string }[]).map((a) => a.id).filter((id) => !quedan.has(id));
  if (sobran.length > 0) {
    const { error: e } = await supabase.from('negocio_items').delete().in('id', sobran);
    if (e) throw e;
  }

  for (const [orden, it] of items.entries()) {
    if (it.id) {
      const { error: e } = await supabase
        .from('negocio_items')
        .update({ nombre: it.nombre, precio: it.precio, orden })
        .eq('id', it.id);
      if (e) throw e;
    } else {
      const { error: e } = await supabase
        .from('negocio_items')
        .insert({ negocio_id: negocioId, nombre: it.nombre, precio: it.precio, orden });
      if (e) throw e;
    }
  }
}

/**
 * Borra el negocio y, ANTES, sus fotos de Storage: no hay cola de limpieza para ellas (como sí la hay para las
 * publicaciones), así que si se borrara primero la fila quedarían huérfanas para siempre. Si borrar las fotos falla,
 * `borrarFotos` avisa y sigue; el negocio se borra igual (la persona pidió borrarlo).
 */
export async function borrarNegocio(id: string, fotos: string[]): Promise<void> {
  await borrarFotos(fotos);
  const { error } = await supabase.from('negocios').delete().eq('id', id);
  if (error) throw error;
}
