import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { supabase } from '@/lib/supabase';

// Documento maestro v5 · §12 y §26.

interface DatosRegistro {
  email: string;
  password: string;
  nombreUsuario: string;
  nombreCompleto: string;
}

interface AuthState {
  session: Session | null;
  cargando: boolean;
  iniciarSesion: (email: string, password: string) => Promise<void>;
  registrarse: (datos: DatosRegistro) => Promise<void>;
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
      set({ session, cargando: false });
    });
  },
  iniciarSesion: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    set({ session: data.session });
  },

  // §12: la fila de `usuarios` la crea el trigger handle_new_user a partir de
  // estos metadatos. Antes la insertaba el cliente justo después del signUp, lo
  // que dejaba una ventana en la que existía la cuenta de Auth y no el perfil:
  // si la app se cerraba entre las dos llamadas, la cuenta quedaba rota y nada
  // lo reparaba.
  registrarse: async ({ email, password, nombreUsuario, nombreCompleto }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nombre_usuario: nombreUsuario, nombre_completo: nombreCompleto } },
    });
    if (error) throw error;
    set({ session: data.session });
  },

  cerrarSesion: async () => {
    await supabase.auth.signOut();
    set({ session: null });
  },
}));
