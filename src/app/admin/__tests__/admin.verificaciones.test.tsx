import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { clienteDePrueba } from '@pruebas/consultas';

// Revisar verificaciones desde la app. Lo que se fija: ver documentos pide confirmación (queda registrado), aprobar y rechazar también,
// rechazar exige motivo, un fallo no se pinta como «no hay pendientes», y la comparación de rostro se presenta como AYUDA.

let mockAdmin = true;
jest.mock('@/hooks/queries/useRoles', () => ({
  useMisRoles: () => ({ roles: mockAdmin ? [{ rol: 'admin', estado: 'aprobado' }] : [], cargando: false, fallo: false, reintentar: jest.fn() }),
}));
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'a1' } } }) }));
const mockLista = jest.fn();
const mockDocs = jest.fn();
const mockResolver = jest.fn();
jest.mock('@/services/admin.service', () => ({
  listarVerificaciones: (...a: unknown[]) => mockLista(...a),
  documentosDe: (...a: unknown[]) => mockDocs(...a),
  resolverVerificacion: (...a: unknown[]) => mockResolver(...a),
  obtenerResumen: jest.fn(),
}));
const mockExito = jest.fn();
const mockError = jest.fn();
jest.mock('@/lib/toast', () => ({ toast: { exito: (...a: unknown[]) => mockExito(...a), error: (...a: unknown[]) => mockError(...a), info: jest.fn() } }));

import { ErrorAdmin } from '@/lib/admin';

import Pantalla from '../verificaciones';

const U = '00000000-0000-0000-0000-0000000000f7';
const FILA = {
  usuario_id: U, rol: 'comerciante', nombre_usuario: 'damian', nombre_legal: 'Persona De Muestra', direccion: 'Calle 1, Lerma',
  enviada_en: '2026-10-18T05:56:15Z', version_aviso: 'v3', fotos_del_lugar: 1, rostro_estado: null,
};

const pintar = () => render(<QueryClientProvider client={clienteDePrueba({ queries: { retry: false } })}><Pantalla /></QueryClientProvider>);

const confirmarAlerta = (texto: string) => {
  const botones = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2] as { text: string; onPress?: () => void }[];
  botones.find((b) => b.text === texto)?.onPress?.();
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAdmin = true;
  mockLista.mockResolvedValue([FILA]);
  mockDocs.mockResolvedValue([{ etiqueta: 'INE (frente)', url: 'https://ejemplo.test/a.jpg' }]);
  mockResolver.mockResolvedValue(undefined);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

test('a quien no es admin no se la enseña ni pide nada', async () => {
  mockAdmin = false;
  await pintar();
  expect(screen.getByText(/No tienes acceso/)).toBeTruthy();
  expect(mockLista).not.toHaveBeenCalled();
});

test('lista las pendientes con lo que se necesita para decidir', async () => {
  await pintar();
  expect(await screen.findByText('Persona De Muestra')).toBeTruthy();
  expect(screen.getByText(/Calle 1, Lerma/)).toBeTruthy();
  expect(screen.getByText(/damian/)).toBeTruthy();
});

test('sin pendientes lo dice', async () => {
  mockLista.mockResolvedValue([]);
  await pintar();
  expect(await screen.findByText(/No hay verificaciones pendientes/)).toBeTruthy();
});

test('un fallo NO se pinta como «no hay pendientes»', async () => {
  mockLista.mockRejectedValue(new ErrorAdmin('red'));
  await pintar();
  expect(await screen.findByText(/No pudimos conectar/)).toBeTruthy();
  expect(screen.queryByText(/No hay verificaciones pendientes/)).toBeNull();
});

test('ver los documentos pide confirmación y avisa que queda registrado', async () => {
  await pintar();
  await fireEvent.press(await screen.findByLabelText('Ver documentos de Persona De Muestra'));
  expect(Alert.alert).toHaveBeenCalled();
  expect(String((Alert.alert as jest.Mock).mock.calls[0][1])).toMatch(/registrad/i);
  expect(mockDocs).not.toHaveBeenCalled();
});

test('al confirmar, pide los documentos y los muestra', async () => {
  await pintar();
  await fireEvent.press(await screen.findByLabelText('Ver documentos de Persona De Muestra'));
  confirmarAlerta('Ver');
  await waitFor(() => expect(mockDocs).toHaveBeenCalledWith(U, 'comerciante'));
  expect(await screen.findByText('INE (frente)')).toBeTruthy();
});

test('si no se pueden pedir los documentos, lo dice', async () => {
  mockDocs.mockRejectedValue(new ErrorAdmin('red'));
  await pintar();
  await fireEvent.press(await screen.findByLabelText('Ver documentos de Persona De Muestra'));
  confirmarAlerta('Ver');
  await waitFor(() => expect(mockError).toHaveBeenCalled());
});

test('aprobar pide confirmación y manda la decisión', async () => {
  await pintar();
  await fireEvent.press(await screen.findByLabelText('Aprobar a Persona De Muestra'));
  expect(mockResolver).not.toHaveBeenCalled();
  confirmarAlerta('Aprobar');
  await waitFor(() => expect(mockResolver).toHaveBeenCalledWith(U, 'comerciante', true, null));
  await waitFor(() => expect(mockExito).toHaveBeenCalled());
});

test('rechazar sin motivo no manda nada', async () => {
  await pintar();
  await fireEvent.press(await screen.findByLabelText('Rechazar a Persona De Muestra'));
  await fireEvent.press(screen.getByLabelText('Confirmar rechazo'));
  expect(mockResolver).not.toHaveBeenCalled();
  expect(await screen.findByText(/Escribe un motivo/)).toBeTruthy();
});

test('rechazar con motivo lo manda', async () => {
  await pintar();
  await fireEvent.press(await screen.findByLabelText('Rechazar a Persona De Muestra'));
  await fireEvent.changeText(screen.getByLabelText('Motivo del rechazo'), 'La INE no se lee');
  await fireEvent.press(screen.getByLabelText('Confirmar rechazo'));
  await waitFor(() => expect(mockResolver).toHaveBeenCalledWith(U, 'comerciante', false, 'La INE no se lee'));
});

test('si el servidor dice que ya no está pendiente, lo dice', async () => {
  mockResolver.mockRejectedValue(new ErrorAdmin('no_pendiente'));
  await pintar();
  await fireEvent.press(await screen.findByLabelText('Aprobar a Persona De Muestra'));
  confirmarAlerta('Aprobar');
  await waitFor(() => expect(mockError).toHaveBeenCalled());
  expect(String(mockError.mock.calls[0][0])).toMatch(/ya no está pendiente/);
});

test('la comparación de rostro se presenta como ayuda, no como decisión', async () => {
  mockLista.mockResolvedValue([{ ...FILA, rostro_estado: 'no_vivo' }]);
  await pintar();
  expect(await screen.findByText(/Comparación de rostro/)).toBeTruthy();
  expect(screen.getByText(/ayuda/i)).toBeTruthy();
});
