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
const mockDesde = jest.fn();
const mockGenerarEmbedding = jest.fn();
const mockGeocodificar = jest.fn();
const mockSubirFoto = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...a: unknown[]) => mockRpc(...a), from: (...a: unknown[]) => mockDesde(...a) },
}));
jest.mock('@/lib/aiService', () => ({ generarEmbedding: (...a: unknown[]) => mockGenerarEmbedding(...a) }));
jest.mock('@/lib/geocoding', () => ({
  geocodificarDireccion: (...a: unknown[]) => mockGeocodificar(...a),
  ATRIBUCION_MAPA: '© OpenStreetMap contributors',
}));
jest.mock('@/lib/storage', () => ({ subirFotoPublicacion: (...a: unknown[]) => mockSubirFoto(...a) }));

/** Doble encadenable: `.select().eq().single()` y `await` directo sobre el
 *  constructor, que es como lo usan las escrituras de este servicio. */
function cadena(resultado: { data?: unknown; error?: unknown }) {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'insert', 'update', 'upsert', 'order', 'limit', 'neq', 'or']) {
    c[m] = jest.fn(() => c);
  }
  c.single = jest.fn(async () => resultado);
  c.maybeSingle = jest.fn(async () => resultado);
  c.then = (f: (v: unknown) => unknown) => Promise.resolve(resultado).then(f);
  return c;
}

import {
  cambiarEstadoPublicacion,
  contarContactosRecibidos,
  crearPublicacion,
  obtenerAfinidad,
  obtenerNuevasEstaSemana,
  obtenerPublicacionPublica,
  obtenerSugerencias,
  reintentarGeocodingPendiente,
  reportarPublicacion,
  revelarContacto,
} from '../publicaciones.service';

const fila = (id: string, similitud: number | null) => ({
  id, titulo: `Depa ${id}`, tipo: 'depa', direccion: 'Calle 1',
  precio_renta: 2800, descripcion: null, fotos: null,
  permite_mascotas: false, amueblado: false, latitud: 19.29, longitud: -99.56,
  distancia: 1.2, score: 0.8, similitud,
  score_final: similitud == null ? 0.8 : 0.84,
  nivel: similitud == null ? 1 : 2,
});

beforeEach(() => {
  mockRpc.mockReset();
  mockDesde.mockReset();
  mockGenerarEmbedding.mockReset();
  mockGeocodificar.mockReset();
  mockSubirFoto.mockReset();
});

test('una sola llamada al motor, sin respaldo todo-o-nada', async () => {
  mockRpc.mockResolvedValue({ data: [fila('a', 0.9)], error: null });
  await obtenerSugerencias(30);
  expect(mockRpc).toHaveBeenCalledTimes(1);
  expect(mockRpc).toHaveBeenCalledWith('sugerencias_con_ranking', { p_limite: 30, p_tipo: null, p_orden: 'ajuste' });
});

// END-17 · El tipo tiene que LLEGAR al servidor. Entre C.3 y B.3 entraba en la
// clave de caché de react-query y no en la llamada, así que cada chip estrenaba
// su propio cubo y pedía exactamente lo mismo: tocar «Cuarto» no filtraba nada.
// Esta prueba mira el argumento, que es donde estaba la mentira.
test('el tipo viaja en la llamada, no solo en la clave de caché', async () => {
  mockRpc.mockResolvedValue({ data: [], error: null });
  await obtenerSugerencias(30, 'cuarto');
  expect(mockRpc).toHaveBeenCalledWith('sugerencias_con_ranking', { p_limite: 30, p_tipo: 'cuarto', p_orden: 'ajuste' });
});

// Sin tipo se manda null explícito y no se omite el parámetro: PostgREST
// resuelve la función por los nombres de argumento que recibe, y omitirlo
// dejaría la llamada dependiendo del default del servidor. Que el default diga
// hoy lo mismo no lo hace lo mismo.
// END-32 · El orden tambien viaja al servidor. Ordenar en el cliente seria
// ordenar el top-30 YA TRUNCADO por encaje: «menor renta» daria las mas baratas
// de las treinta que mejor encajan, que es END-17 con otro disfraz. El carrusel
// «Las de menor renta» tenia exactamente ese defecto.
test('el orden viaja al servidor, no se aplica sobre la pagina ya truncada', async () => {
  mockRpc.mockResolvedValue({ data: [], error: null });
  await obtenerSugerencias(30, null, 'precio');
  expect(mockRpc).toHaveBeenCalledWith('sugerencias_con_ranking', {
    p_limite: 30, p_tipo: null, p_orden: 'precio',
  });
});

test('«Todo» manda null explícito', async () => {
  mockRpc.mockResolvedValue({ data: [], error: null });
  await obtenerSugerencias(30, null);
  expect(mockRpc).toHaveBeenCalledWith('sugerencias_con_ranking', { p_limite: 30, p_tipo: null, p_orden: 'ajuste' });
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

// ═══════════════════════════════════════════════════════════════════════════
// END-22 · El resto del servicio. Hasta aqui solo se probaba
// `obtenerSugerencias`: 74 de 80 sentencias del archivo sin cubrir, en la capa
// que decide QUE ve el usuario y que ESCRIBE en su nombre.
// ═══════════════════════════════════════════════════════════════════════════

import type { Publicacion } from '@/types/database.types';

const datosBase = {
  usuarioId: 'u1',
  titulo: 'Depa',
  tipo: 'depa' as const,
  direccion: 'Calle 1',
  precioRenta: 3000,
  permiteMascotas: false,
  amueblado: true,
  serviciosIncluidos: false,
  recamaras: 1,
  whatsapp: '5512345678',
  fotos: [],
};

// ── Lectura ───────────────────────────────────────────────────────────────

// END-28 · La vista SI expone `vector_embedding`, porque el ranking lo necesita
// del lado del servidor. Con `select('*')` esos 4 697 bytes bajaban al telefono
// en cada apertura de ficha. Si alguien «simplifica» esto de vuelta al
// asterisco, nada falla y la fuga vuelve.
test('la ficha enumera columnas y NO pide el vector', async () => {
  const c = cadena({ data: { id: 'p1' }, error: null });
  mockDesde.mockReturnValue(c);
  await obtenerPublicacionPublica('p1');
  const [columnas] = (c.select as jest.Mock).mock.calls[0];
  expect(columnas).not.toBe('*');
  expect(columnas).not.toContain('vector_embedding');
  expect(columnas).toContain('titulo');
});

test('la ficha sale de la VISTA publica, que no trae el telefono', async () => {
  mockDesde.mockReturnValue(cadena({ data: null, error: null }));
  await obtenerPublicacionPublica('p1');
  expect(mockDesde).toHaveBeenCalledWith('publicaciones_publicas');
  expect(mockDesde).not.toHaveBeenCalledWith('publicaciones');
});

test('las novedades llevan limite y tipo al servidor', async () => {
  mockRpc.mockResolvedValue({ data: [], error: null });
  await obtenerNuevasEstaSemana(10, 'cuarto');
  expect(mockRpc).toHaveBeenCalledWith('nuevas_esta_semana', { p_limite: 10, p_tipo: 'cuarto' });
});

// Este contador es ACCESORIO: adorna «Mis publicaciones» con cuanta gente pidio
// tu contacto. Si falla, se devuelve un Map vacio y la pantalla se pinta sin el
// dato — NO se propaga. Es la excepcion deliberada a §27, y por eso conviene
// que este fijada: un fallo silencioso aqui es correcto, en cualquier otra
// lectura de este archivo no lo seria.
test('si el contador de contactos falla, devuelve vacio en vez de tumbar la pantalla', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
  await expect(contarContactosRecibidos()).resolves.toEqual(new Map());
});

test('el contador convierte a numero: la RPC puede devolver el total como texto', async () => {
  mockRpc.mockResolvedValue({ data: [{ publicacion_id: 'p1', total: '7' }], error: null });
  const m = await contarContactosRecibidos();
  expect(m.get('p1')).toBe(7);
});

test('revelar contacto manda solo el id: la metrica la calcula el servidor', async () => {
  mockRpc.mockResolvedValue({ data: '5512345678', error: null });
  await expect(revelarContacto('p1')).resolves.toBe('5512345678');
  expect(mockRpc).toHaveBeenCalledWith('revelar_contacto', { p_publicacion_id: 'p1' });
});

test('la afinidad se pregunta por publicacion, sin pasar el usuario', async () => {
  mockRpc.mockResolvedValue({ data: [{ score: 0.8, similitud: 0.9, score_final: 0.84, nivel: 2 }], error: null });
  await obtenerAfinidad('p1');
  expect(mockRpc).toHaveBeenCalledWith('afinidad_de', { p_publicacion_id: 'p1' });
});

// ── Escritura ─────────────────────────────────────────────────────────────

// §27 · El microservicio caido no puede impedir publicar. Y la columna se OMITE
// en vez de mandarse null: mandar null borraria un vector previo.
test('sin embedding la publicacion se crea igual, y la columna ni se toca', async () => {
  mockGenerarEmbedding.mockRejectedValue(new Error('tunel caido'));
  mockGeocodificar.mockResolvedValue(null);
  const c = cadena({ data: { id: 'p1', fotos: [] }, error: null });
  mockDesde.mockReturnValue(c);
  await expect(crearPublicacion(datosBase)).resolves.toMatchObject({ id: 'p1' });
  const [fila] = (c.insert as jest.Mock).mock.calls[0];
  expect('vector_embedding' in fila).toBe(false);
});

// §27 · Lo mismo con el geocoding, y ademas deja la marca para reintentar. Sin
// `pendiente_geocoding`, una publicacion sin coordenadas es indistinguible de
// una que se geocodifico en el mar.
test('sin coordenadas se guarda marcada como pendiente', async () => {
  mockGenerarEmbedding.mockResolvedValue([0.1]);
  mockGeocodificar.mockResolvedValue(null);
  const c = cadena({ data: { id: 'p1', fotos: [] }, error: null });
  mockDesde.mockReturnValue(c);
  await crearPublicacion(datosBase);
  const [fila] = (c.insert as jest.Mock).mock.calls[0];
  expect(fila.pendiente_geocoding).toBe(true);
  expect(fila.latitud).toBeNull();
});

test('con coordenadas se anota el proveedor, para saber bajo que licencia vinieron', async () => {
  mockGenerarEmbedding.mockResolvedValue([0.1]);
  mockGeocodificar.mockResolvedValue({ lat: 19.3, lng: -99.4, proveedor: 'nominatim-osm-odbl' });
  const c = cadena({ data: { id: 'p1', fotos: [] }, error: null });
  mockDesde.mockReturnValue(c);
  await crearPublicacion(datosBase);
  const [fila] = (c.insert as jest.Mock).mock.calls[0];
  expect(fila.geocodificado_por).toBe('nominatim-osm-odbl');
  expect(fila.pendiente_geocoding).toBe(false);
});

// v3 adivinaba los atributos con `descripcion.includes('mascota')`, que hace que
// «NO acepto mascotas» cuente como que si. Un filtro duro no se puede construir
// sobre eso.
test('los atributos viajan EXPLICITOS, no inferidos del texto', async () => {
  mockGenerarEmbedding.mockResolvedValue(null);
  mockGeocodificar.mockResolvedValue(null);
  const c = cadena({ data: { id: 'p1', fotos: [] }, error: null });
  mockDesde.mockReturnValue(c);
  await crearPublicacion({ ...datosBase, descripcion: 'NO acepto mascotas', permiteMascotas: false });
  const [fila] = (c.insert as jest.Mock).mock.calls[0];
  expect(fila.permite_mascotas).toBe(false);
  expect(fila.amueblado).toBe(true);
});

test('cambiar estado actualiza solo la columna activa', async () => {
  const c = cadena({ error: null });
  mockDesde.mockReturnValue(c);
  await cambiarEstadoPublicacion('p1', false);
  expect(c.update).toHaveBeenCalledWith({ activa: false });
  expect(c.eq).toHaveBeenCalledWith('id', 'p1');
});

test('reportar inserta con los tres campos', async () => {
  const c = cadena({ error: null });
  mockDesde.mockReturnValue(c);
  await reportarPublicacion('yo', 'p1', 'informacion falsa');
  expect(mockDesde).toHaveBeenCalledWith('reportes');
  expect(c.insert).toHaveBeenCalledWith({
    reportado_por: 'yo',
    publicacion_id: 'p1',
    motivo: 'informacion falsa',
  });
});

// ── Reintento de geocoding ────────────────────────────────────────────────

const pub = (id: string, pendiente: boolean): Publicacion =>
  ({ id, direccion: `Calle ${id}`, pendiente_geocoding: pendiente }) as Publicacion;

test('solo se reintentan las pendientes: las demas ni se tocan', async () => {
  mockGeocodificar.mockResolvedValue({ lat: 1, lng: 2, proveedor: 'x' });
  mockDesde.mockReturnValue(cadena({ error: null }));
  const n = await reintentarGeocodingPendiente([pub('a', false), pub('b', true), pub('c', false)]);
  expect(mockGeocodificar).toHaveBeenCalledTimes(1);
  expect(n).toBe(1);
});

// Una que sigue fallando no cuenta como resuelta ni deja de ser pendiente. Si
// contara, la pantalla diria «3 resueltas» y las tres seguirian sin coordenadas.
test('una que sigue sin geocodificar no cuenta como resuelta', async () => {
  mockGeocodificar.mockResolvedValue(null);
  mockDesde.mockReturnValue(cadena({ error: null }));
  const n = await reintentarGeocodingPendiente([pub('b', true)]);
  expect(n).toBe(0);
});

test('si el update falla, tampoco cuenta', async () => {
  mockGeocodificar.mockResolvedValue({ lat: 1, lng: 2, proveedor: 'x' });
  mockDesde.mockReturnValue(cadena({ error: { message: 'no se pudo' } }));
  const n = await reintentarGeocodingPendiente([pub('b', true)]);
  expect(n).toBe(0);
});
