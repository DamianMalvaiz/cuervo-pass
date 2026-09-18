// Documento maestro v5 · §13 (abrir_conversacion), §15 (realtime y paginación).
//
// v3 guardaba mensajes sueltos con remitente/destinatario y armaba la lista de
// chats en el cliente: se traía TODOS los mensajes del usuario y los agrupaba
// en JavaScript. Con `conversaciones` (migración 0011) cada consulta es trivial
// y usa un índice que sí existe para ella.

import { supabase } from '@/lib/supabase';
import type { Conversacion, Mensaje, PerfilPublico } from '@/types/database.types';

// AUD-09: v3 no paginaba nada. Una conversación de quinientos mensajes se
// cargaba completa en memoria cada vez que se abría.
export const PAGINA_MENSAJES = 40;

/**
 * AUD-07 — obtener o crear, sin carreras.
 *
 * Nunca se inserta en `conversaciones` desde el cliente: si dos personas se
 * escriben con segundos de diferencia, o alguien toca dos veces el botón, el
 * segundo insert choca contra el índice único y el usuario ve un error crudo
 * justo al iniciar el chat. La función de Postgres converge al mismo id para
 * ambos lados sin lanzar.
 */
export async function abrirConversacion(otroUsuarioId: string): Promise<string> {
  const { data, error } = await supabase.rpc('abrir_conversacion', { p_otro: otroUsuarioId });
  if (error) throw error;
  return data as string;
}

/**
 * Paginación por CURSOR sobre `creado_en`, no por offset: con offset los
 * mensajes nuevos que llegan mientras lees desplazan la ventana y aparecen
 * filas repetidas. El índice (conversacion_id, creado_en desc) existe
 * exactamente para esta consulta.
 *
 * Devuelve del más nuevo al más viejo; la pantalla los invierte para pintar.
 */
export async function listarMensajes(conversacionId: string, cursor?: string): Promise<Mensaje[]> {
  const { data, error } = await supabase
    .from('mensajes')
    .select('*')
    .eq('conversacion_id', conversacionId)
    .lt('creado_en', cursor ?? new Date().toISOString())
    .order('creado_en', { ascending: false })
    .limit(PAGINA_MENSAJES);
  if (error) throw error;
  return (data as Mensaje[]).reverse();
}

export async function enviarMensaje(conversacionId: string, remitenteId: string, contenido: string) {
  const { data, error } = await supabase
    .from('mensajes')
    .insert({ conversacion_id: conversacionId, remitente_id: remitenteId, contenido })
    .select()
    .single();
  if (error) throw error;
  return data as Mensaje;
}

// Solo se tocan los mensajes ajenos y solo la columna `leido`: el trigger
// trg_mensaje_inmutable (migración 0011) rechaza cualquier otro cambio, así que
// esto es la única forma de update que la base acepta desde el cliente.
export async function marcarConversacionComoLeida(conversacionId: string, miId: string) {
  const { error } = await supabase
    .from('mensajes')
    .update({ leido: true })
    .eq('conversacion_id', conversacionId)
    .neq('remitente_id', miId)
    .eq('leido', false);
  if (error) throw error;
}

export interface ResumenConversacion {
  conversacionId: string;
  otroUsuario: Pick<PerfilPublico, 'id' | 'nombre_completo' | 'foto_url'>;
  ultimoMensaje: Mensaje | null;
  noLeidos: number;
}

/**
 * Lista de chats. Tres consultas acotadas en vez de "trae todo y agrupa":
 * las conversaciones (ya ordenadas por la base), el último mensaje de cada una
 * y los perfiles públicos de las contrapartes.
 */
export async function listarConversaciones(miId: string, limite = 30): Promise<ResumenConversacion[]> {
  const { data: conversaciones, error } = await supabase
    .from('conversaciones')
    .select('*')
    .order('ultimo_mensaje_en', { ascending: false })
    .limit(limite);
  if (error) throw error;

  const filas = (conversaciones ?? []) as Conversacion[];
  if (filas.length === 0) return [];

  const ids = filas.map((c) => c.id);
  const otrosIds = filas.map((c) => (c.usuario_a === miId ? c.usuario_b : c.usuario_a));

  const [{ data: mensajes }, { data: perfiles }] = await Promise.all([
    // Acotado a lo que cabe en pantalla: el último mensaje de cada hilo se
    // resuelve en el cliente sobre esta ventana, no sobre el historial entero.
    supabase
      .from('mensajes')
      .select('*')
      .in('conversacion_id', ids)
      .order('creado_en', { ascending: false })
      .limit(limite * PAGINA_MENSAJES),
    supabase.from('perfiles_publicos').select('id, nombre_completo, foto_url').in('id', otrosIds),
  ]);

  const perfilPorId = new Map((perfiles ?? []).map((p) => [p.id as string, p]));
  const ultimoPorConversacion = new Map<string, Mensaje>();
  const noLeidosPorConversacion = new Map<string, number>();

  for (const m of (mensajes ?? []) as Mensaje[]) {
    if (!ultimoPorConversacion.has(m.conversacion_id)) ultimoPorConversacion.set(m.conversacion_id, m);
    if (m.remitente_id !== miId && !m.leido) {
      noLeidosPorConversacion.set(m.conversacion_id, (noLeidosPorConversacion.get(m.conversacion_id) ?? 0) + 1);
    }
  }

  return filas.map((c) => {
    const otroId = c.usuario_a === miId ? c.usuario_b : c.usuario_a;
    const perfil = perfilPorId.get(otroId);
    return {
      conversacionId: c.id,
      otroUsuario: {
        id: otroId,
        // §27: si la contraparte eliminó su cuenta, la conversación se queda sin
        // el otro lado. Se dice, no se muestra una tarjeta en blanco.
        nombre_completo: (perfil?.nombre_completo as string) ?? 'Usuario no disponible',
        foto_url: (perfil?.foto_url as string | null) ?? null,
      },
      ultimoMensaje: ultimoPorConversacion.get(c.id) ?? null,
      noLeidos: noLeidosPorConversacion.get(c.id) ?? 0,
    };
  });
}

/**
 * §15 — suscripción a UNA conversación, filtrada del lado del servidor.
 *
 * Dos cosas que en v3 quedaban ambiguas y producen los bugs típicos de chat:
 *  1. Suscríbete DESPUÉS de tener sesión. Realtime respeta RLS, y un canal
 *     abierto sin sesión no recibe nada — en silencio.
 *  2. El orden lo pone `creado_en`, nunca el orden de llegada del websocket
 *     (lo hace useChatStore).
 *
 * UPDATE además de INSERT: sin eso, marcar como leído del otro lado nunca llega
 * en vivo y el indicador ✓/✓✓ se queda congelado hasta salir y volver a entrar.
 */
export function suscribirseAConversacion(
  conversacionId: string,
  onCambio: (mensaje: Mensaje, evento: 'INSERT' | 'UPDATE') => void
): () => void {
  const filtro = `conversacion_id=eq.${conversacionId}`;
  const canal = supabase
    // Nombre único por conversación: dos canales con el mismo nombre hacen que
    // Supabase reutilice el ya suscrito y truene con "Cannot add
    // postgres_changes callback after subscribe()".
    .channel(`conv:${conversacionId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes', filter: filtro }, (payload) =>
      onCambio(payload.new as Mensaje, 'INSERT')
    )
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mensajes', filter: filtro }, (payload) =>
      onCambio(payload.new as Mensaje, 'UPDATE')
    )
    .subscribe();

  return () => {
    supabase.removeChannel(canal);
  };
}

/** Para la lista de chats: cualquier mensaje nuevo en cualquiera de mis hilos.
 *  RLS ya filtra por suscriptor qué filas llegan a cada quien. */
export function suscribirseAMisChats(onCambio: () => void): () => void {
  const canal = supabase
    .channel(`mis-chats:${Date.now()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, onCambio)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversaciones' }, onCambio)
    .subscribe();

  return () => {
    supabase.removeChannel(canal);
  };
}
