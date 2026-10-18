import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { clienteDePrueba } from '@pruebas/consultas';

// «Tus funciones» en Mi perfil · Cuervo 360.
//
// Todo usuario es estudiante por defecto (no se guarda). Aquí se ven las funciones que se
// AGREGAN —comerciante, arrendador— con su estado, y se pide una nueva. Pedirla NO da acceso:
// nace sin verificar. La pantalla tiene que decir eso, y distinguir tres cosas que antes se
// habrían colapsado en una: cargando, falló la lectura, y no tienes ninguna función extra.

const mockObtener = jest.fn();
const mockAgregar = jest.fn();
jest.mock('@/services/roles.service', () => ({
  obtenerMisRoles: (...a: unknown[]) => mockObtener(...a),
  agregarFuncion: (...a: unknown[]) => mockAgregar(...a),
}));

const mockExito = jest.fn();
const mockError = jest.fn();
jest.mock('@/lib/toast', () => ({
  toast: {
    exito: (...a: unknown[]) => mockExito(...a),
    error: (...a: unknown[]) => mockError(...a),
    info: jest.fn(),
  },
}));

import { SeccionFunciones } from '../SeccionFunciones';

const pintar = async (extra?: Parameters<typeof clienteDePrueba>[0]) => {
  const cliente = clienteDePrueba(extra);
  return render(
    <QueryClientProvider client={cliente}>
      <SeccionFunciones usuarioId="u1" />
    </QueryClientProvider>
  );
};

const fila = (rol: string, estado: string, origen = 'solicitud') => ({
  usuario_id: 'u1', rol, estado, origen, desde: '2026-10-17T00:00:00Z',
});

/** Pulsa «Agregar» y acepta el aviso de confirmación. */
const confirmarAlerta = () => {
  const botones = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2] as { text: string; onPress?: () => void }[];
  botones.find((b) => b.text === 'Agregar')?.onPress?.();
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockObtener.mockResolvedValue([]);
  mockAgregar.mockResolvedValue(undefined);
});

test('siempre muestra Estudiante, que es implícito', async () => {
  await pintar();
  expect(await screen.findByText('Estudiante')).toBeTruthy();
});

test('las funciones que se pueden pedir se ofrecen como pastillas con «+»', async () => {
  await pintar();
  expect(await screen.findByText('Ofrecer un servicio')).toBeTruthy();
  expect(screen.getByText('Ofrecer un depa o cuarto')).toBeTruthy();
});

test('con una función heredada dice «Heredada» en la pastilla', async () => {
  mockObtener.mockResolvedValue([fila('arrendador', 'aprobado', 'migracion')]);
  await pintar();
  expect(await screen.findByText('Heredada')).toBeTruthy();
});

test('sin funciones extra ofrece agregar las dos', async () => {
  await pintar();
  expect(await screen.findByLabelText(/Agregar función de comerciante/)).toBeTruthy();
  expect(screen.getByLabelText(/Agregar función de arrendador/)).toBeTruthy();
});

test('una función que ya tienes no se vuelve a ofrecer, y dice su estado', async () => {
  mockObtener.mockResolvedValue([fila('comerciante', 'sin_verificar')]);
  await pintar();
  expect(await screen.findByText('Comerciante')).toBeTruthy();
  expect(screen.getByText('Sin verificar')).toBeTruthy();
  expect(screen.getByText(/no te da acceso todavía/)).toBeTruthy();
  expect(screen.queryByLabelText(/Agregar función de comerciante/)).toBeNull();
  expect(screen.getByLabelText(/Agregar función de arrendador/)).toBeTruthy();
});

test('una función migrada lo dice: no es una aprobación revisada', async () => {
  mockObtener.mockResolvedValue([fila('arrendador', 'aprobado', 'migracion')]);
  await pintar();
  expect(await screen.findByText(/migraci/i)).toBeTruthy();
  expect(screen.getByText(/No es una revisión/)).toBeTruthy();
});

// END-11
test('si falla la lectura, lo dice y NO afirma que no tengas funciones', async () => {
  mockObtener.mockRejectedValue(new Error('sin red'));
  // Sin reintentos: con los de producción (2, con espera) el error tarda segundos en declararse.
  await pintar({ queries: { retry: false } });
  expect(await screen.findByText(/No pudimos cargar tus funciones/)).toBeTruthy();
  expect(screen.queryByLabelText(/Agregar función de comerciante/)).toBeNull();
});

test('pedir una función pide confirmación y aclara que no da acceso todavía', async () => {
  await pintar();
  await fireEvent.press(await screen.findByLabelText(/Agregar función de comerciante/));
  expect(Alert.alert).toHaveBeenCalledTimes(1);
  const [titulo, mensaje] = (Alert.alert as jest.Mock).mock.calls[0];
  expect(titulo).toMatch(/comerciante/i);
  expect(mensaje).toMatch(/verific/i);
  expect(mockAgregar).not.toHaveBeenCalled();
});

test('al confirmar, la agrega y avisa que quedó sin verificar', async () => {
  await pintar();
  await fireEvent.press(await screen.findByLabelText(/Agregar función de arrendador/));
  confirmarAlerta();
  await waitFor(() => expect(mockAgregar).toHaveBeenCalledWith('arrendador'));
  await waitFor(() => expect(mockExito).toHaveBeenCalled());
  expect(String(mockExito.mock.calls[0][0])).toMatch(/sin verificar/i);
});

test('si el servidor la rechaza con CP003, lo explica por código', async () => {
  mockAgregar.mockRejectedValue({ code: 'CP003', message: 'funcion no permitida' });
  await pintar();
  await fireEvent.press(await screen.findByLabelText(/Agregar función de comerciante/));
  confirmarAlerta();
  await waitFor(() => expect(mockError).toHaveBeenCalled());
  expect(String(mockError.mock.calls[0][0])).toMatch(/no se puede agregar/i);
});

test('un fallo de red al agregar se dice como fallo de red, no como rechazo', async () => {
  mockAgregar.mockRejectedValue(new Error('Network request failed'));
  await pintar();
  await fireEvent.press(await screen.findByLabelText(/Agregar función de comerciante/));
  confirmarAlerta();
  await waitFor(() => expect(mockError).toHaveBeenCalled());
  expect(String(mockError.mock.calls[0][0])).toMatch(/conexi/i);
});
