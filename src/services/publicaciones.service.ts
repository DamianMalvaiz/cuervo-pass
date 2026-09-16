import { supabase } from '@/lib/supabase';
import type { Publicacion } from '@/types/database.types';

export async function listarPublicacionesActivas() {
  const { data, error } = await supabase
    .from('publicaciones')
    .select('*')
    .eq('activa', true)
    .order('creado_en', { ascending: false });
  if (error) throw error;
  return data as Publicacion[];
}

export async function listarMisPublicaciones(usuarioId: string) {
  const { data, error } = await supabase
    .from('publicaciones')
    .select('*')
    .eq('usuario_id', usuarioId)
    .order('creado_en', { ascending: false });
  if (error) throw error;
  return data as Publicacion[];
}

// TODO (Semana 3): crear/editar con subida de fotos a Storage (compresión en cliente).
// TODO (Semana 4): geocoding con Mapbox antes de guardar lat/lng.
// TODO (Semana 9): generar y guardar vector_embedding de la descripción.
export async function crearPublicacion(_publicacion: Partial<Publicacion>) {
  throw new Error('crearPublicacion no implementado todavía — Semana 3');
}

export async function desactivarPublicacion(id: string) {
  const { error } = await supabase.from('publicaciones').update({ activa: false }).eq('id', id);
  if (error) throw error;
}

// Registra el match cuando el usuario contacta por WhatsApp (sección 14, "usado de verdad").
export async function registrarMatch(usuarioId: string, publicacionId: string, score: number) {
  const { error } = await supabase
    .from('matches')
    .insert({ usuario_id: usuarioId, publicacion_id: publicacionId, score });
  if (error) throw error;
}
