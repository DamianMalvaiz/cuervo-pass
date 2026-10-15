// Hallazgo 3 · la caché de consultas sobrevivía al cierre de sesión.
//
// Claves como ['sugerencias', tipo, orden] y ['roomies'] no llevan el id de
// usuario, así que la caché no puede distinguir de quién son los datos. La
// única defensa es vaciarla cuando la sesión termina.

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: () => Promise.resolve({ error: null }),
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: jest.fn() } } }),
    },
  },
}));

import { clienteDePrueba } from '@pruebas/consultas';
import { act, renderHook } from '@testing-library/react-native';

import { useAuthStore } from '@/store/useAuthStore';

import { useLimpiarCacheAlCerrarSesion } from '../useLimpiarCacheAlCerrarSesion';

// `gcTime: Infinity` y no el 0 por omisión del ayudante: aquí el dato tiene que
// SOBREVIVIR hasta que se cierre la sesión. Con 0 se recolectaría al no tener
// observadores y la primera prueba pasaría sin comprobar nada.
const crearCliente = () => clienteDePrueba({ queries: { gcTime: Infinity } });

test('cerrar sesión vacía la caché de consultas', async () => {
  const cliente = crearCliente();
  cliente.setQueryData(['sugerencias', null, 'ajuste'], { datos: ['de Ana'] });
  cliente.setQueryData(['roomies'], ['de Ana']);

  await renderHook(() => useLimpiarCacheAlCerrarSesion(cliente));
  await useAuthStore.getState().cerrarSesion();

  expect(cliente.getQueryData(['sugerencias', null, 'ajuste'])).toBeUndefined();
  expect(cliente.getQueryData(['roomies'])).toBeUndefined();
});

test('al desmontar deja de escuchar', async () => {
  const cliente = crearCliente();
  const { unmount } = await renderHook(() => useLimpiarCacheAlCerrarSesion(cliente));
  await act(async () => {
    unmount();
  });

  cliente.setQueryData(['roomies'], ['intacto']);
  await useAuthStore.getState().cerrarSesion();

  expect(cliente.getQueryData(['roomies'])).toEqual(['intacto']);
});
