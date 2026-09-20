import { create } from 'zustand';

import type { Mensaje } from '@/types/database.types';

// Documento maestro v5 · §26 · END-19 y END-20.
//
// La clave de `mensajesPorConversacion` es el `conversaciones.id` real de la
// base, no el id del otro usuario: antes era una convención del cliente que no
// correspondía a nada del esquema, y por eso la lista de chats tenía que
// reconstruir los hilos agrupando en JavaScript.
//
// Referencia estable para "sin mensajes todavía" — un `?? []` inline en el
// selector crearía un array nuevo en cada render y React (useSyncExternalStore,
// que Zustand usa por dentro) lo detecta como snapshot inestable
// ("getSnapshot should be cached") y advierte de un posible loop infinito.
export const MENSAJES_VACIO: Mensaje[] = [];

/** Cuántos hilos se retienen en memoria. */
const MAXIMO_RETENIDAS = 3;

/**
 * Un mensaje que todavía no existe en la base.
 *
 * `envio` solo vive en el cliente. Un mensaje confirmado no lo lleva, y esa
 * ausencia es lo que distingue «ya está» de «va en camino» sin un segundo
 * arreglo paralelo que mantener sincronizado.
 */
export type MensajeLocal = Mensaje & { envio?: 'enviando' | 'fallido' };

/**
 * Inserción binaria en un arreglo YA ordenado.
 *
 * Antes se hacía `[...actuales, mensaje].sort(...)` por cada mensaje entrante:
 * reordenar entero una lista que ya estaba ordenada, en una ráfaga de chat, por
 * cada websocket que llega.
 *
 * El desempate por `id` importa: dos mensajes con la misma marca de tiempo
 * ocurren —dos personas escribiendo a la vez—, y sin él su orden dependería de
 * cuál llegó antes por el socket, que no es un orden, es un azar.
 */
function insertarOrdenado(lista: MensajeLocal[], mensaje: MensajeLocal): MensajeLocal[] {
  const clave = (m: MensajeLocal) => `${m.creado_en}|${m.id}`;
  const nueva = clave(mensaje);
  let bajo = 0;
  let alto = lista.length;
  while (bajo < alto) {
    const medio = (bajo + alto) >> 1;
    if (clave(lista[medio]) < nueva) bajo = medio + 1;
    else alto = medio;
  }
  return [...lista.slice(0, bajo), mensaje, ...lista.slice(bajo)];
}

interface ChatState {
  mensajesPorConversacion: Record<string, MensajeLocal[]>;
  /** Las más recientemente usadas al final. Decide a quién se desaloja. */
  ordenDeUso: string[];
  agregarMensaje: (conversacionId: string, mensaje: Mensaje) => void;
  actualizarMensaje: (conversacionId: string, mensaje: Mensaje) => void;
  setMensajes: (conversacionId: string, mensajes: Mensaje[]) => void;
  limpiarConversacion: (conversacionId: string) => void;
  agregarOptimista: (
    conversacionId: string,
    datos: { id: string; contenido: string; remitenteId: string }
  ) => void;
  confirmarOptimista: (conversacionId: string, idTemporal: string, real: Mensaje) => void;
  marcarFallido: (conversacionId: string, idTemporal: string) => void;
  marcarEnviando: (conversacionId: string, idTemporal: string) => void;
}

/**
 * Anota el uso y DESALOJA lo que sobre.
 *
 * El store nunca soltaba nada: abrir veinte chats en una sesión dejaba veinte
 * historiales en memoria hasta matar la app. Tres es lo que cabe en el ir y
 * venir normal entre dos o tres conversaciones, y volver a una cuarta solo
 * cuesta una consulta que además está cacheada.
 */
function anotarUso(
  estado: ChatState,
  conversacionId: string,
  mapa: Record<string, MensajeLocal[]>
): Pick<ChatState, 'mensajesPorConversacion' | 'ordenDeUso'> {
  const orden = [...estado.ordenDeUso.filter((c) => c !== conversacionId), conversacionId];
  const copia = { ...mapa };
  while (orden.length > MAXIMO_RETENIDAS) {
    const vieja = orden.shift();
    if (vieja) delete copia[vieja];
  }
  return { mensajesPorConversacion: copia, ordenDeUso: orden };
}

export const useChatStore = create<ChatState>((set) => ({
  mensajesPorConversacion: {},
  ordenDeUso: [],

  // Deduplica por id aquí y no en el llamador: un mensaje propio se agrega al
  // enviarlo y el eco de Realtime del mismo insert llega después.
  agregarMensaje: (conversacionId, mensaje) =>
    set((estado) => {
      const actuales = estado.mensajesPorConversacion[conversacionId] ?? [];
      if (actuales.some((m) => m.id === mensaje.id)) return estado;
      return anotarUso(estado, conversacionId, {
        ...estado.mensajesPorConversacion,
        [conversacionId]: insertarOrdenado(actuales, mensaje),
      });
    }),

  // Para eventos UPDATE de Realtime (ej. `leido` pasó a true). Si ese mensaje no
  // está cargado —de una conversación que no está abierta— no hace nada.
  actualizarMensaje: (conversacionId, mensaje) =>
    set((estado) => {
      const actuales = estado.mensajesPorConversacion[conversacionId] ?? [];
      const indice = actuales.findIndex((m) => m.id === mensaje.id);
      if (indice === -1) return estado;
      const copia = [...actuales];
      copia[indice] = mensaje;
      return {
        mensajesPorConversacion: { ...estado.mensajesPorConversacion, [conversacionId]: copia },
      };
    }),

  setMensajes: (conversacionId, mensajes) =>
    set((estado) =>
      anotarUso(estado, conversacionId, {
        ...estado.mensajesPorConversacion,
        [conversacionId]: mensajes,
      })
    ),

  limpiarConversacion: (conversacionId) =>
    set((estado) => {
      const copia = { ...estado.mensajesPorConversacion };
      delete copia[conversacionId];
      return {
        mensajesPorConversacion: copia,
        ordenDeUso: estado.ordenDeUso.filter((c) => c !== conversacionId),
      };
    }),

  // ── Envío optimista · END-20 ──────────────────────────────────────────
  // La burbuja aparece ANTES del viaje de ida y vuelta. Esperar a que el
  // servidor confirme para pintar hace que escribir se sienta lento en
  // cualquier red que no sea la de una oficina.
  agregarOptimista: (conversacionId, { id, contenido, remitenteId }) =>
    set((estado) => {
      const actuales = estado.mensajesPorConversacion[conversacionId] ?? [];
      const provisional: MensajeLocal = {
        id,
        conversacion_id: conversacionId,
        remitente_id: remitenteId,
        contenido,
        leido: false,
        creado_en: new Date().toISOString(),
        envio: 'enviando',
      };
      return anotarUso(estado, conversacionId, {
        ...estado.mensajesPorConversacion,
        [conversacionId]: insertarOrdenado(actuales, provisional),
      });
    }),

  confirmarOptimista: (conversacionId, idTemporal, real) =>
    set((estado) => {
      const actuales = estado.mensajesPorConversacion[conversacionId] ?? [];
      // Se quita el provisional y se inserta el real en su sitio: la marca de
      // tiempo que pone el servidor no tiene por qué coincidir con la local.
      const sinProvisional = actuales.filter((m) => m.id !== idTemporal);
      if (sinProvisional.some((m) => m.id === real.id)) {
        // El eco de Realtime llegó antes que la respuesta del insert.
        return {
          mensajesPorConversacion: {
            ...estado.mensajesPorConversacion,
            [conversacionId]: sinProvisional,
          },
        };
      }
      return {
        mensajesPorConversacion: {
          ...estado.mensajesPorConversacion,
          [conversacionId]: insertarOrdenado(sinProvisional, real),
        },
      };
    }),

  marcarFallido: (conversacionId, idTemporal) =>
    set((estado) => marcarEnvio(estado, conversacionId, idTemporal, 'fallido')),

  marcarEnviando: (conversacionId, idTemporal) =>
    set((estado) => marcarEnvio(estado, conversacionId, idTemporal, 'enviando')),
}));

function marcarEnvio(
  estado: ChatState,
  conversacionId: string,
  idTemporal: string,
  envio: 'enviando' | 'fallido'
) {
  const actuales = estado.mensajesPorConversacion[conversacionId] ?? [];
  const indice = actuales.findIndex((m) => m.id === idTemporal);
  if (indice === -1) return estado;
  const copia = [...actuales];
  copia[indice] = { ...copia[indice], envio };
  return { mensajesPorConversacion: { ...estado.mensajesPorConversacion, [conversacionId]: copia } };
}
