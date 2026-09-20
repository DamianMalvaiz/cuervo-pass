// END-22 · El servicio de roomies, con §27 como eje: si el microservicio de IA
// falla, la ficha se guarda IGUAL y aparece al final de la lista en vez de no
// aparecer. Eso no se puede comprobar mirando la pantalla — el usuario ve su
// ficha guardada en los dos casos.

const mockDesde = jest.fn();
const mockRpc = jest.fn();
const mockEmbedding = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: { from: (...a: unknown[]) => mockDesde(...a), rpc: (...a: unknown[]) => mockRpc(...a) },
}));
jest.mock('@/lib/aiService', () => ({ generarEmbedding: (...a: unknown[]) => mockEmbedding(...a) }));

import { guardarMiRoomie, listarRoomiesSugeridos, obtenerMiRoomie } from '../roomies.service';

function cadena(resultado: { data?: unknown; error?: unknown }) {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'insert', 'update', 'upsert', 'order', 'limit']) c[m] = jest.fn(() => c);
  c.maybeSingle = jest.fn(async () => resultado);
  c.single = jest.fn(async () => resultado);
  c.then = (f: (v: unknown) => unknown) => Promise.resolve(resultado).then(f);
  return c;
}

beforeEach(() => {
  mockDesde.mockReset();
  mockRpc.mockReset();
  mockEmbedding.mockReset();
});

test('las sugerencias de roomie van por la RPC con su limite', async () => {
  mockRpc.mockResolvedValue({ data: [{ id: 'r1' }], error: null });
  await listarRoomiesSugeridos(30);
  expect(mockRpc).toHaveBeenCalledWith('sugerencias_roomies', { p_limite: 30 });
});

test('una respuesta sin filas no revienta', async () => {
  mockRpc.mockResolvedValue({ data: null, error: null });
  await expect(listarRoomiesSugeridos()).resolves.toEqual([]);
});

test('un error del motor se propaga en vez de devolver lista vacia', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { message: 'timeout' } });
  await expect(listarRoomiesSugeridos()).rejects.toMatchObject({ message: 'timeout' });
});

test('no tener ficha de roomie devuelve null, no un error', async () => {
  mockDesde.mockReturnValue(cadena({ data: null, error: null }));
  await expect(obtenerMiRoomie('u1')).resolves.toBeNull();
});

test('con vector, el upsert lo incluye', async () => {
  const c = cadena({ data: { id: 'r1' }, error: null });
  mockDesde.mockReturnValue(c);
  mockEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
  await guardarMiRoomie('u1', { descripcionBusqueda: 'busco algo tranquilo', estado: 'activo' });
  const [fila] = (c.upsert as jest.Mock).mock.calls[0];
  expect(fila.vector_busqueda).toEqual([0.1, 0.2, 0.3]);
});

// LA prueba. §27: el microservicio caido NO puede impedir que alguien publique
// su ficha. Y `vector_busqueda` se OMITE del upsert en vez de mandarse null:
// mandar null borraria un vector que ya estuviera guardado de un intento
// anterior, y una edicion de la descripcion con el tunel caido dejaria a la
// persona PEOR que antes de editar.
test('sin vector se guarda igual, y la columna ni se toca', async () => {
  const c = cadena({ data: { id: 'r1' }, error: null });
  mockDesde.mockReturnValue(c);
  mockEmbedding.mockRejectedValue(new Error('tunel caido'));
  await expect(
    guardarMiRoomie('u1', { descripcionBusqueda: 'busco algo tranquilo', estado: 'activo' })
  ).resolves.toMatchObject({ id: 'r1' });
  const [fila] = (c.upsert as jest.Mock).mock.calls[0];
  expect('vector_busqueda' in fila).toBe(false);
});

test('el upsert va por usuario_id, que es lo que impide dos fichas por persona', async () => {
  const c = cadena({ data: { id: 'r1' }, error: null });
  mockDesde.mockReturnValue(c);
  mockEmbedding.mockResolvedValue([0.1]);
  await guardarMiRoomie('u1', { descripcionBusqueda: 'x y z', estado: 'activo' });
  const [, opciones] = (c.upsert as jest.Mock).mock.calls[0];
  expect(opciones).toEqual({ onConflict: 'usuario_id' });
});

test('sin aportacion declarada se guarda null explicito, no undefined', async () => {
  const c = cadena({ data: { id: 'r1' }, error: null });
  mockDesde.mockReturnValue(c);
  mockEmbedding.mockResolvedValue([0.1]);
  await guardarMiRoomie('u1', { descripcionBusqueda: 'x y z', estado: 'activo' });
  const [fila] = (c.upsert as jest.Mock).mock.calls[0];
  expect(fila.presupuesto_aportacion).toBeNull();
});
