// END-08 vivía aquí y `src/services` estaba al 0 % de cobertura. No es
// casualidad: la capa que decide QUÉ ve el usuario no tenía ninguna prueba.
//
// El defecto: `obtenerSugerencias` llamaba a `sugerencias_con_ranking`, y si
// devolvía aunque fuera UNA fila la daba por buena como «Nivel 2». Como esa
// función descartaba las publicaciones sin embedding, de veinte viables con
// tres vectorizadas el usuario veía tres y creía que ese era el catálogo.
//
// La migración 0027 mueve el filtro a un `left join`, así que ahora llegan
// todas con `similitud` en null cuando falta. Estas pruebas fijan que el
// servicio no vuelva a perder ninguna por el camino.

const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }));

import { obtenerSugerencias } from '../publicaciones.service';

const fila = (id: string, similitud: number | null) => ({
  id, titulo: `Depa ${id}`, tipo: 'depa', direccion: 'Calle 1',
  precio_renta: 2800, descripcion: null, fotos: null,
  permite_mascotas: false, amueblado: false, latitud: 19.29, longitud: -99.56,
  distancia: 1.2, score: 0.8, similitud,
  score_final: similitud == null ? 0.8 : 0.84,
  nivel: similitud == null ? 1 : 2,
});

beforeEach(() => mockRpc.mockReset());

test('una sola llamada al motor, sin respaldo todo-o-nada', async () => {
  mockRpc.mockResolvedValue({ data: [fila('a', 0.9)], error: null });
  await obtenerSugerencias(30);
  expect(mockRpc).toHaveBeenCalledTimes(1);
  expect(mockRpc).toHaveBeenCalledWith('sugerencias_con_ranking', { p_limite: 30 });
});

// LA prueba. Antes se devolvían solo las vectorizadas.
test('con filas mixtas no se pierde ninguna', async () => {
  mockRpc.mockResolvedValue({
    data: [fila('a', 0.91), fila('b', 0.88), fila('c', null), fila('d', null), fila('e', null)],
    error: null,
  });
  const r = await obtenerSugerencias(30);
  expect(r.datos).toHaveLength(5);
  expect(r.total).toBe(5);
  expect(r.conAfinidad).toBe(2);
});

test('sin ninguna afinidad el conteo es cero, y la lista sigue completa', async () => {
  mockRpc.mockResolvedValue({ data: [fila('a', null), fila('b', null)], error: null });
  const r = await obtenerSugerencias(30);
  expect(r.total).toBe(2);
  expect(r.conAfinidad).toBe(0);
});

test('con todas vectorizadas, conAfinidad iguala al total', async () => {
  mockRpc.mockResolvedValue({ data: [fila('a', 0.9), fila('b', 0.7)], error: null });
  const r = await obtenerSugerencias(30);
  expect(r.conAfinidad).toBe(r.total);
});

// Una similitud de 0 es una afinidad MEDIDA —dos vectores ortogonales— y
// cuenta. Null es la ausencia de medición. Confundirlas con un `!p.similitud`
// haría desaparecer del conteo justo las peores coincidencias reales.
test('similitud 0 cuenta como afinidad; null no', async () => {
  mockRpc.mockResolvedValue({ data: [fila('a', 0), fila('b', null)], error: null });
  const r = await obtenerSugerencias(30);
  expect(r.conAfinidad).toBe(1);
});

// §27: un fallo de lectura NO puede presentarse como catálogo vacío. Si esto
// devolviera una lista vacía, la pantalla diría «no hay nada» ante una caída
// de red — el mismo defecto que END-11 describe en otras dos pantallas.
test('un error del motor se propaga, no se disfraza de lista vacía', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { message: 'network error' } });
  await expect(obtenerSugerencias(30)).rejects.toMatchObject({ message: 'network error' });
});

test('una respuesta sin filas no revienta', async () => {
  mockRpc.mockResolvedValue({ data: null, error: null });
  const r = await obtenerSugerencias(30);
  expect(r.datos).toEqual([]);
  expect(r.total).toBe(0);
  expect(r.conAfinidad).toBe(0);
});
