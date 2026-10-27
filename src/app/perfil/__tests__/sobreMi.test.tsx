import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { useToastStore } from '@/store/useToastStore';

// «Sobre mí»: la biografía, en su propia pantalla (antes era un bloque del perfil de 548 líneas). Las pruebas son las de siempre, movidas aquí:
// el sello de guardar existe SOLO si hay algo sin guardar (un «Guardar» siempre encendido no distingue «ya está» de «te falta»), un fallo se dice,
// y un fallo no da también el aviso de éxito.

const mockActualizarPerfil = jest.fn();
const almacen: { perfil: Record<string, unknown> | null } = { perfil: null };

jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }),
}));
jest.mock('@/store/usePerfilStore', () => ({
  usePerfilStore: () => ({
    perfil: almacen.perfil,
    cargarPerfil: jest.fn(),
    actualizarPerfil: (...a: unknown[]) => mockActualizarPerfil(...a),
  }),
}));

import SobreMiScreen from '../sobre-mi';

const escribir = async (texto: string) => {
  await act(async () => { fireEvent.changeText(screen.getByPlaceholderText(/Cuéntale a otros quién eres/), texto); });
};

beforeEach(() => {
  jest.clearAllMocks();
  almacen.perfil = { id: 'u1', biografia: '' };
  useToastStore.setState({ actual: null });
  mockActualizarPerfil.mockResolvedValue(undefined);
});

it('el sello de guardar no existe si no hay nada sin guardar', async () => {
  await render(<SobreMiScreen />);
  expect(screen.queryByLabelText('Guardar biografía')).toBeNull();
  expect(screen.queryByText('Sin guardar')).toBeNull();

  await escribir('Estudio mecatrónica.');
  expect(screen.getByLabelText('Guardar biografía')).toBeTruthy();
  expect(screen.getByText('Sin guardar')).toBeTruthy();
});

it('una biografía nula no marca «sin guardar» al abrir', async () => {
  almacen.perfil = { id: 'u1', biografia: null };
  await render(<SobreMiScreen />);
  expect(screen.queryByText('Sin guardar')).toBeNull();
  expect(screen.queryByLabelText('Guardar biografía')).toBeNull();
});

it('muestra la que ya tiene guardada', async () => {
  almacen.perfil = { id: 'u1', biografia: 'Soy de Toluca.' };
  await render(<SobreMiScreen />);
  expect(screen.getByDisplayValue('Soy de Toluca.')).toBeTruthy();
});

it('guardar la biografía la manda al perfil y avisa', async () => {
  await render(<SobreMiScreen />);
  await escribir('Estudio mecatrónica.');
  await act(async () => { fireEvent.press(screen.getByLabelText('Guardar biografía')); });

  expect(mockActualizarPerfil).toHaveBeenCalledWith('u1', { biografia: 'Estudio mecatrónica.' });
  await waitFor(() => expect(useToastStore.getState().actual).toMatchObject({ tipo: 'exito', mensaje: 'Biografía guardada' }));
});

it('un fallo al guardar se dice, y NO hay aviso de éxito', async () => {
  mockActualizarPerfil.mockRejectedValue(new Error('no se pudo escribir'));
  await render(<SobreMiScreen />);
  await escribir('Estudio mecatrónica.');
  await act(async () => { fireEvent.press(screen.getByLabelText('Guardar biografía')); });

  expect(await screen.findByText('no se pudo escribir')).toBeTruthy();
  expect(useToastStore.getState().actual).toMatchObject({ tipo: 'error', mensaje: 'no se pudo escribir' });
});

it('cuenta los caracteres y no pasa de 280', async () => {
  await render(<SobreMiScreen />);
  await escribir('Hola');
  expect(screen.getByText('4/280')).toBeTruthy();
  expect(screen.getByPlaceholderText(/Cuéntale a otros quién eres/).props.maxLength).toBe(280);
});
