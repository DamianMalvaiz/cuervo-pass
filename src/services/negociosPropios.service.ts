// Mi negocio · Cuervo 360 · migración 0052.
//
// Un comerciante aprobado crea, edita y borra su negocio y su menú. El cliente lee SUS negocios desde la tabla (la política
// acota las filas a las propias, también los inactivos) y escribe por columnas: `destacado`, `origen` y la ocultación por
// reportes NO se pueden fijar desde aquí (privilegios por columna). Toda lectura que falla LANZA (END-11).

import { recortarHora, type DiaIso, type Turno } from '@/lib/horario';
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
  /** Ya no se pide (se publican los productos con su precio); la columna sigue en la base para los negocios de antes. */
  rango_precio?: number | null;
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
): Promise<{ negocio: NegocioPropio; items: NegocioItem[]; turnos: Turno[] } | null> {
  const { data: negocio, error } = await supabase.from('negocios').select(COLUMNAS).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!negocio) return null;
  const { data: items, error: errorItems } = await supabase
    .from('negocio_items')
    .select('id, negocio_id, nombre, precio, orden, seccion, descripcion, foto, fotos')
    .eq('negocio_id', id)
    .order('orden', { ascending: true });
  if (errorItems) throw errorItems;
  const { data: turnos, error: errorTurnos } = await supabase
    .from('negocio_horarios')
    .select('dia, abre, cierra')
    .eq('negocio_id', id)
    .order('dia', { ascending: true })
    .order('abre', { ascending: true });
  if (errorTurnos) throw errorTurnos;
  return {
    negocio: negocio as unknown as NegocioPropio,
    items: (items ?? []) as NegocioItem[],
    turnos: ((turnos ?? []) as { dia: number; abre: string; cierra: string }[]).map((t) => ({ dia: t.dia as DiaIso, abre: recortarHora(t.abre), cierra: recortarHora(t.cierra) })),
  };
}

/** Reemplaza TODOS los turnos del negocio de golpe (0070). Una lista vacía borra el horario: vuelve a «no sé». */
export async function guardarHorario(negocioId: string, turnos: Turno[]): Promise<void> {
  const { error } = await supabase.rpc('guardar_horario', { p_negocio: negocioId, p_turnos: turnos });
  if (error) throw error;
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
  seccion: string | null;
  descripcion: string | null;
  /** Hasta 5; la primera es la portada. */
  fotos: string[];
}

/**
 * Guarda el menú ENTERO en una sola llamada y una sola transacción (`guardar_menu`, 0053): borra lo que ya no está,
 * actualiza lo que sigue —con su orden— e inserta lo nuevo. Si un producto falla (por ejemplo, pasar del tope del plan,
 * CP009), TODO se deshace y el menú no queda a medias. El orden de la lista es el orden del menú.
 */
export async function guardarMenu(negocioId: string, items: ItemParaGuardar[]): Promise<void> {
  const { error } = await supabase.rpc('guardar_menu', {
    p_negocio: negocioId,
    p_items: items.map((i) => ({
      id: i.id,
      nombre: i.nombre,
      precio: i.precio,
      seccion: i.seccion,
      descripcion: i.descripcion,
      fotos: i.fotos,
    })),
  });
  if (error) throw error;
}

/**
 * Borra el negocio y, ANTES, sus fotos de Storage —las de la galería Y las de sus productos—: no hay cola de limpieza para
 * ellas (como sí la hay para las publicaciones), así que si se borrara primero la fila quedarían huérfanas para siempre. Si
 * borrar las fotos falla, `borrarFotos` avisa y sigue; el negocio se borra igual (la persona pidió borrarlo).
 */
export async function borrarNegocio(id: string, fotos: string[]): Promise<void> {
  const { data: items, error: errorItems } = await supabase.from('negocio_items').select('foto, fotos').eq('negocio_id', id);
  if (errorItems) throw errorItems;
  // Todas las fotos de cada producto (la portada es la primera de `fotos`; `foto` se suma por si una fila aún no la trae, sin repetirla).
  const deProductos = ((items ?? []) as { foto: string | null; fotos: string[] | null }[])
    .flatMap((i) => [...(i.fotos ?? []), ...(i.foto ? [i.foto] : [])])
    .filter((f, k, todas) => todas.indexOf(f) === k);
  await borrarFotos([...fotos, ...deProductos]);
  const { error } = await supabase.from('negocios').delete().eq('id', id);
  if (error) throw error;
}
