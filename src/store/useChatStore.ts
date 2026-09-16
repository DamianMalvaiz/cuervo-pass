import { create } from 'zustand';

import type { Mensaje } from '@/types/database.types';

interface ChatState {
  mensajesPorConversacion: Record<string, Mensaje[]>;
  agregarMensaje: (conversacionId: string, mensaje: Mensaje) => void;
  setMensajes: (conversacionId: string, mensajes: Mensaje[]) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  mensajesPorConversacion: {},
  agregarMensaje: (conversacionId, mensaje) =>
    set((state) => ({
      mensajesPorConversacion: {
        ...state.mensajesPorConversacion,
        [conversacionId]: [...(state.mensajesPorConversacion[conversacionId] ?? []), mensaje].sort(
          (a, b) => new Date(a.creado_en).getTime() - new Date(b.creado_en).getTime()
        ),
      },
    })),
  setMensajes: (conversacionId, mensajes) =>
    set((state) => ({
      mensajesPorConversacion: { ...state.mensajesPorConversacion, [conversacionId]: mensajes },
    })),
}));
