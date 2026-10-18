import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { clienteDePrueba } from '@pruebas/consultas';

// Moderación desde la app. Lo que se fija: ocultar exige motivo (queda en la bitácora), restaurar pide confirmación, un fallo no se pinta
// como «no hay nada que moderar», y a quien no es admin no se le enseña ni se le pide nada.

let mockAdmin = true;
jest.mock('@/hooks/queries/useRoles', () => ({
  useMisRoles: () => ({ roles: mockAdmin ? [{ rol: 'admin', estado: 'aprobado' }] : [], cargando: false, fallo: false, reintentar: jest.fn() }),
}));
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'a1' } } }) }));
const mockLista = jest.fn();
const mockModerar = jest.fn();
jest.mock('@/services/admin.service', () => ({
  listarModeracion: (...a: unknown[]) => mockLista(...a),
  moderar: (...a: unknown[]) => mockModerar(...a),
  obtenerResumen: jest.fn(),
}));
const mockExito = jest.fn();
const mockError = jest.fn();
jest.mock('@/lib/toast', () => ({ toast: { exito: (...a: unknown[]) => mockExito(...a), error: (...a: unknown[]) => mockError(...a), info: jest.fn() } }));

import { ErrorAdmin } from '@/lib/admin';

import Pantalla from '../moderacion';

const RESENA = { tipo: 'resena', id: 'r1', titulo: 'Tacos La Esquina · 1 estrellas', texto: 'Muy mal', autor: 'juan', reportes: 2, oculto: false, creado_en: '2026-10-18T00:00:00Z' };
const OCULTO = { tipo: 'negocio', id: 'n1', titulo: 'Negocio Raro', texto: null, autor: 'ejemplo', reportes: 0, oculto: true, creado_en: '2026-10-18T00:00:00Z' };

const pintar = () => render(<QueryClientProvider client={clienteDePrueba({ queries: { retry: false } })}><Pantalla /></QueryClientProvider>);
const confirmar = (texto: string) => {
  const botones = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2] as { text: string; onPress?: () => void }[];
  botones.find((b) => b.text === texto)?.onPress?.();
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAdmin = true;
  mockLista.mockResolvedValue([RESENA, OCULTO]);
  mockModerar.mockResolvedValue(undefined);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

test('a quien no es admin no se la enseña ni pide nada', async () => {
  mockAdmin = false;
  await pintar();
  expect(screen.getByText(/No tienes acceso/)).toBeTruthy();
  expect(mockLista).not.toHaveBeenCalled();
});

test('lista lo reportado y lo oculto, con sus reportes', async () => {
  await pintar();
  expect(await screen.findByText('Tacos La Esquina · 1 estrellas')).toBeTruthy();
  expect(screen.getByText(/2 reportes/)).toBeTruthy();
  expect(screen.getByText('Negocio Raro')).toBeTruthy();
  expect(screen.getByText(/Oculto/)).toBeTruthy();
});

test('sin nada que moderar lo dice', async () => {
  mockLista.mockResolvedValue([]);
  await pintar();
  expect(await screen.findByText(/Nada que moderar/)).toBeTruthy();
});

test('un fallo NO se pinta como «nada que moderar»', async () => {
  mockLista.mockRejectedValue(new ErrorAdmin('red'));
  await pintar();
  expect(await screen.findByText(/No pudimos conectar/)).toBeTruthy();
  expect(screen.queryByText(/Nada que moderar/)).toBeNull();
});

test('ocultar sin motivo no manda nada', async () => {
  await pintar();
  await fireEvent.press(await screen.findByLabelText('Ocultar Tacos La Esquina · 1 estrellas'));
  await fireEvent.press(screen.getByLabelText('Confirmar ocultar'));
  expect(mockModerar).not.toHaveBeenCalled();
  expect(await screen.findByText(/Escribe un motivo/)).toBeTruthy();
});

test('ocultar con motivo lo manda', async () => {
  await pintar();
  await fireEvent.press(await screen.findByLabelText('Ocultar Tacos La Esquina · 1 estrellas'));
  await fireEvent.changeText(screen.getByLabelText('Motivo para ocultar'), 'Insulta al negocio');
  await fireEvent.press(screen.getByLabelText('Confirmar ocultar'));
  await waitFor(() => expect(mockModerar).toHaveBeenCalledWith('resena', 'r1', true, 'Insulta al negocio'));
  await waitFor(() => expect(mockExito).toHaveBeenCalled());
});

test('restaurar pide confirmación y no necesita motivo', async () => {
  await pintar();
  await fireEvent.press(await screen.findByLabelText('Restaurar Negocio Raro'));
  expect(mockModerar).not.toHaveBeenCalled();
  confirmar('Restaurar');
  await waitFor(() => expect(mockModerar).toHaveBeenCalledWith('negocio', 'n1', false, null));
});

test('si el servidor falla, lo dice', async () => {
  mockModerar.mockRejectedValue(new ErrorAdmin('no_existe'));
  await pintar();
  await fireEvent.press(await screen.findByLabelText('Restaurar Negocio Raro'));
  confirmar('Restaurar');
  await waitFor(() => expect(mockError).toHaveBeenCalled());
  expect(String(mockError.mock.calls[0][0])).toMatch(/ya no existe/);
});
