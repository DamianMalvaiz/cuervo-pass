// Abrir un chat dentro de la app · Cuervo 360.
//
// La función de la base falla con `raise exception` (SQLSTATE P0001) cuando el destinatario no es
// válido o ya no está activo. Antes TODO fallo se decía «esta persona ya no está disponible»,
// incluida una caída de red: la app afirmaba algo sobre otra persona que no era cierto (END-11).
// Se distingue por CÓDIGO (END-27), no por el texto del error.

const mockAbrir = jest.fn();
jest.mock('@/services/mensajes.service', () => ({ abrirConversacion: (...a: unknown[]) => mockAbrir(...a) }));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
const mockError = jest.fn();
jest.mock('@/lib/toast', () => ({ toast: { error: (...a: unknown[]) => mockError(...a), exito: jest.fn(), info: jest.fn() } }));
jest.mock('@/lib/registro', () => ({ aviso: jest.fn(), fallo: jest.fn() }));

import { abrirChatCon } from '../abrirChat';

beforeEach(() => jest.clearAllMocks());

test('abre la conversación con esa persona y navega a ella', async () => {
  mockAbrir.mockResolvedValue('conv-1');
  await abrirChatCon('otro1');
  expect(mockAbrir).toHaveBeenCalledWith('otro1');
  expect(mockPush).toHaveBeenCalledWith('/chat/conv-1');
  expect(mockError).not.toHaveBeenCalled();
});

test('si la persona ya no está disponible (P0001) lo dice así y no navega', async () => {
  mockAbrir.mockRejectedValue({ code: 'P0001', message: 'usuario no disponible' });
  await abrirChatCon('otro1');
  expect(String(mockError.mock.calls[0][0])).toMatch(/ya no está disponible/i);
  expect(mockPush).not.toHaveBeenCalled();
});

// END-11: un fallo de red NO es «esta persona ya no está disponible».
test('un fallo de red se dice como fallo de conexión, no como si la persona hubiera desaparecido', async () => {
  mockAbrir.mockRejectedValue(new Error('Network request failed'));
  await abrirChatCon('otro1');
  const texto = String(mockError.mock.calls[0][0]);
  expect(texto).toMatch(/conexi/i);
  expect(texto).not.toMatch(/ya no está disponible/i);
  expect(mockPush).not.toHaveBeenCalled();
});

test('nunca lanza: la pantalla que lo llama no tiene que envolverlo', async () => {
  mockAbrir.mockRejectedValue(new Error('boom'));
  await expect(abrirChatCon('otro1')).resolves.toBeUndefined();
});

// 0082 · una cuenta sin correo universitario no abre conversaciones nuevas (responde en las que ya existen). Se dice POR CÓDIGO y con la razón
// verdadera: decir «revisa tu conexión» a quien está restringida sería mentirle, y «esta persona no está disponible» también.
test('una cuenta restringida (CP016) recibe la razón verdadera y no navega', async () => {
  mockAbrir.mockRejectedValue({ code: 'CP016', message: 'cuenta restringida' });
  await abrirChatCon('otro1');
  expect(mockPush).not.toHaveBeenCalled();
  expect(mockError).toHaveBeenCalledWith(expect.stringMatching(/no puede iniciar conversaciones/i));
  expect(mockError).not.toHaveBeenCalledWith(expect.stringMatching(/conexión|ya no está disponible/i));
});
