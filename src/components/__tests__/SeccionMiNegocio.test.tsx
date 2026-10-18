import { act, fireEvent, render, screen } from '@testing-library/react-native';

// «Mi negocio» en la pestaña Publicar (migración 0052). Tres estados y no dos (END-11); un negocio pausado u oculto por
// reportes se dice; y todo lleva a editar o a crear.

const mockPush = jest.fn();
const mockMisNegocios = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/hooks/queries/useMisNegocios', () => ({ useMisNegocios: (...a: unknown[]) => mockMisNegocios(...a) }));
jest.mock('@/hooks/use-fotos-firmadas', () => ({ useFotosFirmadas: () => ({ urls: new Map(), fallo: null }) }));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }),
}));

import { SeccionMiNegocio } from '../SeccionMiNegocio';

const neg = (extra: Record<string, unknown> = {}) => ({
  id: 'n1', categoria_id: 'comida', nombre: 'Tacos', descripcion: null, direccion: 'Calle 1', latitud: null, longitud: null,
  rango_precio: 1, horario: 'Lun a sáb', fotos: [], destacado: false, origen: 'solicitud', activo: true,
  oculto_por_reportes: false, usuario_id: 'u1', creado_en: 'x', ...extra,
});
const estado = (extra: Record<string, unknown> = {}) => ({
  negocios: [neg()], cargando: false, fallo: false, reintentar: jest.fn(), ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockMisNegocios.mockReturnValue(estado());
});

test('pide los negocios de la cuenta de la sesión', async () => {
  await render(<SeccionMiNegocio />);
  expect(mockMisNegocios).toHaveBeenCalledWith('u1');
});

test('lista mis negocios y tocar uno lo abre para editar', async () => {
  await render(<SeccionMiNegocio />);
  expect(screen.getByText('Mi negocio')).toBeTruthy();
  await act(async () => { fireEvent.press(screen.getByLabelText(/Tacos/)); });
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/negocio/editar/[id]', params: { id: 'n1' } });
});

test('«Nuevo negocio» abre el formulario', async () => {
  await render(<SeccionMiNegocio />);
  await act(async () => { fireEvent.press(screen.getByLabelText('Publicar un negocio nuevo')); });
  expect(mockPush).toHaveBeenCalledWith('/negocio/nuevo');
});

test('un negocio pausado lo dice', async () => {
  mockMisNegocios.mockReturnValue(estado({ negocios: [neg({ activo: false })] }));
  await render(<SeccionMiNegocio />);
  expect(screen.getByText(/Pausado: no aparece en Servicios/)).toBeTruthy();
});

test('uno oculto por reportes lo dice', async () => {
  mockMisNegocios.mockReturnValue(estado({ negocios: [neg({ oculto_por_reportes: true })] }));
  await render(<SeccionMiNegocio />);
  expect(screen.getByText(/Oculto por reportes/)).toBeTruthy();
});

test('uno visible no lleva aviso de pausa ni de reportes', async () => {
  await render(<SeccionMiNegocio />);
  expect(screen.queryByText(/Pausado/)).toBeNull();
  expect(screen.queryByText(/Oculto por reportes/)).toBeNull();
});

test('sin negocios lo dice y ofrece publicar el primero', async () => {
  mockMisNegocios.mockReturnValue(estado({ negocios: [] }));
  await render(<SeccionMiNegocio />);
  expect(screen.getByText(/Todavía no has publicado un negocio/)).toBeTruthy();
});

test('mientras carga no dice que no hay nada', async () => {
  mockMisNegocios.mockReturnValue(estado({ negocios: [], cargando: true }));
  await render(<SeccionMiNegocio />);
  expect(screen.queryByText(/Todavía no has publicado/)).toBeNull();
  expect(screen.getByLabelText('Cargando')).toBeTruthy();
});

test('un fallo se dice como fallo y ofrece reintentar, no como «no tienes negocios»', async () => {
  const reintentar = jest.fn();
  mockMisNegocios.mockReturnValue(estado({ negocios: [], fallo: true, reintentar }));
  await render(<SeccionMiNegocio />);
  expect(screen.queryByText(/Todavía no has publicado/)).toBeNull();
  await act(async () => { fireEvent.press(screen.getByLabelText('Reintentar')); });
  expect(reintentar).toHaveBeenCalled();
});
