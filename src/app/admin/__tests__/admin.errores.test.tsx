import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { clienteDePrueba } from '@pruebas/consultas';

// Los errores que registra la app, en el panel. Lo que se fija: a quien no es admin no se le enseña ni se le pide nada, un fallo de lectura NO se pinta
// como «todo en orden», cada problema dice cuántas veces, en qué versión y plataforma, y «Ya lo vi» pide confirmación.

let mockAdmin = true;
jest.mock('@/hooks/queries/useRoles', () => ({
  useMisRoles: () => ({ roles: mockAdmin ? [{ rol: 'admin', estado: 'aprobado' }] : [], cargando: false, fallo: false, reintentar: jest.fn() }),
}));
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'a1' } } }) }));
const mockLista = jest.fn();
const mockBorrar = jest.fn();
jest.mock('@/services/admin.service', () => ({
  listarErrores: (...a: unknown[]) => mockLista(...a),
  borrarError: (...a: unknown[]) => mockBorrar(...a),
  obtenerResumen: jest.fn(),
}));
const mockError = jest.fn();
jest.mock('@/lib/toast', () => ({ toast: { error: (...a: unknown[]) => mockError(...a), exito: jest.fn(), info: jest.fn() } }));

import { ErrorAdmin } from '@/lib/admin';

import Pantalla from '../errores';

const E1 = { id: 'e1', nivel: 'error', mensaje: 'No se pudo cargar la lista', detalle: 'sin red', version_app: '1.0.0', plataforma: 'android', conteo: 7, primera_vez: '2026-10-17T10:00:00Z', ultima_vez: '2026-10-18T10:00:00Z' };
const E2 = { ...E1, id: 'e2', nivel: 'aviso', mensaje: 'Foto sin miniatura', detalle: null, conteo: 1, plataforma: 'ios' };

const pintar = () => render(<QueryClientProvider client={clienteDePrueba({ queries: { retry: false } })}><Pantalla /></QueryClientProvider>);
const confirmar = (texto: string) => {
  const botones = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2] as { text: string; onPress?: () => void }[];
  botones.find((b) => b.text === texto)?.onPress?.();
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAdmin = true;
  mockLista.mockResolvedValue([E1, E2]);
  mockBorrar.mockResolvedValue(undefined);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

test('a quien no es admin no se la enseña ni pide nada', async () => {
  mockAdmin = false;
  await pintar();
  expect(screen.getByText(/No tienes acceso/)).toBeTruthy();
  expect(mockLista).not.toHaveBeenCalled();
});

test('cada problema dice cuántas veces, en qué versión y plataforma', async () => {
  await pintar();
  expect(await screen.findByText('No se pudo cargar la lista')).toBeTruthy();
  expect(screen.getByText(/7 veces · v1\.0\.0 · android/)).toBeTruthy();
  expect(screen.getByText(/1 vez · v1\.0\.0 · ios/)).toBeTruthy();
  expect(screen.getByText('sin red')).toBeTruthy();
});

test('los errores van marcados distinto de los avisos', async () => {
  await pintar();
  expect(await screen.findByText('ERROR')).toBeTruthy();
  expect(screen.getByText('AVISO')).toBeTruthy();
});

test('sin problemas lo dice', async () => {
  mockLista.mockResolvedValue([]);
  await pintar();
  expect(await screen.findByText(/Sin errores en la última semana/)).toBeTruthy();
});

test('un fallo de lectura NO se pinta como «sin errores»', async () => {
  mockLista.mockRejectedValue(new ErrorAdmin('red'));
  await pintar();
  expect(await screen.findByText(/No pudimos conectar/)).toBeTruthy();
  expect(screen.queryByText(/Sin errores/)).toBeNull();
});

test('«Ya lo vi» pide confirmación y luego borra ese grupo', async () => {
  await pintar();
  await fireEvent.press(await screen.findByLabelText('Ya lo vi: No se pudo cargar la lista'));
  expect(mockBorrar).not.toHaveBeenCalled();
  confirmar('Ya lo vi');
  await waitFor(() => expect(mockBorrar).toHaveBeenCalledWith('e1'));
});

test('si no se pudo borrar, lo dice', async () => {
  mockBorrar.mockRejectedValue(new ErrorAdmin('no_existe'));
  await pintar();
  await fireEvent.press(await screen.findByLabelText('Ya lo vi: No se pudo cargar la lista'));
  confirmar('Ya lo vi');
  await waitFor(() => expect(mockError).toHaveBeenCalled());
});
