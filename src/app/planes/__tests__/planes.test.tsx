import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

// Planes y suscripciones. Lo que se fija: dice la verdad sobre en qué plan estás, avisa SIEMPRE que el pago es de
// demostración, confirma antes de contratar, y cada fallo se dice por su código sin inventar éxitos.

const mockParams = { rol: 'comerciante' };
const mockSus = jest.fn();
const mockPlanes = jest.fn();
const mockMutate = jest.fn();
const mockExito = jest.fn();
const mockError = jest.fn();

jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams }));
jest.mock('@/hooks/queries/usePlanes', () => ({
  useMiSuscripcion: (...a: unknown[]) => mockSus(...a),
  usePlanes: (...a: unknown[]) => mockPlanes(...a),
  useContratarPlan: () => ({ mutate: (...a: unknown[]) => mockMutate(...a), isPending: false }),
}));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }),
}));
jest.mock('@/lib/toast', () => ({
  toast: { exito: (...a: unknown[]) => mockExito(...a), error: (...a: unknown[]) => mockError(...a), info: jest.fn() },
}));

import PlanesScreen from '../[rol]';

const SUS = {
  plan_id: 'comerciante_basico', plan_nombre: 'Básico', estado: 'prueba', hasta: new Date(Date.now() + 15 * 86_400_000).toISOString(),
  limite_principal: 1, max_fotos: 20, max_productos: 80, destaca: false,
};
const PLANES = [
  { id: 'comerciante_basico', rol: 'comerciante', nombre: 'Básico', precio_centavos: 9900, limite_principal: 1, max_fotos: 20, max_productos: 80, destaca: false, es_prueba: true, orden: 1 },
  { id: 'comerciante_destacado', rol: 'comerciante', nombre: 'Destacado', precio_centavos: 19900, limite_principal: 3, max_fotos: 60, max_productos: 250, destaca: true, es_prueba: false, orden: 2 },
];
const lectura = (extra: Record<string, unknown> = {}) => ({ suscripcion: SUS, cargando: false, fallo: false, reintentar: jest.fn(), ...extra });
const catalogo = (extra: Record<string, unknown> = {}) => ({ planes: PLANES, cargando: false, fallo: false, reintentar: jest.fn(), ...extra });

const pulsar = async (e: string | RegExp) => { await act(async () => { fireEvent.press(screen.getByLabelText(e)); }); };
const confirmar = () => {
  const botones = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2] as { text: string; onPress?: () => void }[];
  botones.find((b) => b.text === 'Contratar')?.onPress?.();
};

beforeEach(() => {
  jest.clearAllMocks();
  mockParams.rol = 'comerciante';
  mockSus.mockReturnValue(lectura());
  mockPlanes.mockReturnValue(catalogo());
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('qué dice', () => {
  it('muestra tu plan actual y cuántos días de prueba quedan', async () => {
    await render(<PlanesScreen />);
    expect(screen.getByText('Planes de comerciante')).toBeTruthy();
    expect(screen.getByText('Tu plan actual')).toBeTruthy();
    expect(screen.getByText(/Prueba gratis · te quedan 15 días/)).toBeTruthy();
  });

  it('avisa SIEMPRE que los pagos son de demostración', async () => {
    await render(<PlanesScreen />);
    expect(screen.getByText(/Pagos de demostración: no se cobra nada/)).toBeTruthy();
  });

  it('lista los planes de pago con su precio y lo que incluyen', async () => {
    await render(<PlanesScreen />);
    expect(screen.getByText('$99 al mes')).toBeTruthy();
    expect(screen.getByText('$199 al mes')).toBeTruthy();
    expect(screen.getByText('Hasta 250 productos en el menú')).toBeTruthy();
    expect(screen.getByText('3 negocios visibles')).toBeTruthy();
    expect(screen.getByText('Aparece primero en las listas')).toBeTruthy();
  });

  it('con un plan vigente marca «Tu plan» y ofrece renovar, no contratar', async () => {
    mockSus.mockReturnValue(lectura({ suscripcion: { ...SUS, estado: 'vigente', plan_id: 'comerciante_destacado', plan_nombre: 'Destacado' } }));
    await render(<PlanesScreen />);
    expect(screen.getByText('Tu plan')).toBeTruthy();
    expect(screen.getByLabelText('Renovar el plan Destacado')).toBeTruthy();
    expect(screen.getByLabelText('Contratar el plan Básico')).toBeTruthy();
  });

  it('sin plan lo dice con claridad', async () => {
    mockSus.mockReturnValue(lectura({ suscripcion: { ...SUS, estado: 'gratis', plan_id: 'comerciante_gratis', plan_nombre: 'Sin plan', hasta: null } }));
    await render(<PlanesScreen />);
    expect(screen.getByText(/no aparece en Servicios/)).toBeTruthy();
  });

  it('el arrendador ve «anuncios», no «negocios»', async () => {
    mockParams.rol = 'arrendador';
    mockSus.mockReturnValue(lectura({ suscripcion: { ...SUS, plan_id: 'arrendador_gratis', plan_nombre: 'Gratis', estado: 'gratis', hasta: null, limite_principal: 1 } }));
    mockPlanes.mockReturnValue(catalogo({ planes: [{ ...PLANES[1], id: 'arrendador_plus', rol: 'arrendador', nombre: 'Plus', limite_principal: 15 }] }));
    await render(<PlanesScreen />);
    expect(screen.getByText('Planes de arrendador')).toBeTruthy();
    expect(screen.getByText('15 anuncios visibles')).toBeTruthy();
  });
});

describe('los demás estados', () => {
  it('un rol que no es de vendedor no existe', async () => {
    mockParams.rol = 'admin';
    await render(<PlanesScreen />);
    expect(screen.getByText('Esta pantalla no existe.')).toBeTruthy();
  });

  it('sin tener la función, manda a agregarla y verificarse primero (no es un fallo)', async () => {
    mockSus.mockReturnValue(lectura({ suscripcion: null }));
    await render(<PlanesScreen />);
    expect(screen.getByText(/Primero agrega esta función y verifica tu identidad/)).toBeTruthy();
    expect(screen.queryByLabelText(/Contratar el plan/)).toBeNull();
  });

  it('mientras carga no decide nada', async () => {
    mockSus.mockReturnValue(lectura({ suscripcion: null, cargando: true }));
    await render(<PlanesScreen />);
    expect(screen.getByLabelText('Cargando')).toBeTruthy();
    expect(screen.queryByText(/Primero agrega/)).toBeNull();
  });

  it('un fallo de lectura se dice y reintenta las DOS lecturas, sin decir que no tienes la función', async () => {
    const r1 = jest.fn();
    const r2 = jest.fn();
    mockSus.mockReturnValue(lectura({ suscripcion: null, fallo: true, reintentar: r1 }));
    mockPlanes.mockReturnValue(catalogo({ planes: [], reintentar: r2 }));
    await render(<PlanesScreen />);
    expect(screen.queryByText(/Primero agrega/)).toBeNull();
    await pulsar('Reintentar');
    expect(r1).toHaveBeenCalled();
    expect(r2).toHaveBeenCalled();
  });

  it('sin planes de pago lo dice', async () => {
    mockPlanes.mockReturnValue(catalogo({ planes: [] }));
    await render(<PlanesScreen />);
    expect(screen.getByText(/no hay planes de pago/)).toBeTruthy();
  });
});

describe('contratar', () => {
  it('pide confirmación y dice que es una demostración; NO paga de inmediato', async () => {
    await render(<PlanesScreen />);
    await pulsar('Contratar el plan Destacado');
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    const [titulo, cuerpo] = (Alert.alert as jest.Mock).mock.calls[0];
    expect(titulo).toBe('Contratar el plan Destacado');
    expect(cuerpo).toMatch(/DEMOSTRACIÓN: no se cobra nada/);
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('al confirmar paga con el plan y la función correctos', async () => {
    await render(<PlanesScreen />);
    await pulsar('Contratar el plan Destacado');
    confirmar();
    expect(mockMutate.mock.calls[0][0]).toEqual({ planId: 'comerciante_destacado', rol: 'comerciante' });
  });

  it('al pagar bien dice hasta cuándo queda vigente', async () => {
    mockMutate.mockImplementation((_e, { onSuccess }) => onSuccess('2026-11-17T18:00:00Z'));
    await render(<PlanesScreen />);
    await pulsar('Contratar el plan Destacado');
    confirmar();
    expect(String(mockExito.mock.calls[0][0])).toMatch(/Plan Destacado activo hasta el 17 de noviembre de 2026/);
  });

  it('CP010 se explica por código: los pagos de demostración no están activos', async () => {
    mockMutate.mockImplementation((_e, { onError }) => onError({ code: 'CP010' }));
    await render(<PlanesScreen />);
    await pulsar('Contratar el plan Destacado');
    confirmar();
    expect(String(mockError.mock.calls[0][0])).toMatch(/no están activos/);
    expect(mockExito).not.toHaveBeenCalled();
  });

  it('CP011 se explica por código: verifica tu identidad primero', async () => {
    mockMutate.mockImplementation((_e, { onError }) => onError({ code: 'CP011' }));
    await render(<PlanesScreen />);
    await pulsar('Contratar el plan Destacado');
    confirmar();
    expect(String(mockError.mock.calls[0][0])).toMatch(/Verifica tu identidad/);
  });

  it('un fallo de red se dice como fallo, sin éxito', async () => {
    mockMutate.mockImplementation((_e, { onError }) => onError(new Error('Network request failed')));
    await render(<PlanesScreen />);
    await pulsar('Contratar el plan Destacado');
    confirmar();
    expect(String(mockError.mock.calls[0][0])).toMatch(/conexión/);
    expect(mockExito).not.toHaveBeenCalled();
  });
});
