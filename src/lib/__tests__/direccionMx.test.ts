// La búsqueda por código postal ya NO viene del paquete de la app (eran 9.6 MB, el 72 % del JavaScript): es una RPC (migración 0069). Eso introduce algo que
// antes no existía: la red puede fallar. Lo que se fija: «no existe» (null) y «falló» (lanza) son cosas DISTINTAS, y no se pega a la red por un código incompleto.

const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }));

import { ErrorBusquedaCP, buscarPorCodigoPostal } from '../direccionMx';

beforeEach(() => mockRpc.mockReset());

const fila = (extra: Record<string, unknown> = {}) => ({ estado: 'México', municipio: 'Lerma', ciudad: 'Santa María Atarasquillo', colonias: ['A', 'B'], ...extra });

test('pide la RPC con el código y devuelve estado, municipio, localidad y colonias', async () => {
  mockRpc.mockResolvedValue({ data: [fila()], error: null });
  expect(await buscarPorCodigoPostal('52044')).toEqual({ estado: 'México', municipio: 'Lerma', localidad: 'Santa María Atarasquillo', colonias: ['A', 'B'] });
  expect(mockRpc).toHaveBeenCalledWith('buscar_codigo_postal', { p_cp: '52044' });
});

test('un código que no existe devuelve null (no es un fallo)', async () => {
  mockRpc.mockResolvedValue({ data: [], error: null });
  expect(await buscarPorCodigoPostal('99999')).toBeNull();
  mockRpc.mockResolvedValue({ data: null, error: null });
  expect(await buscarPorCodigoPostal('99999')).toBeNull();
});

test('un código incompleto o raro NO toca la red', async () => {
  for (const cp of ['', '0600', '060000', 'abcde', '06 00']) expect(await buscarPorCodigoPostal(cp)).toBeNull();
  expect(mockRpc).not.toHaveBeenCalled();
});

test('recorta espacios alrededor', async () => {
  mockRpc.mockResolvedValue({ data: [fila()], error: null });
  await buscarPorCodigoPostal(' 52044 ');
  expect(mockRpc).toHaveBeenCalledWith('buscar_codigo_postal', { p_cp: '52044' });
});

test('la ciudad vacía o «NULL» queda como null: no se pinta «NULL» en un formulario', async () => {
  mockRpc.mockResolvedValue({ data: [fila({ ciudad: null })], error: null });
  expect((await buscarPorCodigoPostal('52044'))?.localidad).toBeNull();
  mockRpc.mockResolvedValue({ data: [fila({ ciudad: 'NULL' })], error: null });
  expect((await buscarPorCodigoPostal('52044'))?.localidad).toBeNull();
});

test('sin colonias en la respuesta no revienta', async () => {
  mockRpc.mockResolvedValue({ data: [fila({ colonias: null })], error: null });
  expect((await buscarPorCodigoPostal('52044'))?.colonias).toEqual([]);
});

test('un error de la RPC LANZA ErrorBusquedaCP: «falló la red» no es «no existe ese código»', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { message: 'sin red', code: '' } });
  await expect(buscarPorCodigoPostal('52044')).rejects.toBeInstanceOf(ErrorBusquedaCP);
});

test('si la llamada misma lanza (sin conexión) también es un ErrorBusquedaCP', async () => {
  mockRpc.mockRejectedValue(new Error('Network request failed'));
  await expect(buscarPorCodigoPostal('52044')).rejects.toBeInstanceOf(ErrorBusquedaCP);
});
