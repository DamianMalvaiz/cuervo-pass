import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

const mockSubir = jest.fn();
const mockEnviar = jest.fn();
const mockObtener = jest.fn();
jest.mock('@/lib/storage', () => ({ subirEvidenciaVerificacion: (...a: unknown[]) => mockSubir(...a) }));
jest.mock('@/services/verificacion.service', () => ({
  enviarVerificacion: (...a: unknown[]) => mockEnviar(...a),
  obtenerMiVerificacion: (...a: unknown[]) => mockObtener(...a),
}));

import { clienteDePrueba } from '@pruebas/consultas';
import { useEnviarVerificacion, useMiVerificacion } from '../useVerificacion';
import { VERSION_AVISO } from '@/lib/verificacion';

const envolver = () => {
  const cliente = clienteDePrueba({ queries: { retry: false } });
  const Envoltura = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
  );
  return { Envoltura, cliente };
};

const entrada = {
  rol: 'comerciante' as const, nombreLegal: 'Ana', direccion: 'Calle 1',
  ineFrente: 'file:///f.jpg', ineReverso: 'file:///r.jpg', fotosLugar: ['file:///1.jpg', 'file:///2.jpg'],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSubir.mockImplementation(async (_u: string, _r: string, etiqueta: string) => `u1/comerciante/${etiqueta}.jpg`);
  mockEnviar.mockResolvedValue(undefined);
});

describe('useEnviarVerificacion', () => {
  it('sube TODA la evidencia y solo entonces llama a la RPC, con las rutas', async () => {
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useEnviarVerificacion('u1'), { wrapper: Envoltura });
    await act(async () => { await result.current.mutateAsync(entrada); });

    expect(mockSubir.mock.calls.map((c) => c[2])).toEqual(['ine-frente', 'ine-reverso', 'lugar-1', 'lugar-2']);
    expect(mockEnviar).toHaveBeenCalledWith(
      expect.objectContaining({
        rol: 'comerciante', ineFrente: 'u1/comerciante/ine-frente.jpg', ineReverso: 'u1/comerciante/ine-reverso.jpg',
        fotos: ['u1/comerciante/lugar-1.jpg', 'u1/comerciante/lugar-2.jpg'], versionAviso: VERSION_AVISO,
      })
    );
    expect(mockSubir.mock.invocationCallOrder.at(-1)!).toBeLessThan(mockEnviar.mock.invocationCallOrder[0]);
  });

  it('si una subida falla NO se envía nada', async () => {
    mockSubir.mockRejectedValueOnce(new Error('sin red'));
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useEnviarVerificacion('u1'), { wrapper: Envoltura });
    await act(async () => { await expect(result.current.mutateAsync(entrada)).rejects.toThrow('sin red'); });
    expect(mockEnviar).not.toHaveBeenCalled();
  });

  it('sin sesión no sube ni envía', async () => {
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useEnviarVerificacion(undefined), { wrapper: Envoltura });
    await act(async () => { await expect(result.current.mutateAsync(entrada)).rejects.toThrow(); });
    expect(mockSubir).not.toHaveBeenCalled();
    expect(mockEnviar).not.toHaveBeenCalled();
  });

  it('al terminar vuelve a pedir los roles y la verificación', async () => {
    const { Envoltura, cliente } = envolver();
    const espia = jest.spyOn(cliente, 'invalidateQueries');
    const { result } = await renderHook(() => useEnviarVerificacion('u1'), { wrapper: Envoltura });
    await act(async () => { await result.current.mutateAsync(entrada); });
    const claves = espia.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown }).queryKey));
    expect(claves).toContain(JSON.stringify(['misRoles', 'u1']));
    expect(claves).toContain(JSON.stringify(['miVerificacion', 'u1', 'comerciante']));
  });
});

describe('useMiVerificacion', () => {
  it('entrega la verificación cuando llega', async () => {
    mockObtener.mockResolvedValue({ nombre_legal: 'Ana' });
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useMiVerificacion('u1', 'comerciante'), { wrapper: Envoltura });
    await waitFor(() => expect(result.current.verificacion).toEqual({ nombre_legal: 'Ana' }));
    expect(mockObtener).toHaveBeenCalledWith('u1', 'comerciante');
  });

  it('un fallo no se presenta como «nunca envió»', async () => {
    mockObtener.mockRejectedValue(new Error('sin red'));
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useMiVerificacion('u1', 'comerciante'), { wrapper: Envoltura });
    await waitFor(() => expect(result.current.fallo).toBe(true));
    expect(result.current.verificacion).toBeNull();
  });

  it('sin sesión no consulta y no se queda cargando', async () => {
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => useMiVerificacion(undefined, 'comerciante'), { wrapper: Envoltura });
    expect(mockObtener).not.toHaveBeenCalled();
    expect(result.current.cargando).toBe(false);
  });
});
