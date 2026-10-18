import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { clienteDePrueba } from '@pruebas/consultas';

// La pantalla de inicio del panel. Lo que se fija: no se enseña a quien no es admin, se dicen los TRES estados (cargando, falló, datos),
// y el modo demo pide confirmación porque enciende pagos simulados para todos.

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
let mockRoles: { rol: string; estado: string }[] = [{ rol: 'admin', estado: 'aprobado' }];
jest.mock('@/hooks/queries/useRoles', () => ({ useMisRoles: () => ({ roles: mockRoles, cargando: false, fallo: false, reintentar: jest.fn() }) }));
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'a1' } } }) }));
const mockResumen = jest.fn();
const mockFijar = jest.fn();
jest.mock('@/services/admin.service', () => ({
  obtenerResumen: (...a: unknown[]) => mockResumen(...a),
  fijarModoDemo: (...a: unknown[]) => mockFijar(...a),
  listarVerificaciones: jest.fn(),
  listarModeracion: jest.fn(),
}));
const mockError = jest.fn();
jest.mock('@/lib/toast', () => ({ toast: { error: (...a: unknown[]) => mockError(...a), exito: jest.fn(), info: jest.fn() } }));

import { ErrorAdmin } from '@/lib/admin';

import Pantalla from '../index';

const RESUMEN = {
  verificaciones_pendientes: 2, resenas_reportadas: 1, resenas_ocultas: 3, negocios_ocultos: 0, cuentas: 106, negocios_activos: 26, modo_demo: false,
};

const pintar = () => render(<QueryClientProvider client={clienteDePrueba({ queries: { retry: false } })}><Pantalla /></QueryClientProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  mockRoles = [{ rol: 'admin', estado: 'aprobado' }];
  mockResumen.mockResolvedValue(RESUMEN);
  mockFijar.mockResolvedValue(true);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

test('a quien no es admin no le enseña el panel ni pide nada al servidor', async () => {
  mockRoles = [{ rol: 'comerciante', estado: 'aprobado' }];
  await pintar();
  expect(screen.getByText(/No tienes acceso/)).toBeTruthy();
  expect(mockResumen).not.toHaveBeenCalled();
});

test('un admin NO aprobado tampoco', async () => {
  mockRoles = [{ rol: 'admin', estado: 'pendiente' }];
  await pintar();
  expect(screen.getByText(/No tienes acceso/)).toBeTruthy();
});

test('muestra las cifras del resumen', async () => {
  await pintar();
  expect(await screen.findByText('2 pendientes')).toBeTruthy();
  expect(screen.getByLabelText(/Moderación/)).toBeTruthy();
});

test('un fallo se dice como fallo y NO como «0 pendientes»', async () => {
  mockResumen.mockRejectedValue(new ErrorAdmin('red'));
  await pintar();
  expect(await screen.findByText(/No pudimos conectar/)).toBeTruthy();
  expect(screen.queryByText(/pendientes/)).toBeNull();
  expect(screen.getByLabelText('Reintentar')).toBeTruthy();
});

test('un 403 del servidor lo dice, aunque la pantalla creyera que eras admin', async () => {
  mockResumen.mockRejectedValue(new ErrorAdmin('prohibido'));
  await pintar();
  expect(await screen.findByText(/no tiene permiso/)).toBeTruthy();
});

test('los renglones llevan a verificaciones y a moderación', async () => {
  await pintar();
  await fireEvent.press(await screen.findByLabelText(/Verificaciones/));
  expect(mockPush).toHaveBeenCalledWith('/admin/verificaciones');
  await fireEvent.press(screen.getByLabelText(/Moderación/));
  expect(mockPush).toHaveBeenCalledWith('/admin/moderacion');
});

test('encender el modo demo pide confirmación y dice que los pagos son simulados', async () => {
  await pintar();
  await screen.findByText('2 pendientes');
  await fireEvent(screen.getByLabelText(/Modo de demostración/), 'valueChange', true);
  expect(Alert.alert).toHaveBeenCalled();
  const [titulo, mensaje] = (Alert.alert as jest.Mock).mock.calls[0];
  expect(titulo).toMatch(/modo de demostración/i);
  expect(mensaje).toMatch(/simulad/i);
  expect(mockFijar).not.toHaveBeenCalled();
});

test('al confirmar, lo enciende', async () => {
  await pintar();
  await screen.findByText('2 pendientes');
  await fireEvent(screen.getByLabelText(/Modo de demostración/), 'valueChange', true);
  const botones = (Alert.alert as jest.Mock).mock.calls[0][2] as { text: string; onPress?: () => void }[];
  botones.find((b) => b.text === 'Encender')?.onPress?.();
  await waitFor(() => expect(mockFijar).toHaveBeenCalledWith(true));
});

test('si no se pudo cambiar, lo dice', async () => {
  mockFijar.mockRejectedValue(new ErrorAdmin('red'));
  await pintar();
  await screen.findByText('2 pendientes');
  await fireEvent(screen.getByLabelText(/Modo de demostración/), 'valueChange', true);
  const botones = (Alert.alert as jest.Mock).mock.calls[0][2] as { text: string; onPress?: () => void }[];
  botones.find((b) => b.text === 'Encender')?.onPress?.();
  await waitFor(() => expect(mockError).toHaveBeenCalled());
});
