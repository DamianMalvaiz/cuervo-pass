import { create } from 'zustand';

import type { Mensaje } from '@/types/database.types';

// Documento maestro v5 · §26. La clave de `mensajesPorConversacion` ahora es el
// `conversaciones.id` real de la base, no el id del otro usuario: antes era una
// convención del cliente que no correspondía a nada en el esquema, y por eso la
// lista de chats tenía que reconstruir los hilos agrupando en JavaScript.
//
// Referencia estable para "sin mensajes todavía" — un `?? []` inline en el
// selector crearía un array nuevo en cada render y React (useSyncExternalStore,
// que Zustand usa por dentro) lo detecta como snapshot inestable ("getSnapshot
// should be cached") y advierte de un posible loop infinito.
export const MENSAJES_VACIO: Mensaje[] = [];

interface ChatState {
  mensajesPorConversacion: Record<string, Mensaje[]>;
  agregarMensaje: (conversacionId: string, mensaje: Mensaje) => void;
  actualizarMensaje: (conversacionId: string, mensaje: Mensaje) => void;
  setMensajes: (conversacionId: string, mensajes: Mensaje[]) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  mensajesPorConversacion: {},
  // Deduplica por id aquí (no en el llamador): un mensaje propio se agrega de
  // inmediato al enviarlo, y el eco de Realtime de ese mismo insert llega
  // después — sin este chequeo se duplicaría en pantalla.
  agregarMensaje: (conversacionId, mensaje) =>
    set((state) => {
      const actuales = state.mensajesPorConversacion[conversacionId] ?? [];
      if (actuales.some((m) => m.id === mensaje.id)) return state;
      return {
        mensajesPorConversacion: {
          ...state.mensajesPorConversacion,
          [conversacionId]: [...actuales, mensaje].sort(
            (a, b) => new Date(a.creado_en).getTime() - new Date(b.creado_en).getTime()
          ),
        },
      };
    }),
  // Para eventos UPDATE de Realtime (ej. leido pasó a true) — si no lo tenemos
  // cargado (mensaje de una conversación que no está abierta) no hace nada.
  actualizarMensaje: (conversacionId, mensaje) =>
    set((state) => {
      const actuales = state.mensajesPorConversacion[conversacionId] ?? [];
      const indice = actuales.findIndex((m) => m.id === mensaje.id);
      if (indice === -1) return state;
      const copia = [...actuales];
      copia[indice] = mensaje;
      return { mensajesPorConversacion: { ...state.mensajesPorConversacion, [conversacionId]: copia } };
    }),
  setMensajes: (conversacionId, mensajes) =>
    set((state) => ({
      mensajesPorConversacion: { ...state.mensajesPorConversacion, [conversacionId]: mensajes },
    })),
}));
