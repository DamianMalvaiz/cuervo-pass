import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { supabase } from '@/lib/supabase';

import { useChatStore } from './useChatStore';
import { usePerfilStore } from './usePerfilStore';

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

// Quien guarda datos de una persona en memoria y no es un store de Zustand
// —la caché de TanStack Query vive en el layout raíz— se apunta aquí para
// vaciarse cuando la sesión termina. El store no importa el cliente de consultas
// porque no es suyo: lo crea `RootLayout` una vez por montaje.
const limpiadoresDeSesion = new Set<() => void>();

/** Registra una función que se ejecuta al terminar la sesión. Devuelve cómo quitarla. */
export function alCerrarSesion(limpiar: () => void): () => void {
  limpiadoresDeSesion.add(limpiar);
  return () => {
    limpiadoresDeSesion.delete(limpiar);
  };
}

/**
 * Deja la memoria como si la app acabara de abrirse.
 *
 * Hallazgo 3 · Antes `cerrarSesion` solo llamaba a `signOut`. La caché y los
 * stores sobrevivían, y la persona que iniciaba sesión después en el mismo
 * teléfono veía un instante sugerencias, roomies y perfil del anterior: varias
 * claves de consulta no llevan el id de usuario, así que la caché no distingue
 * de quién son.
 *
 * Idempotente: se llama desde `cerrarSesion` y desde el listener de
 * `SIGNED_OUT`, y la segunda vez no tiene nada que borrar.
 */
function limpiarMemoriaDeSesion() {
  usePerfilStore.setState({ perfil: null, cargando: false, error: null });
  useChatStore.setState({ mensajesPorConversacion: {}, ordenDeUso: [] });
  // Un limpiador que falla no puede impedir que los demás corran: quedaría
  // memoria ajena sin vaciar, que es justo lo que esto viene a evitar.
  for (const limpiar of limpiadoresDeSesion) {
    try {
      limpiar();
    } catch {
      // Sin nada que hacer aquí: el siguiente limpiador debe correr igual.
    }
  }
}

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
    const { data: suscripcion } = supabase.auth.onAuthStateChange((evento, session) => {
      // La sesión también termina sin que nadie pulse «Cerrar sesión»: token
      // revocado desde otro dispositivo, refresco que falla. Ese camino no pasa
      // por `cerrarSesion`.
      if (evento === 'SIGNED_OUT') limpiarMemoriaDeSesion();
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
    try {
      await supabase.auth.signOut();
    } finally {
      // Aunque `signOut` falle, lo que hay en memoria era de esa persona y no
      // se conserva: es preferible volver a pedirlo que enseñárselo a otra.
      limpiarMemoriaDeSesion();
      set({ session: null });
    }
  },
}));
