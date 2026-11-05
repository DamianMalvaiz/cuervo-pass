import { act, renderHook } from '@testing-library/react-native';

// Si la sesión termina SIN que la persona pulse nada (token revocado, cuenta borrada desde otro dispositivo, refresco que falla), la app tiene que sacarla de las
// pantallas protegidas. Antes se quedaba en ellas, con los datos ya vaciados: pantallas en blanco que parecían un fallo.

const mockIrAlLogin = jest.fn();
jest.mock('@/lib/navegacion', () => ({ irAlLogin: () => mockIrAlLogin() }));

import { useAuthStore } from '@/store/useAuthStore';
import { useVolverAlLoginSiSeCierraLaSesion } from '../use-volver-al-login';

const sesion = { user: { id: 'u1' } } as never;

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ session: null, cargando: false });
});

test('si había sesión y deja de haberla, vuelve al login', async () => {
  useAuthStore.setState({ session: sesion });
  await renderHook(() => useVolverAlLoginSiSeCierraLaSesion());
  expect(mockIrAlLogin).not.toHaveBeenCalled();
  await act(async () => { useAuthStore.setState({ session: null }); });
  expect(mockIrAlLogin).toHaveBeenCalledTimes(1);
});

test('sin sesión desde el arranque NO navega: la pantalla de entrada ya decide adónde ir', async () => {
  await renderHook(() => useVolverAlLoginSiSeCierraLaSesion());
  expect(mockIrAlLogin).not.toHaveBeenCalled();
});

test('iniciar sesión no navega', async () => {
  await renderHook(() => useVolverAlLoginSiSeCierraLaSesion());
  await act(async () => { useAuthStore.setState({ session: sesion }); });
  expect(mockIrAlLogin).not.toHaveBeenCalled();
});

test('cerrar y volver a abrir sesión: navega una vez por cada cierre', async () => {
  useAuthStore.setState({ session: sesion });
  await renderHook(() => useVolverAlLoginSiSeCierraLaSesion());
  await act(async () => { useAuthStore.setState({ session: null }); });
  await act(async () => { useAuthStore.setState({ session: sesion }); });
  await act(async () => { useAuthStore.setState({ session: null }); });
  expect(mockIrAlLogin).toHaveBeenCalledTimes(2);
});
