import { act, fireEvent, render, screen } from '@testing-library/react-native';

// «Escribir en la app» · Cuervo 360. El camino principal para contactar a quien publicó.
//
// Contactar dentro de la app deja la conversación DENTRO: se puede moderar, queda constancia y
// «Ver contacto» (WhatsApp) pasa a ser la segunda opción, con su cuota diaria. Abrir la
// conversación crea una fila, así que dos toques seguidos no deben hacerlo dos veces.

const mockAbrirChat = jest.fn();
jest.mock('@/lib/abrirChat', () => ({ abrirChatCon: (...a: unknown[]) => mockAbrirChat(...a) }));
const mockSesion: { id: string | undefined } = { id: 'yo' };
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: mockSesion.id ? { user: { id: mockSesion.id } } : null }),
}));

import { BotonEscribir } from '../BotonEscribir';

beforeEach(() => {
  jest.clearAllMocks();
  mockSesion.id = 'yo';
  mockAbrirChat.mockResolvedValue(undefined);
});

test('dice «Escribir en la app»', async () => {
  await render(<BotonEscribir otroUsuarioId="dueno1" />);
  expect(screen.getByLabelText('Escribir en la app')).toBeTruthy();
});

test('tocar abre el chat con el dueño de la publicación', async () => {
  await render(<BotonEscribir otroUsuarioId="dueno1" />);
  await act(async () => { fireEvent.press(screen.getByLabelText('Escribir en la app')); });
  expect(mockAbrirChat).toHaveBeenCalledWith('dueno1');
});

test('dos toques seguidos abren una sola conversación', async () => {
  let resolver!: () => void;
  mockAbrirChat.mockReturnValue(new Promise<void>((r) => { resolver = r; }));
  await render(<BotonEscribir otroUsuarioId="dueno1" />);
  const boton = screen.getByLabelText('Escribir en la app');
  await act(async () => { fireEvent.press(boton); });
  await act(async () => { fireEvent.press(boton); });
  expect(mockAbrirChat).toHaveBeenCalledTimes(1);
  await act(async () => { resolver(); });
});

test('al terminar se puede volver a usar', async () => {
  await render(<BotonEscribir otroUsuarioId="dueno1" />);
  await act(async () => { fireEvent.press(screen.getByLabelText('Escribir en la app')); });
  await act(async () => { fireEvent.press(screen.getByLabelText('Escribir en la app')); });
  expect(mockAbrirChat).toHaveBeenCalledTimes(2);
});

// La base rechaza escribirse a uno mismo; el botón ni se ofrece.
test('en tu propia publicación no se ofrece', async () => {
  await render(<BotonEscribir otroUsuarioId="yo" />);
  expect(screen.queryByLabelText('Escribir en la app')).toBeNull();
});

test('sin sesión no se ofrece', async () => {
  mockSesion.id = undefined;
  await render(<BotonEscribir otroUsuarioId="dueno1" />);
  expect(screen.queryByLabelText('Escribir en la app')).toBeNull();
});
