import { renderHook } from '@testing-library/react-native';

// La sesión guardada se lee al ARRANCAR la app, no cuando se visita una pantalla concreta. Antes solo la leía `app/index.tsx`: al recargar la web en `/perfil`, o al abrir la app
// directo en una ruta (un enlace, una notificación con la app cerrada), esa pantalla nunca se montaba y todo se quedaba como sin sesión: Perfil «Sin nombre», Chats y Publicar en blanco.

const mockCargar = jest.fn();
let mockConfigurado = true;
jest.mock('@/lib/supabase', () => ({
  get supabaseConfigurado() {
    return mockConfigurado;
  },
}));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ cargarSesionInicial: mockCargar }),
}));

import { useRestaurarSesion } from '../use-restaurar-sesion';

beforeEach(() => {
  jest.clearAllMocks();
  mockConfigurado = true;
});

test('lee la sesión guardada al montarse', async () => {
  await renderHook(() => useRestaurarSesion());
  expect(mockCargar).toHaveBeenCalledTimes(1);
});

test('sin Supabase configurado no intenta leerla (la pantalla de entrada ya lo dice)', async () => {
  mockConfigurado = false;
  await renderHook(() => useRestaurarSesion());
  expect(mockCargar).not.toHaveBeenCalled();
});

test('no la vuelve a leer en cada render', async () => {
  const { rerender } = await renderHook(() => useRestaurarSesion());
  await rerender({});
  await rerender({});
  expect(mockCargar).toHaveBeenCalledTimes(1);
});
