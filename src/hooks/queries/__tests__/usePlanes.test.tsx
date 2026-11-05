import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

const mockPlanes = jest.fn();
const mockSus = jest.fn();
const mockPagos = jest.fn();
const mockIniciar = jest.fn();
const mockCrearPago = jest.fn();
const mockOrden = jest.fn();
jest.mock('@/services/planes.service', () => ({
  listarPlanes: (...a: unknown[]) => mockPlanes(...a),
  obtenerMiSuscripcion: (...a: unknown[]) => mockSus(...a),
  listarMisPagos: (...a: unknown[]) => mockPagos(...a),
  iniciarPrueba: (...a: unknown[]) => mockIniciar(...a),
  crearPago: (...a: unknown[]) => mockCrearPago(...a),
  obtenerMiUltimaOrden: (...a: unknown[]) => mockOrden(...a),
}));

import { clienteDePrueba } from '@pruebas/consultas';
import { useIniciarPrueba, useCrearPago, useMisPagos, useMiSuscripcion, useMiUltimaOrden, usePlanes, useRefrescarTrasPago } from '../usePlanes';

const envolver = () => {
  const cliente = clienteDePrueba({ queries: { retry: false } });
  const Envoltura = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
  );
  return { Envoltura, cliente };
};

beforeEach(() => jest.clearAllMocks());

describe('lecturas', () => {
  it('usePlanes: entrega el catálogo; un fallo no es «no hay planes»', async () => {
    mockPlanes.mockResolvedValue([{ id: 'a' }]);
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => usePlanes('comerciante'), { wrapper: Envoltura });
    await waitFor(() => expect(result.current.planes).toHaveLength(1));
    expect(mockPlanes).toHaveBeenCalledWith('comerciante');

    mockPlanes.mockRejectedValue(new Error('sin red'));
    const otro = envolver();
    const r2 = await renderHook(() => usePlanes('arrendador'), { wrapper: otro.Envoltura });
    await waitFor(() => expect(r2.result.current.fallo).toBe(true));
    expect(r2.result.current.planes).toEqual([]);
  });

  it('useMiSuscripcion: sin la función es null y NO es un fallo', async () => {
    mockSus.mockResolvedValue(null);
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useMiSuscripcion('u1', 'comerciante'), { wrapper: Envoltura });
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.suscripcion).toBeNull();
    expect(result.current.fallo).toBe(false);
  });

  it('useMiSuscripcion: sin sesión no consulta y no se queda cargando', async () => {
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useMiSuscripcion(undefined, 'comerciante'), { wrapper: Envoltura });
    expect(mockSus).not.toHaveBeenCalled();
    expect(result.current.cargando).toBe(false);
  });

  it('useMisPagos: lista, y un fallo no es «no tienes pagos»', async () => {
    mockPagos.mockResolvedValue([{ id: 'p1' }]);
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useMisPagos('u1'), { wrapper: Envoltura });
    await waitFor(() => expect(result.current.pagos).toHaveLength(1));

    mockPagos.mockRejectedValue(new Error('sin red'));
    const otro = envolver();
    const r2 = await renderHook(() => useMisPagos('u2'), { wrapper: otro.Envoltura });
    await waitFor(() => expect(r2.result.current.fallo).toBe(true));
    expect(r2.result.current.pagos).toEqual([]);
  });
});

describe('useIniciarPrueba', () => {
  it('inicia la prueba de la función elegida', async () => {
    mockIniciar.mockResolvedValue('2026-11-08T00:00:00Z');
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useIniciarPrueba('u1'), { wrapper: Envoltura });
    await act(async () => { await result.current.mutateAsync('comerciante'); });
    expect(mockIniciar).toHaveBeenCalledWith('comerciante');
  });

  it('al terminar vuelve a pedir plan, pagos, negocios propios, roles y la oferta pública', async () => {
    mockIniciar.mockResolvedValue('x');
    const { Envoltura, cliente } = envolver();
    const espia = jest.spyOn(cliente, 'invalidateQueries');
    const { result } = await renderHook(() => useIniciarPrueba('u1'), { wrapper: Envoltura });
    await act(async () => { await result.current.mutateAsync('comerciante'); });
    const claves = espia.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown }).queryKey));
    expect(claves).toEqual(expect.arrayContaining([
      JSON.stringify(['miSuscripcion', 'u1', 'comerciante']), JSON.stringify(['misNegocios', 'u1']),
      JSON.stringify(['misRoles', 'u1']), JSON.stringify(['negocios']), JSON.stringify(['negocio']),
    ]));
  });

  it('si falla NO vuelve a pedir nada y el error llega con su código', async () => {
    mockIniciar.mockRejectedValue({ code: 'CP019' });
    const { Envoltura, cliente } = envolver();
    const espia = jest.spyOn(cliente, 'invalidateQueries');
    const { result } = await renderHook(() => useIniciarPrueba('u1'), { wrapper: Envoltura });
    let error: unknown;
    await act(async () => {
      try { await result.current.mutateAsync('comerciante'); } catch (e) { error = e; }
    });
    expect(error).toMatchObject({ code: 'CP019' });
    expect(espia).not.toHaveBeenCalled();
  });
});

// Pagos con Mercado Pago (paso 4).
describe('useCrearPago', () => {
  it('pide la orden con el plan elegido y entrega la URL', async () => {
    mockCrearPago.mockResolvedValue({ ordenId: 'o-1', url: 'https://www.mercadopago.com.mx/x' });
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useCrearPago(), { wrapper: Envoltura });
    let r: unknown;
    await act(async () => { r = await result.current.mutateAsync({ planId: 'comerciante_destacado' }); });
    expect(mockCrearPago).toHaveBeenCalledWith('comerciante_destacado');
    expect(r).toEqual({ ordenId: 'o-1', url: 'https://www.mercadopago.com.mx/x' });
  });

  it('si falla, el error llega tal cual (con su tipo) y no se reintenta solo', async () => {
    mockCrearPago.mockRejectedValue({ name: 'ErrorPago', tipo: 'no_disponible' });
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useCrearPago(), { wrapper: Envoltura });
    let error: unknown;
    await act(async () => {
      try { await result.current.mutateAsync({ planId: 'p' }); } catch (e) { error = e; }
    });
    expect(error).toMatchObject({ tipo: 'no_disponible' });
    expect(mockCrearPago).toHaveBeenCalledTimes(1);
  });
});

describe('useMiUltimaOrden', () => {
  it('entrega la última orden; sin órdenes es null y NO un fallo', async () => {
    mockOrden.mockResolvedValue({ id: 'o-1', estado: 'pendiente', plan_id: 'p', creada_en: '2026-11-01T12:00:00Z' });
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useMiUltimaOrden('u1', 'comerciante'), { wrapper: Envoltura });
    await waitFor(() => expect(result.current.orden?.estado).toBe('pendiente'));
    expect(mockOrden).toHaveBeenCalledWith('u1', 'comerciante');

    mockOrden.mockResolvedValue(null);
    const otro = envolver();
    const r2 = await renderHook(() => useMiUltimaOrden('u2', 'comerciante'), { wrapper: otro.Envoltura });
    await waitFor(() => expect(mockOrden).toHaveBeenCalledWith('u2', 'comerciante'));
    await waitFor(() => expect(r2.result.current.cargando).toBe(false));
    expect(r2.result.current.orden).toBeNull();
    expect(r2.result.current.fallo).toBe(false);
  });

  it('un fallo de lectura se dice como fallo, no como «no hay órdenes»', async () => {
    mockOrden.mockRejectedValue(new Error('sin red'));
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useMiUltimaOrden('u1', 'comerciante'), { wrapper: Envoltura });
    await waitFor(() => expect(result.current.fallo).toBe(true));
    expect(result.current.orden).toBeNull();
  });

  it('sin sesión no consulta', async () => {
    const { Envoltura } = envolver();
    await renderHook(() => useMiUltimaOrden(undefined, 'comerciante'), { wrapper: Envoltura });
    expect(mockOrden).not.toHaveBeenCalled();
  });

  it('sondea cada 5 s solo mientras la orden espera su aviso (creada)', async () => {
    mockOrden.mockResolvedValue({ id: 'o-1', estado: 'creada', plan_id: 'p', creada_en: new Date().toISOString() });
    const { Envoltura, cliente } = envolver();
    const { result } = await renderHook(() => useMiUltimaOrden('u1', 'comerciante'), { wrapper: Envoltura });
    await waitFor(() => expect(result.current.orden?.estado).toBe('creada'));
    const consulta = cliente.getQueryCache().find({ queryKey: ['miUltimaOrden', 'u1', 'comerciante'] });
    // `refetchInterval` es una opción del observador: existe en `options` en ejecución pero no en el tipo `QueryOptions`.
    const opciones = consulta?.options as unknown as { refetchInterval: (q: { state: { data: unknown } }) => number | false };
    const intervalo = opciones.refetchInterval;
    expect(intervalo({ state: { data: { estado: 'creada' } } })).toBe(5000);
    expect(intervalo({ state: { data: { estado: 'pendiente' } } })).toBe(false);
    expect(intervalo({ state: { data: null } })).toBe(false);
  });
});

describe('useRefrescarTrasPago', () => {
  it('vuelve a pedir plan, pagos, orden, negocios propios, roles y la oferta pública', async () => {
    const { Envoltura, cliente } = envolver();
    const espia = jest.spyOn(cliente, 'invalidateQueries');
    const { result } = await renderHook(() => useRefrescarTrasPago('u1', 'comerciante'), { wrapper: Envoltura });
    await act(async () => { result.current(); });
    const claves = espia.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown }).queryKey));
    expect(claves).toEqual(expect.arrayContaining([
      JSON.stringify(['miSuscripcion', 'u1', 'comerciante']), JSON.stringify(['misPagos', 'u1']),
      JSON.stringify(['miUltimaOrden', 'u1', 'comerciante']), JSON.stringify(['misNegocios', 'u1']),
      JSON.stringify(['misRoles', 'u1']), JSON.stringify(['negocios']), JSON.stringify(['negocio']),
    ]));
  });

  it('devuelve la MISMA función entre renders (la pantalla la usa como dependencia de un efecto)', async () => {
    const { Envoltura } = envolver();
    const { result, rerender } = await renderHook(() => useRefrescarTrasPago('u1', 'comerciante'), { wrapper: Envoltura });
    const primera = result.current;
    await rerender({});
    expect(result.current).toBe(primera);
  });
});
