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
  detenerEscuchaSesion: () => void;
}

// Fuera del store a propósito: es una suscripción del proceso, no parte del
// estado que la interfaz observa. Meterla en el store haría que cada cambio de
// sesión reevaluara selectores que no dependen de ella.
let cancelarSuscripcionAuth: (() => void) | null = null;

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  cargando: true,
  /**
   * END-19 · La suscripción se guarda y se puede cancelar, y no se registra dos
   * veces.
   *
   * Antes, `onAuthStateChange` se registraba sin guardar nada. Cada llamada a
   * `cargarSesionInicial` —y el layout raíz la llama al montar— dejaba UN
   * listener más, vivo para siempre, todos escribiendo el mismo estado. En
   * desarrollo, con Fast Refresh, eso se acumula en cada guardado.
   *
   * La guarda es lo que hace que llamarla dos veces sea inofensivo, que es lo
   * que un store global tiene que soportar: no controla quién lo llama.
   */
  cargarSesionInicial: async () => {
    const { data } = await supabase.auth.getSession();
    set({ session: data.session, cargando: false });

    if (cancelarSuscripcionAuth) return;
    const { data: suscripcion } = supabase.auth.onAuthStateChange((_evento, session) => {
      set({ session, cargando: false });
    });
    cancelarSuscripcionAuth = () => suscripcion.subscription.unsubscribe();
  },

  /** Cancela la suscripción. Existe para las pruebas y para cerrar limpio. */
  detenerEscuchaSesion: () => {
    cancelarSuscripcionAuth?.();
    cancelarSuscripcionAuth = null;
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
