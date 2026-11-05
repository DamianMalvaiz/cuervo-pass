import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

// Lo que estas pruebas fijan de los hooks de publicaciones: el carrusel accesorio no pinta un error, una ficha sin id no consulta, «no existe» no se presenta
// como «falló», la afinidad es de QUIEN pregunta, y cambiar el estado invalida TODO lo que depende de él (si no, una publicación desactivada seguiría a la vista).

const mockNuevas = jest.fn();
const mockDestacadas = jest.fn();
const mockUna = jest.fn();
const mockAfinidad = jest.fn();
const mockEstado = jest.fn();
jest.mock('@/services/publicaciones.service', () => ({
  obtenerNuevasEstaSemana: (...a: unknown[]) => mockNuevas(...a),
  obtenerDestacadas: (...a: unknown[]) => mockDestacadas(...a),
  obtenerPublicacionPublica: (...a: unknown[]) => mockUna(...a),
  obtenerAfinidad: (...a: unknown[]) => mockAfinidad(...a),
  cambiarEstadoPublicacion: (...a: unknown[]) => mockEstado(...a),
  listarMisPublicaciones: jest.fn().mockResolvedValue([]),
  obtenerSugerencias: jest.fn().mockResolvedValue([]),
  crearPublicacion: jest.fn(),
  actualizarPublicacion: jest.fn(),
}));

import { clienteDePrueba } from '@pruebas/consultas';

import { claves } from '@/lib/consultas';

import { useAfinidad, useCambiarEstadoPublicacion, useDestacadas, useNuevas, usePublicacion } from '../usePublicaciones';

const envolver = () => {
  const cliente = clienteDePrueba({ queries: { retry: false } });
  const Envoltura = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
  return { Envoltura, cliente };
};

beforeEach(() => jest.clearAllMocks());

describe('useDestacadas', () => {
  it('pide 10 del tipo elegido y devuelve la lista', async () => {
    mockDestacadas.mockResolvedValue([{ id: 'd1' }]);
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useDestacadas('depa'), { wrapper: Envoltura });
    await waitFor(() => expect(result.current.datos).toEqual([{ id: 'd1' }]));
    expect(mockDestacadas).toHaveBeenCalledWith(10, 'depa');
  });

  it('si falla, simplemente no se pinta (lista vacía), sin lanzar', async () => {
    mockDestacadas.mockRejectedValue(new Error('sin red'));
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useDestacadas(null), { wrapper: Envoltura });
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.datos).toEqual([]);
  });
});

describe('useNuevas', () => {
  it('pide 10 del tipo elegido y devuelve la lista', async () => {
    mockNuevas.mockResolvedValue([{ id: 'p1' }]);
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useNuevas('cuarto'), { wrapper: Envoltura });
    await waitFor(() => expect(result.current.datos).toEqual([{ id: 'p1' }]));
    expect(mockNuevas).toHaveBeenCalledWith(10, 'cuarto');
  });

  it('si falla, el carrusel simplemente no se pinta (lista vacía), sin lanzar', async () => {
    mockNuevas.mockRejectedValue(new Error('sin red'));
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useNuevas(null), { wrapper: Envoltura });
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.datos).toEqual([]);
  });
});

describe('usePublicacion', () => {
  it('sin id NO consulta (en el primer render de una ruta dinámica no hay id)', async () => {
    const { Envoltura } = envolver();
    await renderHook(() => usePublicacion(undefined), { wrapper: Envoltura });
    expect(mockUna).not.toHaveBeenCalled();
  });

  it('devuelve la publicación', async () => {
    mockUna.mockResolvedValue({ id: 'p1', titulo: 'Depa' });
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => usePublicacion('p1'), { wrapper: Envoltura });
    await waitFor(() => expect(result.current.publicacion).toEqual({ id: 'p1', titulo: 'Depa' }));
    expect(result.current.fallo).toBeNull();
  });

  it('«no existe» (null) NO se presenta como un fallo', async () => {
    mockUna.mockResolvedValue(null);
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => usePublicacion('p1'), { wrapper: Envoltura });
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.publicacion).toBeNull();
    expect(result.current.fallo).toBeNull();
  });

  it('una caída de red SÍ es un fallo, con su texto', async () => {
    mockUna.mockRejectedValue(new Error('Network request failed'));
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => usePublicacion('p1'), { wrapper: Envoltura });
    await waitFor(() => expect(result.current.fallo).toBe('Network request failed'));
    expect(result.current.publicacion).toBeNull();
  });
});

describe('useAfinidad', () => {
  it('sin id no consulta', async () => {
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useAfinidad(undefined), { wrapper: Envoltura });
    expect(mockAfinidad).not.toHaveBeenCalled();
    expect(result.current).toBeNull();
  });

  it('devuelve la afinidad que calcula el servidor', async () => {
    mockAfinidad.mockResolvedValue({ scoreFinal: 0.8 });
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useAfinidad('p1'), { wrapper: Envoltura });
    await waitFor(() => expect(result.current).toEqual({ scoreFinal: 0.8 }));
  });
});

describe('useCambiarEstadoPublicacion', () => {
  it('llama al servicio y, al tener éxito, invalida las TRES consultas que dependen del estado', async () => {
    mockEstado.mockResolvedValue(undefined);
    const { Envoltura, cliente } = envolver();
    const invalidar = jest.spyOn(cliente, 'invalidateQueries');
    const { result } = await renderHook(() => useCambiarEstadoPublicacion('u1'), { wrapper: Envoltura });
    await act(async () => { await result.current.mutateAsync({ id: 'p9', activa: false }); });
    expect(mockEstado).toHaveBeenCalledWith('p9', false);
    const claves_ = invalidar.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown }).queryKey));
    expect(claves_).toContain(JSON.stringify(claves.misPublicaciones('u1')));
    expect(claves_).toContain(JSON.stringify(claves.publicacion('p9')));
    expect(claves_).toContain(JSON.stringify(['sugerencias']));
  });

  it('si el servicio falla NO invalida nada (no hay qué refrescar) y el error llega a quien llamó', async () => {
    mockEstado.mockRejectedValue(new Error('sin red'));
    const { Envoltura, cliente } = envolver();
    const invalidar = jest.spyOn(cliente, 'invalidateQueries');
    const { result } = await renderHook(() => useCambiarEstadoPublicacion('u1'), { wrapper: Envoltura });
    await act(async () => { await expect(result.current.mutateAsync({ id: 'p9', activa: true })).rejects.toThrow('sin red'); });
    expect(invalidar).not.toHaveBeenCalled();
  });
});
