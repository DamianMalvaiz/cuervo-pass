// `usePerfilActivo` decide qué barra de pestañas se ve. Lo que se fija: lee el perfil de ESA cuenta; un fallo es fallo (la barra de siempre, pero se
// sabe que falló) y no «es estudiante» a secas; y cambiar de perfil actualiza lo que se ve sin esperar a otra lectura.

jest.unmock('@/hooks/queries/usePerfilActivo');

const mockObtener = jest.fn();
const mockCambiar = jest.fn();
jest.mock('@/services/usuarios.service', () => ({
  obtenerPerfilActivo: (...a: unknown[]) => mockObtener(...a),
  cambiarPerfilActivo: (...a: unknown[]) => mockCambiar(...a),
}));

import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { clienteDePrueba } from '@pruebas/consultas';

import { usePerfilActivo } from '../usePerfilActivo';

const envolver = () => {
  const cliente = clienteDePrueba({ queries: { retry: false }, mutations: { gcTime: 0 } });
  const Envoltura = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
  return { Envoltura, cliente };
};

beforeEach(() => jest.clearAllMocks());

describe('usePerfilActivo', () => {
  it('lee el perfil de la cuenta', async () => {
    mockObtener.mockResolvedValue('vendedor');
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => usePerfilActivo('u1'), { wrapper: Envoltura });
    await waitFor(() => expect(result.current.perfil).toBe('vendedor'));
    expect(mockObtener).toHaveBeenCalledWith('u1');
  });

  it('mientras carga el perfil es null (no se afirma «estudiante»)', async () => {
    mockObtener.mockReturnValue(new Promise(() => {}));
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => usePerfilActivo('u1'), { wrapper: Envoltura });
    expect(result.current.perfil).toBeNull();
    expect(result.current.cargando).toBe(true);
  });

  it('un fallo de lectura se distingue: perfil null y fallo true', async () => {
    mockObtener.mockRejectedValue(new Error('sin red'));
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => usePerfilActivo('u1'), { wrapper: Envoltura });
    await waitFor(() => expect(result.current.fallo).toBe(true));
    expect(result.current.perfil).toBeNull();
  });

  it('sin sesión no consulta', async () => {
    const { Envoltura } = envolver();
    await renderHook(() => usePerfilActivo(undefined), { wrapper: Envoltura });
    expect(mockObtener).not.toHaveBeenCalled();
  });

  it('cambiar de perfil lo pide al servidor y actualiza lo que se ve', async () => {
    mockObtener.mockResolvedValue('estudiante');
    mockCambiar.mockResolvedValue(undefined);
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => usePerfilActivo('u1'), { wrapper: Envoltura });
    await waitFor(() => expect(result.current.perfil).toBe('estudiante'));

    await act(async () => { await result.current.cambiar('vendedor'); });

    expect(mockCambiar).toHaveBeenCalledWith('vendedor');
    await waitFor(() => expect(result.current.perfil).toBe('vendedor'));
  });

  it('si el servidor rechaza el cambio, el perfil NO cambia', async () => {
    mockObtener.mockResolvedValue('estudiante');
    mockCambiar.mockRejectedValue({ code: 'CP017' });
    const { Envoltura } = envolver();
    const { result } = await renderHook(() => usePerfilActivo('u1'), { wrapper: Envoltura });
    await waitFor(() => expect(result.current.perfil).toBe('estudiante'));

    await act(async () => { await expect(result.current.cambiar('vendedor')).rejects.toBeDefined(); });

    expect(result.current.perfil).toBe('estudiante');
  });
});
