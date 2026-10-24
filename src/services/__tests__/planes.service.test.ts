// Planes y pagos · 0053. El cliente solo LEE; contratar pasa por la RPC y conserva su código.

const mockDesde = jest.fn();
const mockRpc = jest.fn();
const mockInvocar = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]) => mockDesde(...a),
    rpc: (...a: unknown[]) => mockRpc(...a),
    functions: { invoke: (...a: unknown[]) => mockInvocar(...a) },
  },
}));

import { ErrorPago } from '@/lib/pagoMp';
import { crearPago, listarMisPagos, listarPlanes, obtenerMiSuscripcion, obtenerMiUltimaOrden, iniciarPrueba } from '../planes.service';

function cadena(resultado: { data?: unknown; error?: unknown }) {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'gt', 'order', 'limit']) c[m] = jest.fn(() => c);
  c.maybeSingle = jest.fn(() => Promise.resolve(resultado));
  c.then = (f: (v: unknown) => unknown) => Promise.resolve(resultado).then(f);
  return c;
}

beforeEach(() => {
  mockDesde.mockReset();
  mockRpc.mockReset();
  mockInvocar.mockReset();
});

describe('listarPlanes', () => {
  test('trae solo los planes de PAGO de la función, del más barato al más caro', async () => {
    const c = cadena({ data: [{ id: 'comerciante_basico' }] });
    mockDesde.mockReturnValue(c);
    await expect(listarPlanes('comerciante')).resolves.toEqual([{ id: 'comerciante_basico' }]);
    expect(mockDesde).toHaveBeenCalledWith('planes');
    expect(c.eq).toHaveBeenCalledWith('rol', 'comerciante');
    expect(c.gt).toHaveBeenCalledWith('precio_centavos', 0);
    expect(c.order).toHaveBeenCalledWith('orden', { ascending: true });
    expect((c.select as jest.Mock).mock.calls[0][0]).not.toBe('*');
  });
  test('si falla, LANZA', async () => {
    mockDesde.mockReturnValue(cadena({ error: { message: 'sin red' } }));
    await expect(listarPlanes('comerciante')).rejects.toMatchObject({ message: 'sin red' });
  });
});

describe('obtenerMiSuscripcion', () => {
  test('devuelve la fila de la RPC', async () => {
    mockRpc.mockResolvedValue({ data: [{ plan_id: 'comerciante_basico', estado: 'prueba' }], error: null });
    await expect(obtenerMiSuscripcion('comerciante')).resolves.toMatchObject({ plan_id: 'comerciante_basico' });
    expect(mockRpc).toHaveBeenCalledWith('mi_suscripcion', { p_rol: 'comerciante' });
  });
  test('sin la función no hay filas: devuelve null, no un fallo', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    await expect(obtenerMiSuscripcion('arrendador')).resolves.toBeNull();
  });
  test('si falla, LANZA', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'sin red' } });
    await expect(obtenerMiSuscripcion('comerciante')).rejects.toMatchObject({ message: 'sin red' });
  });
});

describe('listarMisPagos', () => {
  test('lee los de esta cuenta, recientes primero y con tope', async () => {
    const c = cadena({ data: [{ id: 'p1' }] });
    mockDesde.mockReturnValue(c);
    await expect(listarMisPagos('u1')).resolves.toEqual([{ id: 'p1' }]);
    expect(mockDesde).toHaveBeenCalledWith('pagos');
    expect(c.eq).toHaveBeenCalledWith('usuario_id', 'u1');
    expect(c.order).toHaveBeenCalledWith('creado_en', { ascending: false });
    expect(c.limit).toHaveBeenCalledWith(100);
  });
  test('si falla, LANZA y no devuelve una lista vacía', async () => {
    mockDesde.mockReturnValue(cadena({ error: { message: 'sin red' } }));
    await expect(listarMisPagos('u1')).rejects.toMatchObject({ message: 'sin red' });
  });
});

describe('iniciarPrueba', () => {
  test('llama a la RPC con la función y devuelve hasta cuándo dura la prueba', async () => {
    mockRpc.mockResolvedValue({ data: '2026-11-08T00:00:00Z', error: null });
    await expect(iniciarPrueba('comerciante')).resolves.toBe('2026-11-08T00:00:00Z');
    expect(mockRpc).toHaveBeenCalledWith('iniciar_prueba', { p_rol: 'comerciante' });
  });
  test('CP019 (la prueba ya se usó) llega con su código', async () => {
    mockRpc.mockResolvedValue({ error: { code: 'CP019', message: 'usada' } });
    await expect(iniciarPrueba('comerciante')).rejects.toMatchObject({ code: 'CP019' });
  });
  test('CP018 (sin esa función) llega con su código', async () => {
    mockRpc.mockResolvedValue({ error: { code: 'CP018', message: 'no' } });
    await expect(iniciarPrueba('arrendador')).rejects.toMatchObject({ code: 'CP018' });
  });
});

// Pagos con Mercado Pago (paso 4). `crearPago` llama a la Edge Function `crear-pago` y devuelve la URL a la que mandar a pagar; todo desenlace que no sea
// un 2xx con la forma esperada LANZA un `ErrorPago` con SU motivo (nunca se confunde un fallo con un éxito ni con «plan no disponible»).
const errorHttp = (status: number, cuerpo?: unknown) => ({
  data: null,
  error: { message: 'Edge Function returned a non-2xx status code', context: { status, json: async () => cuerpo } },
});
const URL_MP = 'https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=1-abc';

describe('crearPago', () => {
  test('manda SOLO el plan y devuelve la orden y la URL', async () => {
    mockInvocar.mockResolvedValue({ data: { orden_id: 'o-1', url: URL_MP }, error: null });
    await expect(crearPago('comerciante_basico')).resolves.toEqual({ ordenId: 'o-1', url: URL_MP });
    expect(mockInvocar).toHaveBeenCalledWith('crear-pago', { body: { plan_id: 'comerciante_basico' } });
  });

  test.each([
    [409, { error: 'plan_no_disponible' }, 'plan_no_disponible'],
    [429, { error: 'demasiadas_ordenes' }, 'demasiadas_ordenes'],
    [401, { error: 'sesión inválida' }, 'sesion'],
    [502, { degradado: true, motivo: 'mp-no-disponible' }, 'no_disponible'],
    [503, { degradado: true, motivo: 'sin-configurar' }, 'no_disponible'],
    [500, { error: 'error_interno' }, 'desconocido'],
  ])('un %i con %p lanza ErrorPago(%s)', async (status, cuerpo, tipo) => {
    mockInvocar.mockResolvedValue(errorHttp(status, cuerpo));
    await expect(crearPago('p')).rejects.toMatchObject({ name: 'ErrorPago', tipo });
  });

  test('un cuerpo de error que no se puede leer no rompe: se clasifica por el estado', async () => {
    mockInvocar.mockResolvedValue({ data: null, error: { context: { status: 502, json: async () => { throw new Error('no es json'); } } } });
    await expect(crearPago('p')).rejects.toMatchObject({ tipo: 'no_disponible' });
  });

  test('sin respuesta HTTP (se cayó la red) es «red»', async () => {
    mockInvocar.mockResolvedValue({ data: null, error: { message: 'Failed to send a request to the Edge Function' } });
    await expect(crearPago('p')).rejects.toMatchObject({ tipo: 'red' });
  });

  test('si la invocación lanza, es «red»', async () => {
    mockInvocar.mockRejectedValue(new TypeError('Network request failed'));
    await expect(crearPago('p')).rejects.toBeInstanceOf(ErrorPago);
    await expect(crearPago('p')).rejects.toMatchObject({ tipo: 'red' });
  });

  test.each([null, undefined, 'texto', {}, { orden_id: 'o-1' }, { url: URL_MP }, { orden_id: 5, url: URL_MP }])('un 2xx sin la forma esperada (%p) NO es un éxito', async (data) => {
    mockInvocar.mockResolvedValue({ data, error: null });
    await expect(crearPago('p')).rejects.toMatchObject({ tipo: 'desconocido' });
  });

  test('aunque el servidor la devuelva, una URL que no es de Mercado Pago NO se entrega a quien va a abrirla', async () => {
    mockInvocar.mockResolvedValue({ data: { orden_id: 'o-1', url: 'https://atacante.com/pagar' }, error: null });
    await expect(crearPago('p')).rejects.toMatchObject({ tipo: 'desconocido' });
  });
});

describe('obtenerMiUltimaOrden', () => {
  test('la última orden de esta cuenta y esta función, columnas enumeradas', async () => {
    const c = cadena({ data: { id: 'o-1', estado: 'pendiente', plan_id: 'comerciante_basico', creada_en: '2026-11-01T12:00:00Z' } });
    mockDesde.mockReturnValue(c);
    await expect(obtenerMiUltimaOrden('u1', 'comerciante')).resolves.toMatchObject({ id: 'o-1', estado: 'pendiente' });
    expect(mockDesde).toHaveBeenCalledWith('ordenes_pago');
    expect(c.eq).toHaveBeenCalledWith('usuario_id', 'u1');
    expect(c.eq).toHaveBeenCalledWith('rol', 'comerciante');
    expect(c.order).toHaveBeenCalledWith('creada_en', { ascending: false });
    expect(c.limit).toHaveBeenCalledWith(1);
    expect((c.select as jest.Mock).mock.calls[0][0]).not.toBe('*');
  });
  test('sin órdenes devuelve null (no es un fallo)', async () => {
    mockDesde.mockReturnValue(cadena({ data: null }));
    await expect(obtenerMiUltimaOrden('u1', 'comerciante')).resolves.toBeNull();
  });
  test('si falla, LANZA: «falló» no es «no hay órdenes»', async () => {
    mockDesde.mockReturnValue(cadena({ error: { message: 'sin red' } }));
    await expect(obtenerMiUltimaOrden('u1', 'comerciante')).rejects.toMatchObject({ message: 'sin red' });
  });
});
