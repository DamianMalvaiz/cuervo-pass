import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, Linking } from 'react-native';

// Planes y suscripciones. Lo que se fija: dice la verdad sobre en qué plan estás, avisa SIEMPRE que el pago es de
// demostración, confirma antes de contratar, y cada fallo se dice por su código sin inventar éxitos.

const mockParams = { rol: 'comerciante' };
const mockSus = jest.fn();
const mockPlanes = jest.fn();
const mockMutate = jest.fn();
const mockCrear = jest.fn();
const mockOrden = jest.fn();
const mockRefrescarTodo = jest.fn();
const mockAlVolver: { fn: (() => void) | null } = { fn: null };
const mockExito = jest.fn();
const mockError = jest.fn();
const mockInfo = jest.fn();

jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams }));
jest.mock('@/hooks/queries/usePlanes', () => ({
  useMiSuscripcion: (...a: unknown[]) => mockSus(...a),
  usePlanes: (...a: unknown[]) => mockPlanes(...a),
  useContratarPlan: () => ({ mutate: (...a: unknown[]) => mockMutate(...a), isPending: false }),
  useCrearPago: () => ({ mutate: (...a: unknown[]) => mockCrear(...a), isPending: false }),
  useMiUltimaOrden: (...a: unknown[]) => mockOrden(...a),
  useRefrescarTrasPago: () => mockRefrescarTodo,
}));
jest.mock('@/hooks/use-al-volver', () => ({ useAlVolverAPrimerPlano: (fn: () => void) => { mockAlVolver.fn = fn; } }));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }),
}));
jest.mock('@/lib/toast', () => ({
  toast: { exito: (...a: unknown[]) => mockExito(...a), error: (...a: unknown[]) => mockError(...a), info: (...a: unknown[]) => mockInfo(...a) },
}));

import { ErrorPago } from '@/lib/pagoMp';

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
const confirmarMp = () => {
  const botones = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2] as { text: string; onPress?: () => void }[];
  botones.find((b) => b.text === 'Continuar')?.onPress?.();
};
const orden = (estado: string, extra: Record<string, unknown> = {}) => ({
  orden: { id: 'o-1', estado, plan_id: 'comerciante_destacado', creada_en: new Date().toISOString(), ...extra },
  fallo: false,
  refrescar: jest.fn(),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockParams.rol = 'comerciante';
  mockSus.mockReturnValue(lectura());
  mockPlanes.mockReturnValue(catalogo());
  mockOrden.mockReturnValue({ orden: null, fallo: false, refrescar: jest.fn() });
  mockAlVolver.fn = null;
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

describe('qué dice', () => {
  it('muestra tu plan actual y cuántos días de prueba quedan', async () => {
    await render(<PlanesScreen />);
    expect(screen.getByText('Planes de comerciante')).toBeTruthy();
    expect(screen.getByText('Tu plan actual')).toBeTruthy();
    expect(screen.getByText(/Prueba gratis · te quedan 15 días/)).toBeTruthy();
  });

  it('avisa SIEMPRE que está en modo de prueba y no se cobra dinero real', async () => {
    await render(<PlanesScreen />);
    expect(screen.getByText(/Modo de PRUEBA: no se cobra dinero real/)).toBeTruthy();
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
    expect(screen.getByLabelText('Renovar el plan Destacado con Mercado Pago')).toBeTruthy();
    expect(screen.getByLabelText('Pagar el plan Básico con Mercado Pago')).toBeTruthy();
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
    expect(screen.queryByLabelText(/con Mercado Pago/)).toBeNull();
    expect(screen.queryByLabelText(/sin pagar/)).toBeNull();
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
    await pulsar('Probar el plan Destacado sin pagar (demostración)');
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    const [titulo, cuerpo] = (Alert.alert as jest.Mock).mock.calls[0];
    expect(titulo).toBe('Contratar el plan Destacado');
    expect(cuerpo).toMatch(/DEMOSTRACIÓN: no se cobra nada/);
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('al confirmar paga con el plan y la función correctos', async () => {
    await render(<PlanesScreen />);
    await pulsar('Probar el plan Destacado sin pagar (demostración)');
    confirmar();
    expect(mockMutate.mock.calls[0][0]).toEqual({ planId: 'comerciante_destacado', rol: 'comerciante' });
  });

  it('al pagar bien dice hasta cuándo queda vigente', async () => {
    mockMutate.mockImplementation((_e, { onSuccess }) => onSuccess('2026-11-17T18:00:00Z'));
    await render(<PlanesScreen />);
    await pulsar('Probar el plan Destacado sin pagar (demostración)');
    confirmar();
    expect(String(mockExito.mock.calls[0][0])).toMatch(/Plan Destacado activo hasta el 17 de noviembre de 2026/);
  });

  it('CP010 se explica por código: los pagos de demostración no están activos', async () => {
    mockMutate.mockImplementation((_e, { onError }) => onError({ code: 'CP010' }));
    await render(<PlanesScreen />);
    await pulsar('Probar el plan Destacado sin pagar (demostración)');
    confirmar();
    expect(String(mockError.mock.calls[0][0])).toMatch(/no están activos/);
    expect(mockExito).not.toHaveBeenCalled();
  });

  it('CP011 se explica por código: verifica tu identidad primero', async () => {
    mockMutate.mockImplementation((_e, { onError }) => onError({ code: 'CP011' }));
    await render(<PlanesScreen />);
    await pulsar('Probar el plan Destacado sin pagar (demostración)');
    confirmar();
    expect(String(mockError.mock.calls[0][0])).toMatch(/Verifica tu identidad/);
  });

  it('un fallo de red se dice como fallo, sin éxito', async () => {
    mockMutate.mockImplementation((_e, { onError }) => onError(new Error('Network request failed')));
    await render(<PlanesScreen />);
    await pulsar('Probar el plan Destacado sin pagar (demostración)');
    confirmar();
    expect(String(mockError.mock.calls[0][0])).toMatch(/conexión/);
    expect(mockExito).not.toHaveBeenCalled();
  });
});

describe('pagar con Mercado Pago', () => {
  it('pide confirmación, dice que en pruebas no se cobra dinero real y lo de OXXO; NO crea el pago de inmediato', async () => {
    await render(<PlanesScreen />);
    await pulsar('Pagar el plan Destacado con Mercado Pago');
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    const [titulo, cuerpo] = (Alert.alert as jest.Mock).mock.calls[0];
    expect(titulo).toBe('Pagar el plan Destacado con Mercado Pago');
    expect(cuerpo).toMatch(/\$199/);
    expect(cuerpo).toMatch(/no se cobra dinero real/i);
    expect(cuerpo).toMatch(/OXXO/);
    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('al confirmar pide la orden SOLO con el plan: el monto no sale de la pantalla', async () => {
    await render(<PlanesScreen />);
    await pulsar('Pagar el plan Destacado con Mercado Pago');
    confirmarMp();
    expect(mockCrear.mock.calls[0][0]).toEqual({ planId: 'comerciante_destacado' });
  });

  it('con la URL de Mercado Pago la abre, avisa que se confirma al volver y refresca la orden', async () => {
    const refrescar = jest.fn();
    mockOrden.mockReturnValue({ orden: null, fallo: false, refrescar });
    mockCrear.mockImplementation((_e, { onSuccess }) => onSuccess({ ordenId: 'o-1', url: 'https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=1' }));
    await render(<PlanesScreen />);
    await pulsar('Pagar el plan Destacado con Mercado Pago');
    confirmarMp();
    expect(Linking.openURL).toHaveBeenCalledWith('https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=1');
    expect(String(mockInfo.mock.calls[0][0])).toMatch(/vuelve aquí/);
    expect(mockExito).not.toHaveBeenCalled();
    expect(refrescar).toHaveBeenCalled();
  });

  it('si no se puede abrir Mercado Pago lo dice como fallo, sin éxito', async () => {
    (Linking.openURL as jest.Mock).mockRejectedValue(new Error('sin navegador'));
    mockCrear.mockImplementation((_e, { onSuccess }) => onSuccess({ ordenId: 'o-1', url: 'https://www.mercadopago.com.mx/x' }));
    await render(<PlanesScreen />);
    await pulsar('Pagar el plan Destacado con Mercado Pago');
    await act(async () => { confirmarMp(); });
    expect(String(mockError.mock.calls[0][0])).toMatch(/No pudimos abrir Mercado Pago/);
    expect(mockExito).not.toHaveBeenCalled();
  });

  it.each([
    ['plan_no_disponible', /Verifica tu identidad/],
    ['demasiadas_ordenes', /varios pagos sin terminarlos/],
    ['no_disponible', /Mercado Pago no está disponible/],
    ['red', /conexión/],
  ] as const)('el fallo «%s» se explica por su motivo', async (tipo, texto) => {
    mockCrear.mockImplementation((_e, { onError }) => onError(new ErrorPago(tipo)));
    await render(<PlanesScreen />);
    await pulsar('Pagar el plan Destacado con Mercado Pago');
    confirmarMp();
    expect(String(mockError.mock.calls[0][0])).toMatch(texto);
    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(mockInfo).not.toHaveBeenCalled();
  });

  it('un error que no es de la app se dice genérico, nunca como éxito', async () => {
    mockCrear.mockImplementation((_e, { onError }) => onError(new Error('algo raro')));
    await render(<PlanesScreen />);
    await pulsar('Pagar el plan Destacado con Mercado Pago');
    confirmarMp();
    expect(String(mockError.mock.calls[0][0])).toMatch(/No pudimos iniciar el pago/);
  });

  it('el pago simulado sigue ahí como respaldo y NO abre Mercado Pago', async () => {
    mockMutate.mockImplementation((_e, { onSuccess }) => onSuccess('2026-11-17T18:00:00Z'));
    await render(<PlanesScreen />);
    await pulsar('Probar el plan Destacado sin pagar (demostración)');
    confirmar();
    expect(mockMutate).toHaveBeenCalled();
    expect(mockCrear).not.toHaveBeenCalled();
    expect(Linking.openURL).not.toHaveBeenCalled();
  });
});

describe('el estado de tu último pago', () => {
  it('una orden pendiente (OXXO) se dice como pendiente, y se puede actualizar', async () => {
    mockOrden.mockReturnValue(orden('pendiente', { creada_en: '2026-01-01T00:00:00Z' }));
    await render(<PlanesScreen />);
    expect(screen.getByText(/Tu pago está pendiente.*OXXO/s)).toBeTruthy();
    await pulsar('Actualizar el estado del pago');
    expect(mockRefrescarTodo).toHaveBeenCalled();
  });

  it('una orden recién creada dice que se espera la confirmación', async () => {
    mockOrden.mockReturnValue(orden('creada'));
    await render(<PlanesScreen />);
    expect(screen.getByText(/esperando la confirmación de Mercado Pago/)).toBeTruthy();
  });

  it.each(['pagada', 'rechazada'])('una orden «%s» no lleva aviso', async (estado) => {
    mockOrden.mockReturnValue(orden(estado));
    await render(<PlanesScreen />);
    expect(screen.queryByText(/pendiente/)).toBeNull();
    expect(screen.queryByText(/esperando la confirmación/)).toBeNull();
  });

  it('una orden abandonada hace horas no se presenta como una espera', async () => {
    mockOrden.mockReturnValue(orden('creada', { creada_en: new Date(Date.now() - 5 * 3_600_000).toISOString() }));
    await render(<PlanesScreen />);
    expect(screen.queryByText(/esperando la confirmación/)).toBeNull();
  });

  it('si no se pudo leer la orden lo dice: «falló» no es «no tienes pagos pendientes»', async () => {
    mockOrden.mockReturnValue({ orden: null, fallo: true, refrescar: jest.fn() });
    await render(<PlanesScreen />);
    expect(screen.getByText(/No pudimos comprobar si tienes un pago pendiente/)).toBeTruthy();
  });
});

describe('al volver de Mercado Pago', () => {
  it('al volver a primer plano refresca todo lo que depende del pago', async () => {
    await render(<PlanesScreen />);
    expect(mockAlVolver.fn).not.toBeNull();
    mockAlVolver.fn?.();
    expect(mockRefrescarTodo).toHaveBeenCalledTimes(1);
  });

  it('cuando la orden pasa de «creada» a «pagada» refresca el plan, una vez', async () => {
    mockOrden.mockReturnValue(orden('creada'));
    const { rerender } = await render(<PlanesScreen />);
    expect(mockRefrescarTodo).not.toHaveBeenCalled();
    mockOrden.mockReturnValue(orden('pagada'));
    await rerender(<PlanesScreen />);
    expect(mockRefrescarTodo).toHaveBeenCalledTimes(1);
    await rerender(<PlanesScreen />);
    expect(mockRefrescarTodo).toHaveBeenCalledTimes(1);
  });

  it('una orden que YA estaba pagada al abrir la pantalla no dispara un refresco', async () => {
    mockOrden.mockReturnValue(orden('pagada'));
    await render(<PlanesScreen />);
    expect(mockRefrescarTodo).not.toHaveBeenCalled();
  });
});
