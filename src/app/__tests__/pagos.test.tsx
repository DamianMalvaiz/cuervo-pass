import { act, fireEvent, render, screen } from '@testing-library/react-native';

// Pagos y facturación. «Falló» y «no tienes pagos» se pintan distinto; cada pago dice que es simulado; y NO se presenta
// como una factura.

const mockPagos = jest.fn();
const mockSus = jest.fn();
const mockPlanes = jest.fn();

jest.mock('@/hooks/queries/usePlanes', () => ({
  useMisPagos: (...a: unknown[]) => mockPagos(...a),
  useMiSuscripcion: (...a: unknown[]) => mockSus(...a),
  usePlanes: (...a: unknown[]) => mockPlanes(...a),
}));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }),
}));

import PagosScreen from '../pagos';

const PAGO = {
  id: 'p1', usuario_id: 'u1', rol: 'comerciante', plan_id: 'comerciante_destacado', monto_centavos: 19900, origen: 'simulado',
  periodo_inicio: '2026-10-17T12:00:00Z', periodo_fin: '2026-11-16T12:00:00Z', creado_en: '2026-10-17T12:00:00Z',
};
const SUS = {
  plan_id: 'comerciante_destacado', plan_nombre: 'Destacado', estado: 'vigente', hasta: '2026-11-16T12:00:00Z',
  limite_principal: 3, max_fotos: 60, max_productos: 250, destaca: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPagos.mockReturnValue({ pagos: [PAGO], cargando: false, fallo: false, reintentar: jest.fn() });
  mockSus.mockImplementation((_u: string, rol: string) => ({
    suscripcion: rol === 'comerciante' ? SUS : null, cargando: false, fallo: false, reintentar: jest.fn(),
  }));
  mockPlanes.mockImplementation((rol: string) => ({
    planes: rol === 'comerciante' ? [{ id: 'comerciante_destacado', nombre: 'Destacado' }] : [], cargando: false, fallo: false, reintentar: jest.fn(),
  }));
});

test('lista cada pago con el NOMBRE del plan, el monto y hasta cuándo cubre', async () => {
  await render(<PagosScreen />);
  expect(screen.getByText('Destacado')).toBeTruthy();
  expect(screen.getByText('$199')).toBeTruthy();
  expect(screen.getByText(/cubre hasta el 16 de noviembre de 2026/)).toBeTruthy();
});

test('cada pago dice que es simulado', async () => {
  await render(<PagosScreen />);
  expect(screen.getByText('Simulado (demostración)')).toBeTruthy();
});

test('un pago de Mercado Pago se rotula como tal', async () => {
  mockPagos.mockReturnValue({ pagos: [{ ...PAGO, origen: 'mercadopago' }], cargando: false, fallo: false, reintentar: jest.fn() });
  await render(<PagosScreen />);
  expect(screen.getByText('Mercado Pago')).toBeTruthy();
});

test('muestra el estado de la suscripción solo de las funciones que tienes', async () => {
  await render(<PagosScreen />);
  expect(screen.getByText('Comerciante')).toBeTruthy();
  expect(screen.getByText(/Plan Destacado · vigente hasta el 16 de noviembre de 2026/)).toBeTruthy();
  expect(screen.queryByText('Arrendador')).toBeNull();
});

test('sin pagos lo dice', async () => {
  mockPagos.mockReturnValue({ pagos: [], cargando: false, fallo: false, reintentar: jest.fn() });
  await render(<PagosScreen />);
  expect(screen.getByText('Todavía no has hecho pagos.')).toBeTruthy();
});

test('mientras carga no dice que no hay pagos', async () => {
  mockPagos.mockReturnValue({ pagos: [], cargando: true, fallo: false, reintentar: jest.fn() });
  await render(<PagosScreen />);
  expect(screen.queryByText('Todavía no has hecho pagos.')).toBeNull();
  expect(screen.getByLabelText('Cargando')).toBeTruthy();
});

test('un fallo se dice como fallo y reintenta, no como «no tienes pagos»', async () => {
  const reintentar = jest.fn();
  mockPagos.mockReturnValue({ pagos: [], cargando: false, fallo: true, reintentar });
  await render(<PagosScreen />);
  expect(screen.queryByText('Todavía no has hecho pagos.')).toBeNull();
  await act(async () => { fireEvent.press(screen.getByLabelText('Reintentar')); });
  expect(reintentar).toHaveBeenCalled();
});

test('aclara que esto NO es una factura', async () => {
  await render(<PagosScreen />);
  expect(screen.getByText(/no es una factura/)).toBeTruthy();
});
