// Reseñas · Cuervo 360 · migración 0054.
//
// Lo público sale de la VISTA `resenas_publicas` (solo lo visible, con el nombre de la autora y `es_mia`); la TABLA solo deja leer
// y escribir las propias. El dueño responde por la RPC `responder_resena` y cualquiera reporta por `reportar_resena`. La
// calificación NO se escribe nunca: la calcula la base. Toda lectura que falla LANZA (END-11).

import type { Objetivo, ResenaPublica } from '@/lib/resenas';
import { supabase } from '@/lib/supabase';
import type { MiResena } from '@/types/database.types';

const COLUMNAS_PUBLICAS = 'id, negocio_id, publicacion_id, estrellas, texto, respuesta, respondida_en, creado_en, autor, es_mia';
const COLUMNAS_MIAS = 'id, usuario_id, negocio_id, publicacion_id, estrellas, texto';

/** Las reseñas visibles de un negocio o una vivienda, las más recientes primero. */
export async function listarResenas(objetivo: Objetivo): Promise<ResenaPublica[]> {
  const consulta = supabase.from('resenas_publicas').select(COLUMNAS_PUBLICAS);
  const filtrada =
    objetivo.negocioId != null
      ? consulta.eq('negocio_id', objetivo.negocioId)
      : consulta.eq('publicacion_id', objetivo.publicacionId as string);
  const { data, error } = await filtrada.order('creado_en', { ascending: false }).limit(50);
  if (error) throw error;
  return (data ?? []) as ResenaPublica[];
}

/** La reseña que ESTA cuenta dejó sobre el objetivo, o `null` si no ha dejado ninguna (no es un fallo). */
export async function obtenerMiResena(usuarioId: string, objetivo: Objetivo): Promise<MiResena | null> {
  const consulta = supabase.from('resenas').select(COLUMNAS_MIAS).eq('usuario_id', usuarioId);
  const filtrada =
    objetivo.negocioId != null
      ? consulta.eq('negocio_id', objetivo.negocioId)
      : consulta.eq('publicacion_id', objetivo.publicacionId as string);
  const { data, error } = await filtrada.maybeSingle();
  if (error) throw error;
  return (data as MiResena | null) ?? null;
}

/**
 * Crea o edita MI reseña. Con `id` actualiza (solo estrellas y texto: son las únicas columnas que el cliente puede escribir);
 * sin `id` inserta. Un duplicado llega como 23505 y un objetivo que no se ve o es tuyo, como 42501.
 */
export async function guardarResena(
  usuarioId: string,
  objetivo: Objetivo,
  datos: { id?: string; estrellas: number; texto: string }
): Promise<void> {
  const texto = datos.texto.trim() || null;
  if (datos.id) {
    const { error } = await supabase.from('resenas').update({ estrellas: datos.estrellas, texto }).eq('id', datos.id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('resenas').insert({
    usuario_id: usuarioId,
    negocio_id: objetivo.negocioId ?? null,
    publicacion_id: objetivo.publicacionId ?? null,
    estrellas: datos.estrellas,
    texto,
  });
  if (error) throw error;
}

export async function borrarMiResena(id: string): Promise<void> {
  const { error } = await supabase.from('resenas').delete().eq('id', id);
  if (error) throw error;
}

/** El dueño responde; texto vacío QUITA la respuesta. 42501 si no es dueño del objetivo. */
export async function responderResena(id: string, texto: string): Promise<void> {
  const { error } = await supabase.rpc('responder_resena', { p_resena: id, p_texto: texto });
  if (error) throw error;
}

/** Reporta una reseña ajena. Reportar dos veces la misma no es un error; 42501 si no se puede reportar. */
export async function reportarResena(id: string, motivo: string): Promise<void> {
  const { error } = await supabase.rpc('reportar_resena', { p_resena: id, p_motivo: motivo });
  if (error) throw error;
}

/** La calificación calculada de una vivienda (0054), o `null` si no tiene reseñas visibles. No se escribe nunca. */
export async function obtenerCalificacionPublicacion(
  publicacionId: string
): Promise<{ calificacion: number; num_resenas: number } | null> {
  const { data, error } = await supabase
    .from('calificacion_publicaciones')
    .select('calificacion, num_resenas')
    .eq('publicacion_id', publicacionId)
    .maybeSingle();
  if (error) throw error;
  return (data as { calificacion: number; num_resenas: number } | null) ?? null;
}
