import { renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { useAlVolverAPrimerPlano } from '../use-al-volver';

// Al volver de Mercado Pago (o de cualquier otra app) la pantalla tiene que refrescar lo que depende de lo que pasó fuera. `AppState` lo dispara, y
// el cliente de consultas tiene `refetchOnWindowFocus: false` a propósito (ver lib/consultas.ts), así que esto no se hace solo.

let escucha: ((estado: string) => void) | null = null;
const quitar = jest.fn();

beforeEach(() => {
  escucha = null;
  quitar.mockReset();
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_tipo: string, f: (e: string) => void) => {
    escucha = f;
    return { remove: quitar };
  }) as never);
  // El entorno de React Native ya trae `addEventListener` como `jest.fn()`: `spyOn` devuelve ESE mismo mock y `restoreAllMocks` no lo limpia, así que
  // las llamadas se acumularían de una prueba a otra (la cuarta veía 4).
  (AppState.addEventListener as jest.Mock).mockClear();
  Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
});

test('al pasar de segundo plano a primer plano llama a la función, una vez', async () => {
  const fn = jest.fn();
  await renderHook(() => useAlVolverAPrimerPlano(fn));
  escucha?.('background');
  expect(fn).not.toHaveBeenCalled();
  escucha?.('active');
  expect(fn).toHaveBeenCalledTimes(1);
});

test('active → active no cuenta como volver', async () => {
  const fn = jest.fn();
  await renderHook(() => useAlVolverAPrimerPlano(fn));
  escucha?.('active');
  expect(fn).not.toHaveBeenCalled();
});

test('«inactive» (el selector de apps de iOS) tampoco cuenta hasta que vuelve a active', async () => {
  const fn = jest.fn();
  await renderHook(() => useAlVolverAPrimerPlano(fn));
  escucha?.('inactive');
  expect(fn).not.toHaveBeenCalled();
  escucha?.('active');
  expect(fn).toHaveBeenCalledTimes(1);
});

test('usa SIEMPRE la última función, sin volver a suscribirse', async () => {
  const primera = jest.fn();
  const segunda = jest.fn();
  const { rerender } = await renderHook(({ f }: { f: () => void }) => useAlVolverAPrimerPlano(f), { initialProps: { f: primera } });
  await rerender({ f: segunda });
  escucha?.('background');
  escucha?.('active');
  expect(primera).not.toHaveBeenCalled();
  expect(segunda).toHaveBeenCalledTimes(1);
  expect(AppState.addEventListener).toHaveBeenCalledTimes(1);
});

test('deja de escuchar al desmontar', async () => {
  const { unmount } = await renderHook(() => useAlVolverAPrimerPlano(jest.fn()));
  await unmount();
  expect(quitar).toHaveBeenCalledTimes(1);
});
