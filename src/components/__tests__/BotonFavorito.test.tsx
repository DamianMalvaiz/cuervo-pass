import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { clienteDePrueba } from '@pruebas/consultas';

// El corazón de Favoritos · Cuervo 360.
//
// Tres cosas que importan y que fallan calladas:
//  · No alterna A CIEGAS: mientras no sabe qué hay guardado, está desactivado. Tocar sin saber el
//    estado guardaría lo que ya estaba guardado, o quitaría lo que nunca estuvo.
//  · Responde AL INSTANTE (actualización optimista) y, si el servidor falla, VUELVE. Un corazón
//    que se queda lleno tras un fallo afirma que se guardó algo que no se guardó (END-11).
//  · El tope de 200 se explica por CÓDIGO (CP004), no por el texto del error (END-27).

const mockIds = jest.fn();
const mockGuardar = jest.fn();
const mockQuitar = jest.fn();
jest.mock('@/services/favoritos.service', () => ({
  listarMisFavoritosIds: (...a: unknown[]) => mockIds(...a),
  guardarFavorito: (...a: unknown[]) => mockGuardar(...a),
  quitarFavorito: (...a: unknown[]) => mockQuitar(...a),
  listarMisFavoritos: jest.fn(),
}));
const mockError = jest.fn();
jest.mock('@/lib/toast', () => ({ toast: { error: (...a: unknown[]) => mockError(...a), exito: jest.fn(), info: jest.fn() } }));
jest.mock('@/lib/tacto', () => ({ toque: jest.fn(), sello: jest.fn() }));
const mockSesion: { id: string | undefined } = { id: 'u1' };
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: mockSesion.id ? { user: { id: mockSesion.id } } : null }),
}));

import { BotonFavorito } from '../BotonFavorito';

const pintar = async () =>
  render(
    <QueryClientProvider client={clienteDePrueba({ queries: { retry: false } })}>
      <BotonFavorito publicacionId="p1" />
    </QueryClientProvider>
  );

// El corazón nace DESACTIVADO mientras no sabe qué hay guardado (por diseño): un toque antes de que cargue no hace nada. Se espera a que se pueda tocar; sin eso el toque se pierde.
const tocar = async (etiqueta: string) => {
  await screen.findByLabelText(etiqueta);
  await waitFor(() => expect(screen.getByLabelText(etiqueta).props.accessibilityState?.disabled).toBe(false));
  await fireEvent.press(screen.getByLabelText(etiqueta));
};

const guardado = () => screen.queryByLabelText('Quitar de favoritos');
const sinGuardar = () => screen.queryByLabelText('Guardar en favoritos');

beforeEach(() => {
  jest.clearAllMocks();
  mockSesion.id = 'u1';
  // La lectura inicial TARDA a propósito. Con una respuesta instantánea, una prueba que toca el corazón sin esperar a que se active pasa en una máquina rápida y falla en una lenta (así fallaba en el CI, distinto en cada corrida).
  mockIds.mockImplementation(() => new Promise((r) => setTimeout(() => r([]), 60)));
  mockGuardar.mockResolvedValue(undefined);
  mockQuitar.mockResolvedValue(undefined);
});

test('sin guardar: dice «Guardar en favoritos» y no está seleccionado', async () => {
  await pintar();
  const b = await screen.findByLabelText('Guardar en favoritos');
  expect(b.props.accessibilityState?.selected).toBe(false);
});

test('guardado: dice «Quitar de favoritos» y está seleccionado', async () => {
  mockIds.mockResolvedValue(['p1']);
  await pintar();
  const b = await screen.findByLabelText('Quitar de favoritos');
  expect(b.props.accessibilityState?.selected).toBe(true);
});

test('mientras no sabe qué hay guardado, no se puede tocar', async () => {
  mockIds.mockReturnValue(new Promise(() => {}));
  await pintar();
  const b = await screen.findByLabelText('Guardar en favoritos');
  expect(b.props.accessibilityState?.disabled).toBe(true);
  await fireEvent.press(b);
  expect(mockGuardar).not.toHaveBeenCalled();
  expect(mockQuitar).not.toHaveBeenCalled();
});

test('tocar guarda con la cuenta de la sesión', async () => {
  await pintar();
  await tocar('Guardar en favoritos');
  await waitFor(() => expect(mockGuardar).toHaveBeenCalledWith('u1', 'p1'));
});

test('tocar uno guardado lo quita', async () => {
  mockIds.mockResolvedValue(['p1']);
  await pintar();
  await tocar('Quitar de favoritos');
  await waitFor(() => expect(mockQuitar).toHaveBeenCalledWith('u1', 'p1'));
});

test('responde al instante: se ve guardado ANTES de que conteste el servidor', async () => {
  mockGuardar.mockReturnValue(new Promise(() => {}));
  await pintar();
  await tocar('Guardar en favoritos');
  expect(await screen.findByLabelText('Quitar de favoritos')).toBeTruthy();
});

test('si el servidor falla, el corazón VUELVE y se avisa como fallo de conexión', async () => {
  mockGuardar.mockRejectedValue(new Error('Network request failed'));
  await pintar();
  await tocar('Guardar en favoritos');
  await waitFor(() => expect(mockError).toHaveBeenCalled());
  expect(String(mockError.mock.calls[0][0])).toMatch(/conexi/i);
  expect(await screen.findByLabelText('Guardar en favoritos')).toBeTruthy();
  expect(guardado()).toBeNull();
});

test('el tope de 200 se explica por código y el corazón vuelve', async () => {
  mockGuardar.mockRejectedValue({ code: 'CP004', message: 'tope de favoritos alcanzado' });
  await pintar();
  await tocar('Guardar en favoritos');
  await waitFor(() => expect(mockError).toHaveBeenCalled());
  expect(String(mockError.mock.calls[0][0])).toMatch(/200/);
  expect(await screen.findByLabelText('Guardar en favoritos')).toBeTruthy();
});

test('sin sesión no pinta nada', async () => {
  mockSesion.id = undefined;
  await pintar();
  expect(sinGuardar()).toBeNull();
  expect(guardado()).toBeNull();
});

test('mide al menos 44 pt', async () => {
  await pintar();
  const e = StyleSheet.flatten((await screen.findByLabelText('Guardar en favoritos')).props.style) as { minWidth?: number; minHeight?: number };
  expect(e.minWidth).toBeGreaterThanOrEqual(44);
  expect(e.minHeight).toBeGreaterThanOrEqual(44);
});
