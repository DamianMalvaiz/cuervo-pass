import { create } from 'zustand';

import { supabase } from '@/lib/supabase';
import type { Usuario } from '@/types/database.types';

interface PerfilState {
  perfil: Usuario | null;
  cargando: boolean;
  setPerfil: (perfil: Usuario | null) => void;
  cargarPerfil: (usuarioId: string) => Promise<void>;
  actualizarPerfil: (usuarioId: string, cambios: Partial<Usuario>) => Promise<void>;
}

export const usePerfilStore = create<PerfilState>((set, get) => ({
  perfil: null,
  cargando: false,
  setPerfil: (perfil) => set({ perfil }),
  cargarPerfil: async (usuarioId) => {
    set({ cargando: true });
    const { data, error } = await supabase.from('usuarios').select('*').eq('id', usuarioId).single();
    set({ perfil: error ? null : (data as Usuario), cargando: false });
  },
  actualizarPerfil: async (usuarioId, cambios) => {
    const { data, error } = await supabase
      .from('usuarios')
      .update(cambios)
      .eq('id', usuarioId)
      .select()
      .single();
    if (error) throw error;
    set({ perfil: data as Usuario ?? get().perfil });
  },
}));
