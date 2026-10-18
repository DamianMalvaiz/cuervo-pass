import { act, fireEvent, render, screen } from '@testing-library/react-native';

// «Mi plan» en Configuración: solo con una función de vendedor APROBADA, y lleva a su plan y a los pagos.

const mockPush = jest.fn();
const mockRoles = jest.fn();
const mockSus = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/hooks/queries/useRoles', () => ({ useMisRoles: (...a: unknown[]) => mockRoles(...a) }));
jest.mock('@/hooks/queries/usePlanes', () => ({ useMiSuscripcion: (...a: unknown[]) => mockSus(...a) }));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }),
}));

import { GrupoMiPlan } from '../GrupoMiPlan';

const rol = (r: string, estado: string) => ({ usuario_id: 'u1', rol: r, estado, origen: 'solicitud', desde: 'x' });
const roles = (...r: ReturnType<typeof rol>[]) => ({ roles: r, cargando: false, fallo: false, reintentar: jest.fn() });

beforeEach(() => {
  jest.clearAllMocks();
  mockSus.mockReturnValue({ suscripcion: { plan_nombre: 'Básico' }, cargando: false, fallo: false });
});

test('sin ninguna función aprobada no pinta nada', async () => {
  mockRoles.mockReturnValue(roles(rol('comerciante', 'pendiente')));
  await render(<GrupoMiPlan />);
  expect(screen.queryByText('Mi plan')).toBeNull();
});

test('un comerciante aprobado ve su plan con el nombre a la derecha', async () => {
  mockRoles.mockReturnValue(roles(rol('comerciante', 'aprobado')));
  await render(<GrupoMiPlan />);
  expect(screen.getByText('Mi plan')).toBeTruthy();
  expect(screen.getByText('Plan de comerciante')).toBeTruthy();
  expect(screen.getByText('Básico')).toBeTruthy();
  expect(screen.queryByText('Plan de arrendador')).toBeNull();
});

test('tocar el plan abre su pantalla con la función', async () => {
  mockRoles.mockReturnValue(roles(rol('comerciante', 'aprobado')));
  await render(<GrupoMiPlan />);
  await act(async () => { fireEvent.press(screen.getByLabelText(/Plan de comerciante/)); });
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/planes/[rol]', params: { rol: 'comerciante' } });
});

test('con las dos funciones, un renglón por cada una', async () => {
  mockRoles.mockReturnValue(roles(rol('comerciante', 'aprobado'), rol('arrendador', 'aprobado')));
  await render(<GrupoMiPlan />);
  expect(screen.getByText('Plan de comerciante')).toBeTruthy();
  expect(screen.getByText('Plan de arrendador')).toBeTruthy();
});

test('«Pagos y facturación» lleva al historial', async () => {
  mockRoles.mockReturnValue(roles(rol('arrendador', 'aprobado')));
  await render(<GrupoMiPlan />);
  await act(async () => { fireEvent.press(screen.getByLabelText(/Pagos y facturación/)); });
  expect(mockPush).toHaveBeenCalledWith('/pagos');
});

test('mientras no se sabe el plan, el renglón sigue ahí sin inventar un nombre', async () => {
  mockSus.mockReturnValue({ suscripcion: null, cargando: true, fallo: false });
  mockRoles.mockReturnValue(roles(rol('comerciante', 'aprobado')));
  await render(<GrupoMiPlan />);
  expect(screen.getByText('Plan de comerciante')).toBeTruthy();
  expect(screen.queryByText('Básico')).toBeNull();
});
