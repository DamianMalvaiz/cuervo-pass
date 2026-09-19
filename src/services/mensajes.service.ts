// Documento maestro v5 · §13 (abrir_conversacion), §15 (realtime y paginación).
//
// v3 guardaba mensajes sueltos con remitente/destinatario y armaba la lista de
// chats en el cliente: se traía TODOS los mensajes del usuario y los agrupaba
// en JavaScript. Con `conversaciones` (migración 0012) cada consulta es trivial
// y usa un índice que sí existe para ella.

import { supabase } from '@/lib/supabase';
import type { Mensaje, PerfilPublico } from '@/types/database.types';

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
/** Cursor compuesto: la marca de tiempo NO es única, el par con el id sí. */
export interface CursorMensajes {
  creadoEn: string;
  id: string;
}

/**
 * END-20 · El cursor era solo `creado_en`, con `.lt(...)`.
 *
 * Dos mensajes con la misma marca de tiempo —que ocurre: dos personas escriben
 * a la vez, o una ráfaga entra en el mismo milisegundo— hacían que uno de los
 * dos DESAPARECIERA al paginar. El primero cierra la página, el segundo cae
 * fuera del `<` y nunca se pide. Un mensaje perdido en un chat no es un fallo
 * de rendimiento: es la app borrando algo que alguien escribió.
 *
 * El par `(creado_en, id)` sí es único. La condición «estrictamente anterior»
 * se escribe a mano porque PostgREST no expone comparación de tuplas:
 *
 *     creado_en < X  OR  (creado_en = X AND id < Y)
 */
export async function listarMensajes(
  conversacionId: string,
  cursor?: CursorMensajes
): Promise<Mensaje[]> {
  let consulta = supabase
    .from('mensajes')
    .select('*')
    .eq('conversacion_id', conversacionId);

  if (cursor) {
    consulta = consulta.or(
      `creado_en.lt.${cursor.creadoEn},and(creado_en.eq.${cursor.creadoEn},id.lt.${cursor.id})`
    );
  }

  const { data, error } = await consulta
    // El mismo desempate que la condición, o el orden y el corte discrepan.
    .order('creado_en', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGINA_MENSAJES);
  if (error) throw error;
  return (data as Mensaje[]).reverse();
}

/** El cursor para pedir la página anterior a `mensajes`. */
export function cursorDe(mensajes: Mensaje[]): CursorMensajes | undefined {
  const primero = mensajes[0];
  return primero ? { creadoEn: primero.creado_en, id: primero.id } : undefined;
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
// trg_mensaje_inmutable (migración 0012) rechaza cualquier otro cambio, así que
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
  // END-16 · Una llamada al RPC en vez de traer 1200 mensajes y plegarlos aquí.
  // Treinta hilos son treinta filas. Y el último mensaje sale de CADA hilo, no
  // de una ventana global que un chat activo se comía entera.
  const { data, error } = await supabase.rpc('resumen_conversaciones', { p_limite: limite });
  if (error) throw error;

  const filas = (data ?? []) as {
    conversacion_id: string;
    otro_usuario_id: string;
    ultimo_contenido: string | null;
    ultimo_creado_en: string | null;
    ultimo_remitente_id: string | null;
    ultimo_leido: boolean | null;
    no_leidos: number;
  }[];
  if (filas.length === 0) return [];

  // Los perfiles siguen viniendo aparte: la vista pública es la que decide qué
  // columnas de otra persona se pueden leer (AUD-14), y meterla en el RPC
  // duplicaría esa lista blanca en un segundo sitio.
  const { data: perfiles } = await supabase
    .from('perfiles_publicos')
    .select('id, nombre_completo, foto_url')
    .in('id', filas.map((f) => f.otro_usuario_id));
  const perfilPorId = new Map((perfiles ?? []).map((p) => [p.id as string, p]));

  return filas.map((f) => {
    const perfil = perfilPorId.get(f.otro_usuario_id);
    return {
      conversacionId: f.conversacion_id,
      otroUsuario: {
        id: f.otro_usuario_id,
        // §27: si la contraparte eliminó su cuenta, la conversación se queda sin
        // el otro lado. Se dice, no se muestra una tarjeta en blanco.
        nombre_completo: (perfil?.nombre_completo as string) ?? 'Usuario no disponible',
        foto_url: (perfil?.foto_url as string | null) ?? null,
      },
      ultimoMensaje: f.ultimo_creado_en
        ? ({
            id: `${f.conversacion_id}-ultimo`,
            conversacion_id: f.conversacion_id,
            remitente_id: f.ultimo_remitente_id as string,
            contenido: f.ultimo_contenido as string,
            creado_en: f.ultimo_creado_en,
            leido: Boolean(f.ultimo_leido),
          } as Mensaje)
        : null,
      noLeidos: f.no_leidos,
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
