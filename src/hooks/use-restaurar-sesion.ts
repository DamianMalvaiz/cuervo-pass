import { useEffect } from 'react';

import { supabaseConfigurado } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * Lee la sesión guardada UNA vez al arrancar la app, sea cual sea la ruta por la que se entró.
 *
 * Antes solo la leía `app/index.tsx`, la pantalla de entrada. Al recargar la web en `/perfil`, o al abrir la app directo en una ruta (un enlace, una notificación con la app cerrada),
 * esa pantalla nunca se montaba: la sesión se quedaba sin leer y la app se comportaba como si no hubiera nadie (Perfil «Sin nombre», Chats y Publicar en blanco). Se usa en el
 * layout raíz, que es lo único que se monta en TODAS las rutas. Llamarla dos veces es inofensivo: `cargarSesionInicial` no duplica su suscripción.
 */
export function useRestaurarSesion() {
  const cargarSesionInicial = useAuthStore((s) => s.cargarSesionInicial);
  useEffect(() => {
    if (supabaseConfigurado) void cargarSesionInicial();
  }, [cargarSesionInicial]);
}
