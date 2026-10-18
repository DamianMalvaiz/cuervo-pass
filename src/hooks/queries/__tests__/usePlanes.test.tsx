import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

const mockPlanes = jest.fn();
const mockSus = jest.fn();
const mockPagos = jest.fn();
const mockPagar = jest.fn();
jest.mock('@/services/planes.service', () => ({
  listarPlanes: (...a: unknown[]) => mockPlanes(...a),
  obtenerMiSuscripcion: (...a: unknown[]) => mockSus(...a),
  listarMisPagos: (...a: unknown[]) => mockPagos(...a),
  simularPago: (...a: unknown[]) => mockPagar(...a),
}));

import { clienteDePrueba } from '@pruebas/consultas';
import { useContratarPlan, useMisPagos, useMiSuscripcion, usePlanes } from '../usePlanes';

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

describe('useContratarPlan', () => {
  it('paga con el plan elegido', async () => {
    mockPagar.mockResolvedValue('2026-11-17T00:00:00Z');
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useContratarPlan('u1'), { wrapper: Envoltura });
    await act(async () => { await result.current.mutateAsync({ planId: 'comerciante_destacado', rol: 'comerciante' }); });
    expect(mockPagar).toHaveBeenCalledWith('comerciante_destacado');
  });

  it('al terminar vuelve a pedir plan, pagos, negocios propios, roles y la oferta pública', async () => {
    mockPagar.mockResolvedValue('x');
    const { Envoltura, cliente } = envolver();
    const espia = jest.spyOn(cliente, 'invalidateQueries');
    const { result } = await renderHook(() => useContratarPlan('u1'), { wrapper: Envoltura });
    await act(async () => { await result.current.mutateAsync({ planId: 'p', rol: 'comerciante' }); });
    const claves = espia.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown }).queryKey));
    expect(claves).toEqual(expect.arrayContaining([
      JSON.stringify(['miSuscripcion', 'u1', 'comerciante']), JSON.stringify(['misPagos', 'u1']),
      JSON.stringify(['misNegocios', 'u1']), JSON.stringify(['misRoles', 'u1']),
      JSON.stringify(['negocios']), JSON.stringify(['negocio']),
    ]));
  });

  it('si el pago falla NO vuelve a pedir nada y el error llega con su código', async () => {
    mockPagar.mockRejectedValue({ code: 'CP010' });
    const { Envoltura, cliente } = envolver();
    const espia = jest.spyOn(cliente, 'invalidateQueries');
    const { result } = await renderHook(() => useContratarPlan('u1'), { wrapper: Envoltura });
    let error: unknown;
    await act(async () => {
      try { await result.current.mutateAsync({ planId: 'p', rol: 'comerciante' }); } catch (e) { error = e; }
    });
    expect(error).toMatchObject({ code: 'CP010' });
    expect(espia).not.toHaveBeenCalled();
  });
});
