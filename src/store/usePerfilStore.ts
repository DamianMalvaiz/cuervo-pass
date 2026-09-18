import { create } from 'zustand';

import { supabase } from '@/lib/supabase';
import type { Usuario } from '@/types/database.types';

// Mi PROPIO perfil, con todas las columnas. La policy usuarios_select_propio
// (migración 0013) hace que esta consulta solo pueda devolver mi fila: para ver
// a otra persona está `perfiles_publicos` (usuarios.service.ts).
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
    // maybeSingle y no single: justo después del signUp puede haber una
    // fracción de segundo antes de que el trigger de alta (§12) escriba la
    // fila, y `single` lanzaría en vez de devolver null.
    const { data, error } = await supabase.from('usuarios').select('*').eq('id', usuarioId).maybeSingle();
    set({ perfil: error ? null : (data as Usuario | null), cargando: false });
  },
  actualizarPerfil: async (usuarioId, cambios) => {
    const { data, error } = await supabase
      .from('usuarios')
      .update(cambios)
      .eq('id', usuarioId)
      .select()
      .single();
    if (error) throw error;
    set({ perfil: (data as Usuario) ?? get().perfil });
  },
}));
