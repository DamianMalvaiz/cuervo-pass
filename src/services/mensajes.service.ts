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

export async function marcarConversacionComoLeida(usuarioActualId: string, otroUsuarioId: string) {
  const { error } = await supabase
    .from('mensajes')
    .update({ leido: true })
    .eq('destinatario_id', usuarioActualId)
    .eq('remitente_id', otroUsuarioId)
    .eq('leido', false);
  if (error) throw error;
}

// Última fila por contraparte + conteo de no leídos, para la lista de "Chats"
// (sección 9: "lista de conversaciones con último mensaje y hora"). Se agrupa
// en el cliente porque son pocos mensajes por usuario en la demo — si esto
// crece, conviene una vista/función SQL en vez de traer todas las filas.
export interface ResumenConversacion {
  otroUsuarioId: string;
  ultimoMensaje: Mensaje;
  noLeidos: number;
}

export async function listarConversaciones(usuarioId: string): Promise<ResumenConversacion[]> {
  const { data, error } = await supabase
    .from('mensajes')
    .select('*')
    .or(`remitente_id.eq.${usuarioId},destinatario_id.eq.${usuarioId}`)
    .order('creado_en', { ascending: false });
  if (error) throw error;

  const porUsuario = new Map<string, ResumenConversacion>();
  for (const mensaje of data as Mensaje[]) {
    const otroUsuarioId = mensaje.remitente_id === usuarioId ? mensaje.destinatario_id : mensaje.remitente_id;
    if (!porUsuario.has(otroUsuarioId)) {
      porUsuario.set(otroUsuarioId, { otroUsuarioId, ultimoMensaje: mensaje, noLeidos: 0 });
    }
    if (mensaje.destinatario_id === usuarioId && !mensaje.leido) {
      porUsuario.get(otroUsuarioId)!.noLeidos += 1;
    }
  }
  return Array.from(porUsuario.values());
}

// Realtime (sección 20, semana 6): RLS ("solo participantes ven sus mensajes",
// migración 0001) ya filtra por suscriptor qué filas le llegan a cada quien —
// no hace falta (ni se puede, de forma segura) filtrar por otro_usuario_id
// aquí; el llamador descarta lo que no sea de la conversación que le importa.
// Requiere la tabla en la publicación `supabase_realtime` (migración 0004).
//
// Nombre de canal único por llamada: la pantalla de Chats y la de Conversación
// pueden estar suscritas al mismo tiempo, y si dos llamadas usan el mismo
// nombre, Supabase reutiliza el canal ya "subscribe()"-ado y truena con
// "Cannot add postgres_changes callback ... after subscribe()".
let contadorCanales = 0;

// UPDATE además de INSERT: sin esto, marcar un mensaje como leído (ej. al abrir
// el chat del otro lado) nunca llega en vivo a una conversación ya abierta —
// el indicador ✓/✓✓ se quedaba en ✓ hasta salir y volver a entrar.
export function suscribirseAMensajes(onCambio: (mensaje: Mensaje, evento: 'INSERT' | 'UPDATE') => void): () => void {
  const canal = supabase
    .channel(`mensajes-en-vivo-${++contadorCanales}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, (payload) => {
      onCambio(payload.new as Mensaje, 'INSERT');
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mensajes' }, (payload) => {
      onCambio(payload.new as Mensaje, 'UPDATE');
    })
    .subscribe();

  return () => {
    supabase.removeChannel(canal);
  };
}
