import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// La pantalla que pide aceptar el aviso de privacidad vigente. Lo que se fija: no deja continuar sin la casilla (que nunca viene
// marcada), el aviso se puede LEER antes de aceptar, aceptar escribe la versión VIGENTE, un fallo se dice y no deja pasar, y quien no
// acepta tiene una salida (cerrar sesión), no un callejón.

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { replace: (...a: unknown[]) => mockReplace(...a), push: (...a: unknown[]) => mockPush(...a) } }));
const mockAceptar = jest.fn();
jest.mock('@/services/aviso.service', () => ({ aceptarAviso: (...a: unknown[]) => mockAceptar(...a) }));
const mockCerrar = jest.fn();
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ cerrarSesion: mockCerrar }) }));
const mockError = jest.fn();
jest.mock('@/lib/toast', () => ({ toast: { error: (...a: unknown[]) => mockError(...a), exito: jest.fn(), info: jest.fn() } }));

import { VERSION_AVISO } from '@/lib/verificacion';

import Pantalla from '../aviso-actualizado';

beforeEach(() => {
  jest.clearAllMocks();
  mockAceptar.mockResolvedValue(undefined);
  mockCerrar.mockResolvedValue(undefined);
});

const aceptar = async () => {
  await fireEvent.press(screen.getByLabelText(/Acepto el aviso de privacidad/));
  await fireEvent.press(screen.getByLabelText('Continuar'));
};

test('explica qué cambió, sobre todo lo de quien vende', async () => {
  await render(<Pantalla />);
  expect(screen.getByText(/Actualizamos el aviso de privacidad/)).toBeTruthy();
  expect(screen.getByText(/INE/)).toBeTruthy();
});

test('la casilla nunca viene marcada', async () => {
  await render(<Pantalla />);
  expect(screen.getByLabelText(/Acepto el aviso de privacidad/).props.accessibilityState).toEqual({ checked: false });
});

test('sin marcar la casilla no se acepta nada', async () => {
  await render(<Pantalla />);
  await fireEvent.press(screen.getByLabelText('Continuar'));
  expect(mockAceptar).not.toHaveBeenCalled();
});

test('el aviso se puede leer antes de aceptarlo', async () => {
  await render(<Pantalla />);
  await fireEvent.press(screen.getByLabelText('Leer el aviso de privacidad'));
  expect(mockPush).toHaveBeenCalledWith('/aviso-privacidad');
});

test('aceptar escribe la versión VIGENTE y vuelve a la entrada', async () => {
  await render(<Pantalla />);
  await aceptar();
  await waitFor(() => expect(mockAceptar).toHaveBeenCalledWith(VERSION_AVISO));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
});

test('si no se pudo registrar, lo dice y NO deja pasar', async () => {
  mockAceptar.mockRejectedValue(new Error('sin red'));
  await render(<Pantalla />);
  await aceptar();
  await waitFor(() => expect(mockError).toHaveBeenCalled());
  expect(String(mockError.mock.calls[0][0])).toMatch(/conexi/i);
  expect(mockReplace).not.toHaveBeenCalled();
});

test('quien no acepta puede cerrar sesión', async () => {
  await render(<Pantalla />);
  await fireEvent.press(screen.getByLabelText('No acepto, cerrar sesión'));
  await waitFor(() => expect(mockCerrar).toHaveBeenCalled());
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/login'));
  expect(mockAceptar).not.toHaveBeenCalled();
});
