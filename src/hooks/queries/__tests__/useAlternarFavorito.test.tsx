import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

// El corazón. Es lo que más se toca y lo que más rápido tiene que responder, así que es OPTIMISTA: la lista de ids cambia al instante y, si el servidor falla,
// VUELVE exactamente a como estaba. Esa reversión nunca se probaba, y es lo que hace honesto un botón que responde antes de saber si funcionó.

const mockGuardar = jest.fn();
const mockQuitar = jest.fn();
jest.mock('@/services/favoritos.service', () => ({
  guardarFavorito: (...a: unknown[]) => mockGuardar(...a),
  quitarFavorito: (...a: unknown[]) => mockQuitar(...a),
  listarMisFavoritosIds: jest.fn().mockResolvedValue([]),
  listarMisFavoritos: jest.fn().mockResolvedValue([]),
  contarFavoritos: jest.fn().mockResolvedValue({}),
}));

import { clienteDePrueba } from '@pruebas/consultas';

import { useAlternarFavorito } from '../useFavoritos';

const CLAVE_IDS = ['favoritosIds', 'u1'];

const montar = (inicial?: string[]) => {
  const cliente = clienteDePrueba({ queries: { retry: false } });
  // Sin un observador, la caché de pruebas recolecta rápido lo que no se mira (ver test-utils/consultas.ts): se fija para que el dato sobreviva hasta la aserción.
  cliente.setQueryDefaults(CLAVE_IDS, { gcTime: Infinity, staleTime: Infinity });
  if (inicial) cliente.setQueryData(CLAVE_IDS, inicial);
  const Envoltura = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
  return { cliente, Envoltura };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGuardar.mockResolvedValue(undefined);
  mockQuitar.mockResolvedValue(undefined);
});

test('guardar llama a guardarFavorito con la cuenta y la publicación', async () => {
  const { Envoltura } = montar([]);
  const { result } = await renderHook(() => useAlternarFavorito('u1'), { wrapper: Envoltura });
  await act(async () => { await result.current.mutateAsync({ publicacionId: 'p1', guardar: true }); });
  expect(mockGuardar).toHaveBeenCalledWith('u1', 'p1');
  expect(mockQuitar).not.toHaveBeenCalled();
});

test('quitar llama a quitarFavorito', async () => {
  const { Envoltura } = montar(['p1']);
  const { result } = await renderHook(() => useAlternarFavorito('u1'), { wrapper: Envoltura });
  await act(async () => { await result.current.mutateAsync({ publicacionId: 'p1', guardar: false }); });
  expect(mockQuitar).toHaveBeenCalledWith('u1', 'p1');
});

test('AL INSTANTE: guardar pone la publicación primera en la lista, antes de que el servidor conteste', async () => {
  let resolver!: () => void;
  mockGuardar.mockReturnValue(new Promise<void>((r) => { resolver = r; }));
  const { cliente, Envoltura } = montar(['p2', 'p3']);
  const { result } = await renderHook(() => useAlternarFavorito('u1'), { wrapper: Envoltura });
  let promesa!: Promise<unknown>;
  await act(async () => { promesa = result.current.mutateAsync({ publicacionId: 'p1', guardar: true }); });
  await waitFor(() => expect(cliente.getQueryData(CLAVE_IDS)).toEqual(['p1', 'p2', 'p3']));
  resolver();
  // Se espera a que la mutación TERMINE: una pendiente al acabar la prueba se mezcla con la siguiente.
  await act(async () => { await promesa; });
});

test('guardar una que ya estaba no la duplica: la sube al principio', async () => {
  let resolver!: () => void;
  mockGuardar.mockReturnValue(new Promise<void>((r) => { resolver = r; }));
  const { cliente, Envoltura } = montar(['p2', 'p1', 'p3']);
  const { result } = await renderHook(() => useAlternarFavorito('u1'), { wrapper: Envoltura });
  let promesa!: Promise<unknown>;
  await act(async () => { promesa = result.current.mutateAsync({ publicacionId: 'p1', guardar: true }); });
  await waitFor(() => expect(cliente.getQueryData(CLAVE_IDS)).toEqual(['p1', 'p2', 'p3']));
  resolver();
  // Se espera a que la mutación TERMINE: una pendiente al acabar la prueba se mezcla con la siguiente.
  await act(async () => { await promesa; });
});

test('AL INSTANTE: quitar la saca de la lista', async () => {
  let resolver!: () => void;
  mockQuitar.mockReturnValue(new Promise<void>((r) => { resolver = r; }));
  const { cliente, Envoltura } = montar(['p1', 'p2']);
  const { result } = await renderHook(() => useAlternarFavorito('u1'), { wrapper: Envoltura });
  let promesa!: Promise<unknown>;
  await act(async () => { promesa = result.current.mutateAsync({ publicacionId: 'p1', guardar: false }); });
  await waitFor(() => expect(cliente.getQueryData(CLAVE_IDS)).toEqual(['p2']));
  resolver();
  // Se espera a que la mutación TERMINE: una pendiente al acabar la prueba se mezcla con la siguiente.
  await act(async () => { await promesa; });
});

test('si el servidor FALLA al guardar, la lista VUELVE exactamente a como estaba', async () => {
  mockGuardar.mockRejectedValue(new Error('sin red'));
  const { cliente, Envoltura } = montar(['p2', 'p3']);
  // Sin esto, `onSettled` volvería a pedir la lista al servidor (que devuelve []) y taparía lo que se quiere comprobar: la reversión OPTIMISTA.
  cliente.setQueryDefaults(CLAVE_IDS, { gcTime: Infinity, staleTime: Infinity, queryFn: () => ['p2', 'p3'] });
  const { result } = await renderHook(() => useAlternarFavorito('u1'), { wrapper: Envoltura });
  await act(async () => { await expect(result.current.mutateAsync({ publicacionId: 'p1', guardar: true })).rejects.toThrow('sin red'); });
  expect(cliente.getQueryData(CLAVE_IDS)).toEqual(['p2', 'p3']);
});

test('si FALLA al quitar, la que se quitó VUELVE a su sitio', async () => {
  mockQuitar.mockRejectedValue(new Error('sin red'));
  const { cliente, Envoltura } = montar(['p1', 'p2']);
  cliente.setQueryDefaults(CLAVE_IDS, { gcTime: Infinity, staleTime: Infinity, queryFn: () => ['p1', 'p2'] });
  const { result } = await renderHook(() => useAlternarFavorito('u1'), { wrapper: Envoltura });
  await act(async () => { await expect(result.current.mutateAsync({ publicacionId: 'p1', guardar: false })).rejects.toThrow('sin red'); });
  expect(cliente.getQueryData(CLAVE_IDS)).toEqual(['p1', 'p2']);
});

test('pase lo que pase se vuelve a pedir al servidor: ids, lista y conteos', async () => {
  mockGuardar.mockRejectedValue(new Error('x'));
  const { cliente, Envoltura } = montar([]);
  const invalidar = jest.spyOn(cliente, 'invalidateQueries');
  const { result } = await renderHook(() => useAlternarFavorito('u1'), { wrapper: Envoltura });
  await act(async () => { await result.current.mutateAsync({ publicacionId: 'p1', guardar: true }).catch(() => undefined); });
  const claves = invalidar.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown }).queryKey));
  expect(claves).toEqual(expect.arrayContaining([JSON.stringify(CLAVE_IDS), JSON.stringify(['favoritos', 'u1']), JSON.stringify(['conteoFavoritos'])]));
});

test('lo que guardas mueve tu orden y tu afinidad (0071): se vuelven a pedir', async () => {
  mockGuardar.mockResolvedValue(undefined);
  const { cliente, Envoltura } = montar([]);
  const invalidar = jest.spyOn(cliente, 'invalidateQueries');
  const { result } = await renderHook(() => useAlternarFavorito('u1'), { wrapper: Envoltura });
  await act(async () => { await result.current.mutateAsync({ publicacionId: 'p1', guardar: true }); });
  const claves = invalidar.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown }).queryKey));
  expect(claves).toEqual(expect.arrayContaining([JSON.stringify(['sugerencias']), JSON.stringify(['afinidad'])]));
});

test('sin lista previa también funciona (la primera vez que se guarda algo)', async () => {
  let resolver!: () => void;
  mockGuardar.mockReturnValue(new Promise<void>((r) => { resolver = r; }));
  const { cliente, Envoltura } = montar();
  const { result } = await renderHook(() => useAlternarFavorito('u1'), { wrapper: Envoltura });
  let promesa!: Promise<unknown>;
  await act(async () => { promesa = result.current.mutateAsync({ publicacionId: 'p1', guardar: true }); });
  await waitFor(() => expect(cliente.getQueryData(CLAVE_IDS)).toEqual(['p1']));
  resolver();
  // Se espera a que la mutación TERMINE: una pendiente al acabar la prueba se mezcla con la siguiente.
  await act(async () => { await promesa; });
});
