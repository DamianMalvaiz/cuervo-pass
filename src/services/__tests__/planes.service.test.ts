// Planes y pagos · 0053. El cliente solo LEE; contratar pasa por la RPC y conserva su código.

const mockDesde = jest.fn();
const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { from: (...a: unknown[]) => mockDesde(...a), rpc: (...a: unknown[]) => mockRpc(...a) },
}));

import { listarMisPagos, listarPlanes, obtenerMiSuscripcion, simularPago } from '../planes.service';

function cadena(resultado: { data?: unknown; error?: unknown }) {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'gt', 'order', 'limit']) c[m] = jest.fn(() => c);
  c.then = (f: (v: unknown) => unknown) => Promise.resolve(resultado).then(f);
  return c;
}

beforeEach(() => {
  mockDesde.mockReset();
  mockRpc.mockReset();
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

describe('simularPago', () => {
  test('llama a la RPC con el plan y devuelve hasta cuándo queda vigente', async () => {
    mockRpc.mockResolvedValue({ data: '2026-11-17T00:00:00Z', error: null });
    await expect(simularPago('comerciante_destacado')).resolves.toBe('2026-11-17T00:00:00Z');
    expect(mockRpc).toHaveBeenCalledWith('simular_pago', { p_plan: 'comerciante_destacado' });
  });
  test('CP010 (modo demostración apagado) llega con su código', async () => {
    mockRpc.mockResolvedValue({ error: { code: 'CP010', message: 'apagado' } });
    await expect(simularPago('x')).rejects.toMatchObject({ code: 'CP010' });
  });
  test('CP011 (plan no disponible) llega con su código', async () => {
    mockRpc.mockResolvedValue({ error: { code: 'CP011', message: 'no' } });
    await expect(simularPago('x')).rejects.toMatchObject({ code: 'CP011' });
  });
});
