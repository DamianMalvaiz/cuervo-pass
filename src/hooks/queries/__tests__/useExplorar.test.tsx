import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

// Explorar sin cuenta: los hooks distinguen cargando / falló / vacío (END-11). «Falló» jamás se pinta como «no hay nada».

const mockListarPub = jest.fn();
const mockListarNeg = jest.fn();
const mockCategorias = jest.fn();
const mockFotos = jest.fn();
jest.mock('@/services/explorar.service', () => ({
  listarPublicacionesPublicas: (...a: unknown[]) => mockListarPub(...a),
  obtenerPublicacionPublica: jest.fn(),
  listarNegociosPublicos: (...a: unknown[]) => mockListarNeg(...a),
  obtenerNegocioPublico: jest.fn(),
  listarCategoriasPublicas: (...a: unknown[]) => mockCategorias(...a),
  fotosPublicas: (...a: unknown[]) => mockFotos(...a),
}));

import { clienteDePrueba } from '@pruebas/consultas';
import { useCategoriasPublicas, useFotosPublicas, useNegociosPublicos, usePublicacionesPublicas } from '@/hooks/queries/useExplorar';

const envolver = () => {
  const cliente = clienteDePrueba({ queries: { staleTime: 1000, retry: false } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
};

beforeEach(() => jest.clearAllMocks());

test('publicaciones: entrega los datos y pasa el filtro al servicio', async () => {
  mockListarPub.mockResolvedValue([{ id: 'p1' }]);
  const { result } = await renderHook(() => usePublicacionesPublicas({ limite: 8, precioMax: 4000 }), { wrapper: envolver() });
  expect(result.current.cargando).toBe(true);
  await waitFor(() => expect(result.current.cargando).toBe(false));
  expect(result.current.publicaciones).toEqual([{ id: 'p1' }]);
  expect(result.current.fallo).toBe(false);
  expect(mockListarPub).toHaveBeenCalledWith({ limite: 8, precioMax: 4000 });
});

test('publicaciones: si falla, dice «falló» y NO «vacío»', async () => {
  mockListarPub.mockRejectedValue(new Error('red'));
  const { result } = await renderHook(() => usePublicacionesPublicas({ limite: 8 }), { wrapper: envolver() });
  await waitFor(() => expect(result.current.fallo).toBe(true));
  expect(result.current.cargando).toBe(false);
});

test('negocios y categorías: mismos tres estados', async () => {
  mockListarNeg.mockResolvedValue([{ id: 'n1' }]);
  mockCategorias.mockRejectedValue(new Error('x'));
  const w = envolver();
  const n = await renderHook(() => useNegociosPublicos({ limite: 6 }), { wrapper: w });
  const c = await renderHook(() => useCategoriasPublicas(), { wrapper: w });
  await waitFor(() => expect(n.result.current.negocios).toEqual([{ id: 'n1' }]));
  await waitFor(() => expect(c.result.current.fallo).toBe(true));
});

test('fotos: sin id no consulta; con id trae las URL; si falla lo dice', async () => {
  const w = envolver();
  const sin = await renderHook(() => useFotosPublicas('publicacion', undefined, 2), { wrapper: w });
  expect(sin.result.current.fotos).toEqual([]);
  expect(mockFotos).not.toHaveBeenCalled();

  mockFotos.mockResolvedValueOnce(['https://f/1']);
  const con = await renderHook(() => useFotosPublicas('publicacion', 'p1', 1), { wrapper: w });
  await waitFor(() => expect(con.result.current.fotos).toEqual(['https://f/1']));

  mockFotos.mockRejectedValueOnce(new Error('500'));
  const mal = await renderHook(() => useFotosPublicas('negocio', 'n1', 1), { wrapper: w });
  await waitFor(() => expect(mal.result.current.fallo).toBe(true));
});

test('fotos: si la vista dice que no hay ninguna (num_fotos = 0), ni se pide a la función', async () => {
  const { result } = await renderHook(() => useFotosPublicas('negocio', 'n9', 0), { wrapper: envolver() });
  expect(result.current.fotos).toEqual([]);
  expect(mockFotos).not.toHaveBeenCalled();
});
