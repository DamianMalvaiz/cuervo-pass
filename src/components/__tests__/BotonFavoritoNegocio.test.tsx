import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { clienteDePrueba } from '@pruebas/consultas';

// El corazón de un NEGOCIO (0073): misma conducta que el de publicaciones, con sus propios servicios.
const mockIds = jest.fn();
const mockGuardar = jest.fn();
const mockQuitar = jest.fn();
jest.mock('@/services/favoritos.service', () => ({
  listarMisNegociosFavoritosIds: (...a: unknown[]) => mockIds(...a),
  guardarFavoritoNegocio: (...a: unknown[]) => mockGuardar(...a),
  quitarFavoritoNegocio: (...a: unknown[]) => mockQuitar(...a),
  listarMisNegociosFavoritos: jest.fn(),
}));
const mockError = jest.fn();
jest.mock('@/lib/toast', () => ({ toast: { error: (...a: unknown[]) => mockError(...a), exito: jest.fn(), info: jest.fn() } }));
jest.mock('@/lib/tacto', () => ({ toque: jest.fn(), sello: jest.fn() }));
const mockSesion: { id: string | undefined } = { id: 'u1' };
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: mockSesion.id ? { user: { id: mockSesion.id } } : null }),
}));

import { BotonFavoritoNegocio } from '../BotonFavoritoNegocio';

const pintar = async () =>
  render(
    <QueryClientProvider client={clienteDePrueba({ queries: { retry: false }, mutations: { gcTime: 0 } })}>
      <BotonFavoritoNegocio negocioId="n1" />
    </QueryClientProvider>
  );

// El corazón nace DESACTIVADO mientras no sabe qué hay guardado (por diseño): un toque antes de que cargue no hace nada. Se espera a que se pueda tocar; sin eso el toque se pierde.
const tocar = async (etiqueta: string) => {
  await screen.findByLabelText(etiqueta);
  await waitFor(() => expect(screen.getByLabelText(etiqueta).props.accessibilityState?.disabled).toBe(false));
  await fireEvent.press(screen.getByLabelText(etiqueta));
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSesion.id = 'u1';
  // La lectura inicial TARDA a propósito: con una respuesta instantánea, una prueba que toca el corazón sin esperar a que se active pasa en una máquina rápida y falla en una lenta.
  mockIds.mockImplementation(() => new Promise((r) => setTimeout(() => r([]), 60)));
  mockGuardar.mockResolvedValue(undefined);
  mockQuitar.mockResolvedValue(undefined);
});

test('sin sesión no pinta nada', async () => {
  mockSesion.id = undefined;
  await pintar();
  expect(screen.queryByLabelText(/favoritos/)).toBeNull();
});

test('mientras no sabe qué hay guardado está desactivado (no alterna a ciegas)', async () => {
  mockIds.mockReturnValue(new Promise(() => {}));
  await pintar();
  const b = screen.getByLabelText('Guardar en favoritos');
  expect(b.props.accessibilityState?.disabled).toBe(true);
});

test('guardar manda cuenta y negocio, y el corazón responde al instante', async () => {
  // El servidor, tras guardar, devuelve el negocio en la lista (lo que vuelve a pedir la invalidación).
  mockGuardar.mockImplementation(async () => { mockIds.mockResolvedValue(['n1']); });
  await pintar();
  await tocar('Guardar en favoritos');
  await waitFor(() => expect(mockGuardar).toHaveBeenCalledWith('u1', 'n1'));
  expect(await screen.findByLabelText('Quitar de favoritos')).toBeTruthy();
});

test('guardado: tocar lo quita', async () => {
  mockIds.mockResolvedValue(['n1']);
  await pintar();
  await tocar('Quitar de favoritos');
  await waitFor(() => expect(mockQuitar).toHaveBeenCalledWith('u1', 'n1'));
});

test('el tope de 200 se explica por CÓDIGO (CP004)', async () => {
  mockGuardar.mockRejectedValue({ code: 'CP004', message: 'tope' });
  await pintar();
  await tocar('Guardar en favoritos');
  await waitFor(() => expect(mockError).toHaveBeenCalledWith(expect.stringContaining('tope de 200')));
});

test('otro fallo vuelve el corazón y lo dice', async () => {
  mockGuardar.mockRejectedValue(new Error('sin red'));
  await pintar();
  await tocar('Guardar en favoritos');
  await waitFor(() => expect(mockError).toHaveBeenCalledWith(expect.stringContaining('No pudimos actualizar')));
  expect(await screen.findByLabelText('Guardar en favoritos')).toBeTruthy();
});
