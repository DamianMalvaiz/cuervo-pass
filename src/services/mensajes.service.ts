import { supabase } from '@/lib/supabase';
import type { Mensaje } from '@/types/database.types';

export async function listarConversacion(usuarioActualId: string, otroUsuarioId: string) {
  const { data, error } = await supabase
    .from('mensajes')
    .select('*')
    .or(
      `and(remitente_id.eq.${usuarioActualId},destinatario_id.eq.${otroUsuarioId}),and(remitente_id.eq.${otroUsuarioId},destinatario_id.eq.${usuarioActualId})`
    )
    .order('creado_en', { ascending: true });
  if (error) throw error;
  return data as Mensaje[];
}

export async function enviarMensaje(remitenteId: string, destinatarioId: string, contenido: string) {
  const { data, error } = await supabase
    .from('mensajes')
    .insert({ remitente_id: remitenteId, destinatario_id: destinatarioId, contenido })
    .select()
    .single();
  if (error) throw error;
  return data as Mensaje;
}

// TODO (Semana 6): suscripción a Supabase Realtime, ordenar siempre por creado_en
// (nunca por orden de llegada del websocket — ver sección 17).
export function suscribirseAConversacion(_usuarioActualId: string, _onMensaje: (mensaje: Mensaje) => void) {
  throw new Error('suscribirseAConversacion no implementado todavía — Semana 6');
}
