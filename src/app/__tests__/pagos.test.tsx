import { act, fireEvent, render, screen } from '@testing-library/react-native';

// «Mi plan y pagos». Lo que se fija: cada función dice en qué plan está con las mismas palabras de siempre, la prueba gratis se ve (días y barra) y se puede
// EMPEZAR si está disponible, «falló» y «no tienes pagos» se pintan distinto, nada dice «simulado» ni «demostración», y NO se presenta como una factura.

const mockPush = jest.fn();
const mockPagos = jest.fn();
const mockSus = jest.fn();
const mockPlanes = jest.fn();

jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
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
  id: 'p1', usuario_id: 'u1', rol: 'comerciante', plan_id: 'comerciante_destacado', monto_centavos: 19900, origen: 'mercadopago',
  periodo_inicio: '2026-10-17T12:00:00Z', periodo_fin: '2026-11-16T12:00:00Z', creado_en: '2026-10-17T12:00:00Z',
};
const VIGENTE = {
  plan_id: 'comerciante_destacado', plan_nombre: 'Destacado', estado: 'vigente', hasta: '2026-11-16T12:00:00Z',
  limite_principal: 3, max_fotos: 60, max_productos: 250, destaca: true, prueba_disponible: false,
};
const enPrueba = (dias: number) => ({
  ...VIGENTE, plan_id: 'comerciante_basico', plan_nombre: 'Básico', estado: 'prueba',
  hasta: new Date(Date.now() + dias * 86_400_000).toISOString(), destaca: false,
});
const sinPlan = (disponible: boolean) => ({
  ...VIGENTE, plan_id: 'comerciante_gratis', plan_nombre: 'Sin plan', estado: 'gratis', hasta: null, destaca: false, prueba_disponible: disponible,
});
const lectura = (suscripcion: unknown) => ({ suscripcion, cargando: false, fallo: false, reintentar: jest.fn() });
const pulsar = async (e: string | RegExp) => { await act(async () => { fireEvent.press(screen.getByLabelText(e)); }); };

beforeEach(() => {
  jest.clearAllMocks();
  mockPagos.mockReturnValue({ pagos: [PAGO], cargando: false, fallo: false, reintentar: jest.fn() });
  mockSus.mockImplementation((_u: string, rol: string) => lectura(rol === 'comerciante' ? VIGENTE : null));
  mockPlanes.mockImplementation((rol: string) => ({
    planes: rol === 'comerciante' ? [{ id: 'comerciante_destacado', nombre: 'Destacado' }] : [], cargando: false, fallo: false, reintentar: jest.fn(),
  }));
});

describe('tu plan', () => {
  it('muestra el plan de cada función que tienes, y solo de esas', async () => {
    await render(<PagosScreen />);
    expect(screen.getByText('Mi plan y pagos')).toBeTruthy();
    expect(screen.getByText('Comerciante')).toBeTruthy();
    expect(screen.getByText(/Plan Destacado · vigente hasta el 16 de noviembre de 2026/)).toBeTruthy();
    expect(screen.queryByText('Arrendador')).toBeNull();
  });

  it('la prueba gratis dice los días que quedan y los enseña en una barra', async () => {
    mockSus.mockImplementation((_u: string, rol: string) => lectura(rol === 'comerciante' ? enPrueba(10) : null));
    await render(<PagosScreen />);
    expect(screen.getByText(/Prueba gratis · te quedan 10 días/)).toBeTruthy();
    expect(screen.getByLabelText('Prueba gratis: quedan 10 de 15 días')).toBeTruthy();
  });

  it('no promete avisos que la base no manda: dice qué pasa al terminar', async () => {
    mockSus.mockImplementation((_u: string, rol: string) => lectura(rol === 'comerciante' ? enPrueba(10) : null));
    await render(<PagosScreen />);
    expect(screen.getByText(/Cuando termine, si no eliges un plan/)).toBeTruthy();
    expect(screen.queryByText(/te avisamos/i)).toBeNull();
  });

  it('con la prueba DISPONIBLE ofrece empezarla, y lleva a su pantalla', async () => {
    mockSus.mockImplementation((_u: string, rol: string) => lectura(rol === 'comerciante' ? sinPlan(true) : null));
    await render(<PagosScreen />);
    expect(screen.getByText(/Todavía no empiezas tu prueba gratis/)).toBeTruthy();
    expect(screen.queryByText(/sin tarjeta/)).toBeNull();
    await pulsar('Empezar prueba gratis');
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/planes/[rol]', params: { rol: 'comerciante' } });
  });

  it('sin plan y sin prueba disponible, dice la verdad y ofrece ver planes', async () => {
    mockSus.mockImplementation((_u: string, rol: string) => lectura(rol === 'comerciante' ? sinPlan(false) : null));
    await render(<PagosScreen />);
    expect(screen.getByText(/Sin plan: tu negocio no aparece en Servicios/)).toBeTruthy();
    expect(screen.queryByLabelText('Empezar prueba gratis')).toBeNull();
  });

  it('«Ver otros planes» lleva a los planes de ESA función', async () => {
    await render(<PagosScreen />);
    await pulsar('Ver otros planes de comerciante');
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/planes/[rol]', params: { rol: 'comerciante' } });
  });
});

describe('el historial', () => {
  it('lista cada pago con el NOMBRE del plan, el monto y hasta cuándo cubre', async () => {
    await render(<PagosScreen />);
    expect(screen.getByText('$199')).toBeTruthy();
    expect(screen.getByText(/cubre hasta el 16 de noviembre de 2026/)).toBeTruthy();
  });

  it('un pago de Mercado Pago se rotula como tal', async () => {
    await render(<PagosScreen />);
    expect(screen.getByText('Mercado Pago')).toBeTruthy();
  });

  // Hay registros históricos de cuando existía el pago de demostración. No se borran, pero tampoco se rotulan «Simulado (demostración)».
  it('un registro antiguo sin cobro NO dice «simulado» ni «demostración»', async () => {
    mockPagos.mockReturnValue({ pagos: [{ ...PAGO, origen: 'simulado' }], cargando: false, fallo: false, reintentar: jest.fn() });
    await render(<PagosScreen />);
    expect(screen.getByText('Activado sin cobro')).toBeTruthy();
    expect(screen.queryByText(/simulado|demostraci/i)).toBeNull();
  });

  it('sin pagos lo dice con claridad', async () => {
    mockPagos.mockReturnValue({ pagos: [], cargando: false, fallo: false, reintentar: jest.fn() });
    await render(<PagosScreen />);
    expect(screen.getByText('Todavía no tienes pagos')).toBeTruthy();
  });

  it('mientras carga no dice que no hay pagos', async () => {
    mockPagos.mockReturnValue({ pagos: [], cargando: true, fallo: false, reintentar: jest.fn() });
    await render(<PagosScreen />);
    expect(screen.queryByText('Todavía no tienes pagos')).toBeNull();
    expect(screen.getByLabelText('Cargando')).toBeTruthy();
  });

  it('un fallo se dice como fallo y reintenta, no como «no tienes pagos»', async () => {
    const reintentar = jest.fn();
    mockPagos.mockReturnValue({ pagos: [], cargando: false, fallo: true, reintentar });
    await render(<PagosScreen />);
    expect(screen.queryByText('Todavía no tienes pagos')).toBeNull();
    await pulsar('Reintentar');
    expect(reintentar).toHaveBeenCalled();
  });

  it('aclara que esto NO es una factura', async () => {
    await render(<PagosScreen />);
    expect(screen.getByText(/no es una factura/)).toBeTruthy();
  });
});
