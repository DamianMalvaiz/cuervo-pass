import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

const mockListar = jest.fn();
const mockMia = jest.fn();
const mockGuardar = jest.fn();
const mockBorrar = jest.fn();
const mockResponder = jest.fn();
const mockReportar = jest.fn();
const mockCalif = jest.fn();
jest.mock('@/services/resenas.service', () => ({
  listarResenas: (...a: unknown[]) => mockListar(...a),
  obtenerMiResena: (...a: unknown[]) => mockMia(...a),
  guardarResena: (...a: unknown[]) => mockGuardar(...a),
  borrarMiResena: (...a: unknown[]) => mockBorrar(...a),
  responderResena: (...a: unknown[]) => mockResponder(...a),
  reportarResena: (...a: unknown[]) => mockReportar(...a),
  obtenerCalificacionPublicacion: (...a: unknown[]) => mockCalif(...a),
}));

import { clienteDePrueba } from '@pruebas/consultas';
import {
  useBorrarResena, useCalificacionPublicacion, useGuardarResena, useMiResena, useReportarResena, useResenas, useResponderResena,
} from '../useResenas';

const NEG = { negocioId: 'n1' } as const;
const envolver = () => {
  const cliente = clienteDePrueba({ queries: { retry: false } });
  const Envoltura = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
  );
  return { Envoltura, cliente };
};
const claves = (espia: jest.SpyInstance) =>
  espia.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown }).queryKey));

beforeEach(() => {
  jest.clearAllMocks();
  mockGuardar.mockResolvedValue(undefined);
  mockBorrar.mockResolvedValue(undefined);
  mockResponder.mockResolvedValue(undefined);
  mockReportar.mockResolvedValue(undefined);
});

describe('lecturas', () => {
  it('useResenas: lista, y un fallo no es «no hay reseñas»', async () => {
    mockListar.mockResolvedValue([{ id: 'r1' }]);
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useResenas(NEG), { wrapper: Envoltura });
    await waitFor(() => expect(result.current.resenas).toHaveLength(1));
    expect(mockListar).toHaveBeenCalledWith(NEG);

    mockListar.mockRejectedValue(new Error('sin red'));
    const otro = envolver();
    const r2 = await renderHook(() => useResenas({ publicacionId: 'p1' }), { wrapper: otro.Envoltura });
    await waitFor(() => expect(r2.result.current.fallo).toBe(true));
    expect(r2.result.current.resenas).toEqual([]);
  });

  it('useMiResena: «no he reseñado» es null y NO es un fallo', async () => {
    mockMia.mockResolvedValue(null);
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useMiResena('u1', NEG), { wrapper: Envoltura });
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.miResena).toBeNull();
    expect(result.current.fallo).toBe(false);
  });

  it('useMiResena: sin sesión no consulta y no se queda cargando', async () => {
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useMiResena(undefined, NEG), { wrapper: Envoltura });
    expect(mockMia).not.toHaveBeenCalled();
    expect(result.current.cargando).toBe(false);
  });
});

describe('escrituras', () => {
  it('guardar manda el objetivo y los datos, y refresca reseñas, la mía y las fichas', async () => {
    const { Envoltura, cliente } = envolver();
    const espia = jest.spyOn(cliente, 'invalidateQueries');
    const { result } = await renderHook(() => useGuardarResena('u1', NEG), { wrapper: Envoltura });
    await act(async () => { await result.current.mutateAsync({ estrellas: 5, texto: 'Muy bueno' }); });
    expect(mockGuardar).toHaveBeenCalledWith('u1', NEG, { estrellas: 5, texto: 'Muy bueno' });
    expect(claves(espia)).toEqual(expect.arrayContaining([
      JSON.stringify(['resenas', 'n1']), JSON.stringify(['miResena', 'u1', 'n1']),
      JSON.stringify(['negocios']), JSON.stringify(['negocio']), JSON.stringify(['calificacionPublicacion']),
    ]));
  });

  it('guardar sin sesión no escribe nada', async () => {
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useGuardarResena(undefined, NEG), { wrapper: Envoltura });
    await act(async () => { await expect(result.current.mutateAsync({ estrellas: 5, texto: '' })).rejects.toThrow(); });
    expect(mockGuardar).not.toHaveBeenCalled();
  });

  it('si guardar falla NO refresca nada y el error llega con su código (23505 = ya reseñaste)', async () => {
    mockGuardar.mockRejectedValue({ code: '23505' });
    const { Envoltura, cliente } = envolver();
    const espia = jest.spyOn(cliente, 'invalidateQueries');
    const { result } = await renderHook(() => useGuardarResena('u1', NEG), { wrapper: Envoltura });
    let error: unknown;
    await act(async () => { try { await result.current.mutateAsync({ estrellas: 5, texto: '' }); } catch (e) { error = e; } });
    expect(error).toMatchObject({ code: '23505' });
    expect(espia).not.toHaveBeenCalled();
  });

  it('borrar, responder y reportar llaman a su servicio y refrescan', async () => {
    const { Envoltura, cliente } = envolver();
    const espia = jest.spyOn(cliente, 'invalidateQueries');
    const b = await renderHook(() => useBorrarResena('u1', NEG), { wrapper: Envoltura });
    await act(async () => { await b.result.current.mutateAsync('r1'); });
    expect(mockBorrar).toHaveBeenCalledWith('r1');

    const r = await renderHook(() => useResponderResena('u1', NEG), { wrapper: Envoltura });
    await act(async () => { await r.result.current.mutateAsync({ id: 'r1', texto: 'Gracias' }); });
    expect(mockResponder).toHaveBeenCalledWith('r1', 'Gracias');

    const rp = await renderHook(() => useReportarResena('u1', NEG), { wrapper: Envoltura });
    await act(async () => { await rp.result.current.mutateAsync({ id: 'r1', motivo: 'spam' }); });
    expect(mockReportar).toHaveBeenCalledWith('r1', 'spam');

    expect(claves(espia)).toContain(JSON.stringify(['resenas', 'n1']));
  });

  it('una reseña de vivienda usa la clave de la publicación', async () => {
    const { Envoltura, cliente } = envolver();
    const espia = jest.spyOn(cliente, 'invalidateQueries');
    const { result } = await renderHook(() => useGuardarResena('u1', { publicacionId: 'p9' }), { wrapper: Envoltura });
    await act(async () => { await result.current.mutateAsync({ estrellas: 3, texto: '' }); });
    expect(claves(espia)).toContain(JSON.stringify(['resenas', 'p9']));
  });
});

describe('useCalificacionPublicacion', () => {
  it('entrega la calificación calculada y cuántas reseñas son', async () => {
    mockCalif.mockResolvedValue({ calificacion: 4.5, num_resenas: 2 });
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useCalificacionPublicacion('p1'), { wrapper: Envoltura });
    await waitFor(() => expect(result.current.calificacion).toBe(4.5));
    expect(result.current.numResenas).toBe(2);
  });
  it('sin reseñas es null y 0, no una calificación inventada', async () => {
    mockCalif.mockResolvedValue(null);
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useCalificacionPublicacion('p1'), { wrapper: Envoltura });
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.calificacion).toBeNull();
    expect(result.current.numResenas).toBe(0);
  });
  it('sin id no consulta y no se queda cargando', async () => {
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useCalificacionPublicacion(undefined), { wrapper: Envoltura });
    expect(mockCalif).not.toHaveBeenCalled();
    expect(result.current.cargando).toBe(false);
  });
});
