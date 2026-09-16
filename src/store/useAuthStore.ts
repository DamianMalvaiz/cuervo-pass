import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { supabase } from '@/lib/supabase';

interface AuthState {
  session: Session | null;
  cargando: boolean;
  iniciarSesion: (email: string, password: string) => Promise<void>;
  registrarse: (email: string, password: string) => Promise<void>;
  cerrarSesion: () => Promise<void>;
  cargarSesionInicial: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  cargando: true,
  cargarSesionInicial: async () => {
    const { data } = await supabase.auth.getSession();
    set({ session: data.session, cargando: false });
    supabase.auth.onAuthStateChange((_evento, session) => {
      set({ session });
    });
  },
  iniciarSesion: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    set({ session: data.session });
  },
  registrarse: async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    set({ session: data.session });
  },
  cerrarSesion: async () => {
    await supabase.auth.signOut();
    set({ session: null });
  },
}));
