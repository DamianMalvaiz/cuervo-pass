import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

const mockCategorias = jest.fn();
const mockNegocios = jest.fn();
const mockNegocio = jest.fn();

jest.mock('@/services/servicios.service', () => ({
  listarCategorias: (...a: unknown[]) => mockCategorias(...a),
  listarNegocios: (...a: unknown[]) => mockNegocios(...a),
  obtenerNegocio: (...a: unknown[]) => mockNegocio(...a),
}));

import { clienteDePrueba } from '@pruebas/consultas';
import { useCategoriasServicio, useNegocio, useNegocios } from '../useServicios';

const envolver = () => {
  const cliente = clienteDePrueba({ queries: { retry: false } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
  );
};

beforeEach(() => jest.clearAllMocks());

describe('useCategoriasServicio', () => {
  it('entrega las categorías cuando llegan', async () => {
    mockCategorias.mockResolvedValue([{ id: 'comida' }]);
    const { result } = await renderHook(() => useCategoriasServicio(), { wrapper: envolver() });
    await waitFor(() => expect(result.current.categorias).toHaveLength(1));
    expect(result.current.fallo).toBe(false);
  });

  it('un fallo NO se presenta como «no hay categorías»', async () => {
    mockCategorias.mockRejectedValue(new Error('sin red'));
    const { result } = await renderHook(() => useCategoriasServicio(), { wrapper: envolver() });
    await waitFor(() => expect(result.current.fallo).toBe(true));
    expect(result.current.cargando).toBe(false);
  });
});

describe('useNegocios', () => {
  it('pasa la categoría y el texto SIN espacios sobrantes al servicio', async () => {
    mockNegocios.mockResolvedValue([]);
    const { result } = await renderHook(() => useNegocios({ categoriaId: 'cafes', texto: '  taco ' }), {
      wrapper: envolver(),
    });
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(mockNegocios).toHaveBeenCalledWith({ categoriaId: 'cafes', texto: 'taco' });
  });

  it('distingue vacío de fallo', async () => {
    mockNegocios.mockResolvedValue([]);
    const vacio = await renderHook(() => useNegocios({}), { wrapper: envolver() });
    await waitFor(() => expect(vacio.result.current.cargando).toBe(false));
    expect(vacio.result.current.negocios).toEqual([]);
    expect(vacio.result.current.fallo).toBe(false);

    mockNegocios.mockRejectedValue(new Error('sin red'));
    const roto = await renderHook(() => useNegocios({ texto: 'otro' }), { wrapper: envolver() });
    await waitFor(() => expect(roto.result.current.fallo).toBe(true));
  });
});

describe('useNegocio', () => {
  it('trae el negocio y su menú', async () => {
    mockNegocio.mockResolvedValue({ negocio: { id: 'n1' }, items: [{ id: 'i1' }] });
    const { result } = await renderHook(() => useNegocio('n1'), { wrapper: envolver() });
    await waitFor(() => expect(result.current.negocio).toEqual({ id: 'n1' }));
    expect(result.current.items).toEqual([{ id: 'i1' }]);
  });

  it('sin id no consulta nada y no se queda «cargando»', async () => {
    const { result } = await renderHook(() => useNegocio(undefined), { wrapper: envolver() });
    expect(mockNegocio).not.toHaveBeenCalled();
    expect(result.current.cargando).toBe(false);
  });

  it('un negocio que no existe o no es visible es null, no un fallo', async () => {
    mockNegocio.mockResolvedValue(null);
    const { result } = await renderHook(() => useNegocio('x'), { wrapper: envolver() });
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.negocio).toBeNull();
    expect(result.current.fallo).toBe(false);
  });
});
