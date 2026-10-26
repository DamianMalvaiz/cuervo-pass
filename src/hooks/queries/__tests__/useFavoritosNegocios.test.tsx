import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

const mockIds = jest.fn();
const mockLista = jest.fn();
const mockGuardar = jest.fn();
const mockQuitar = jest.fn();
const mockConteo = jest.fn();
jest.mock('@/services/favoritos.service', () => ({
  listarMisNegociosFavoritosIds: (...a: unknown[]) => mockIds(...a),
  listarMisNegociosFavoritos: (...a: unknown[]) => mockLista(...a),
  guardarFavoritoNegocio: (...a: unknown[]) => mockGuardar(...a),
  quitarFavoritoNegocio: (...a: unknown[]) => mockQuitar(...a),
  contarFavoritosDeMisNegocios: (...a: unknown[]) => mockConteo(...a),
}));

import { clienteDePrueba } from '@pruebas/consultas';

import { useAlternarFavoritoNegocio, useConteoFavoritosDeMisNegocios, useMisNegociosFavoritos, useMisNegociosFavoritosIds } from '../useFavoritosNegocios';

const envolver = () => {
  const cliente = clienteDePrueba({ queries: { retry: false }, mutations: { gcTime: 0 } });
  const Envoltura = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
  return { Envoltura, cliente };
};

beforeEach(() => jest.clearAllMocks());

test('los ids: cargando no es «sin favoritos», y un fallo es fallo', async () => {
  mockIds.mockRejectedValue(new Error('x'));
  const { Envoltura } = envolver();
  const { result } = await renderHook(() => useMisNegociosFavoritosIds('u1'), { wrapper: Envoltura });
  expect(result.current.cargando).toBe(true);
  await waitFor(() => expect(result.current.fallo).toBe(true));
  expect(result.current.ids.size).toBe(0);
});

test('sin sesión no consulta', async () => {
  const { Envoltura } = envolver();
  await renderHook(() => useMisNegociosFavoritosIds(undefined), { wrapper: Envoltura });
  await renderHook(() => useMisNegociosFavoritos(undefined), { wrapper: Envoltura });
  expect(mockIds).not.toHaveBeenCalled();
  expect(mockLista).not.toHaveBeenCalled();
});

test('la lista trae negocios y cuántos ya no están', async () => {
  mockLista.mockResolvedValue({ negocios: [{ id: 'a' }], noDisponibles: 2 });
  const { Envoltura } = envolver();
  const { result } = await renderHook(() => useMisNegociosFavoritos('u1'), { wrapper: Envoltura });
  await waitFor(() => expect(result.current.negocios).toEqual([{ id: 'a' }]));
  expect(result.current.noDisponibles).toBe(2);
});

test('alternar es optimista y, si el servidor falla, VUELVE', async () => {
  mockGuardar.mockRejectedValue(new Error('sin red'));
  const { Envoltura, cliente } = envolver();
  cliente.setQueryDefaults(['favoritosNegociosIds', 'u1'], { gcTime: Infinity, staleTime: Infinity, queryFn: () => ['a'] });
  cliente.setQueryData(['favoritosNegociosIds', 'u1'], ['a']);
  const { result } = await renderHook(() => useAlternarFavoritoNegocio('u1'), { wrapper: Envoltura });
  await act(async () => { await expect(result.current.mutateAsync({ negocioId: 'n1', guardar: true })).rejects.toThrow('sin red'); });
  expect(cliente.getQueryData(['favoritosNegociosIds', 'u1'])).toEqual(['a']);
});

test('al terminar se vuelve a pedir ids y lista', async () => {
  mockGuardar.mockResolvedValue(undefined);
  const { Envoltura, cliente } = envolver();
  const invalidar = jest.spyOn(cliente, 'invalidateQueries');
  const { result } = await renderHook(() => useAlternarFavoritoNegocio('u1'), { wrapper: Envoltura });
  await act(async () => { await result.current.mutateAsync({ negocioId: 'n1', guardar: true }); });
  const claves = invalidar.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown }).queryKey));
  expect(claves).toEqual(expect.arrayContaining([JSON.stringify(['favoritosNegociosIds', 'u1']), JSON.stringify(['favoritosNegocios', 'u1'])]));
});

test('el conteo de MIS negocios: sin ids no consulta; con ids devuelve el mapa; un fallo es fallo', async () => {
  const { Envoltura } = envolver();
  const vacio = await renderHook(() => useConteoFavoritosDeMisNegocios([]), { wrapper: Envoltura });
  expect(mockConteo).not.toHaveBeenCalled();
  expect(vacio.result.current.cargando).toBe(false);

  mockConteo.mockResolvedValue(new Map([['n1', 3]]));
  const ok = await renderHook(() => useConteoFavoritosDeMisNegocios(['n1']), { wrapper: Envoltura });
  await waitFor(() => expect(ok.result.current.conteos.get('n1')).toBe(3));

  mockConteo.mockRejectedValue(new Error('x'));
  const roto = envolver();
  const r = await renderHook(() => useConteoFavoritosDeMisNegocios(['n2']), { wrapper: roto.Envoltura });
  await waitFor(() => expect(r.result.current.fallo).toBe(true));
  expect(r.result.current.conteos.size).toBe(0);
});
