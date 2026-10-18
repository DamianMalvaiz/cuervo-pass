import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

const mockListar = jest.fn();
const mockContar = jest.fn();
const mockUno = jest.fn();
const mockTodos = jest.fn();
jest.mock('@/services/notificaciones.service', () => ({
  listarAvisos: (...a: unknown[]) => mockListar(...a),
  contarAvisosNoLeidos: (...a: unknown[]) => mockContar(...a),
  marcarAvisoLeido: (...a: unknown[]) => mockUno(...a),
  marcarTodosLeidos: (...a: unknown[]) => mockTodos(...a),
}));

import { clienteDePrueba } from '@pruebas/consultas';

import { useAvisos, useAvisosNoLeidos, useMarcarAvisos } from '../useNotificaciones';

const envolver = () => {
  const cliente = clienteDePrueba({ queries: { retry: false }, mutations: { gcTime: 0 } });
  const Envoltura = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
  return { Envoltura, cliente };
};

beforeEach(() => jest.clearAllMocks());

describe('useAvisos', () => {
  it('trae la lista de la cuenta', async () => {
    mockListar.mockResolvedValue([{ id: 'a1' }]);
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useAvisos('u1'), { wrapper: Envoltura });
    await waitFor(() => expect(result.current.avisos).toEqual([{ id: 'a1' }]));
  });
  it('un fallo es fallo, no «sin avisos»', async () => {
    mockListar.mockRejectedValue(new Error('sin red'));
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useAvisos('u1'), { wrapper: Envoltura });
    await waitFor(() => expect(result.current.fallo).toBe(true));
    expect(result.current.cargando).toBe(false);
  });
  it('sin sesión no consulta y no se queda cargando', async () => {
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useAvisos(undefined), { wrapper: Envoltura });
    expect(mockListar).not.toHaveBeenCalled();
    expect(result.current.cargando).toBe(false);
  });
});

describe('useAvisosNoLeidos', () => {
  it('devuelve el número; null mientras no se sabe', async () => {
    mockContar.mockResolvedValue(4);
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useAvisosNoLeidos('u1'), { wrapper: Envoltura });
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toBe(4));
  });
  it('si el conteo falla queda en null (no se pinta «0»)', async () => {
    mockContar.mockRejectedValue(new Error('x'));
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useAvisosNoLeidos('u1'), { wrapper: Envoltura });
    await waitFor(() => expect(mockContar).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });
});

describe('useMarcarAvisos', () => {
  it('marcar uno o todos vuelve a pedir la lista y el conteo', async () => {
    mockUno.mockResolvedValue(undefined);
    mockTodos.mockResolvedValue(undefined);
    const { Envoltura, cliente } = envolver();
    const invalidar = jest.spyOn(cliente, 'invalidateQueries');
    const { result } = await renderHook(() => useMarcarAvisos('u1'), { wrapper: Envoltura });
    await act(async () => { result.current.marcarUno('a1'); });
    await waitFor(() => expect(mockUno).toHaveBeenCalledWith('a1'));
    await act(async () => { result.current.marcarTodos(); });
    await waitFor(() => expect(mockTodos).toHaveBeenCalled());
    const claves = () => invalidar.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown }).queryKey));
    await waitFor(() => expect(claves().filter((k) => k === JSON.stringify(['avisos', 'u1'])).length).toBeGreaterThanOrEqual(2));
    expect(claves()).toEqual(expect.arrayContaining([JSON.stringify(['avisos', 'u1']), JSON.stringify(['avisosNoLeidos', 'u1'])]));
  });
});
