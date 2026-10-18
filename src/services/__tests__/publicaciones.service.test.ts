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
const mockBorrarFotos = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...a: unknown[]) => mockRpc(...a), from: (...a: unknown[]) => mockDesde(...a) },
}));
jest.mock('@/lib/aiService', () => ({ generarEmbedding: (...a: unknown[]) => mockGenerarEmbedding(...a) }));
jest.mock('@/lib/geocoding', () => ({
  geocodificarDireccion: (...a: unknown[]) => mockGeocodificar(...a),
  ATRIBUCION_MAPA: '© OpenStreetMap contributors',
}));
jest.mock('@/lib/storage', () => ({
  subirFotoPublicacion: (...a: unknown[]) => mockSubirFoto(...a),
  borrarFotos: (...a: unknown[]) => mockBorrarFotos(...a),
}));

/** Doble encadenable: `.select().eq().single()` y `await` directo sobre el
 *  constructor, que es como lo usan las escrituras de este servicio. */
function cadena(resultado: { data?: unknown; error?: unknown }) {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'insert', 'update', 'upsert', 'delete', 'order', 'limit', 'neq', 'or']) {
    c[m] = jest.fn(() => c);
  }
  c.single = jest.fn(async () => resultado);
  c.maybeSingle = jest.fn(async () => resultado);
  c.then = (f: (v: unknown) => unknown) => Promise.resolve(resultado).then(f);
  return c;
}

import {
  actualizarPublicacion,
  cambiarEstadoPublicacion,
  contarContactosRecibidos,
  crearPublicacion,
  obtenerAfinidad,
  obtenerParecidas,
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

test('la afinidad trae el «parecido a» del servidor, o null', async () => {
  mockRpc.mockResolvedValue({ data: [{ score: 0.8, similitud: 0.9, score_final: 0.84, nivel: 2, parecido_a: 'Depa A' }], error: null });
  await expect(obtenerAfinidad('p1')).resolves.toMatchObject({ parecidoA: 'Depa A' });
  mockRpc.mockResolvedValue({ data: [{ score: 0.8, similitud: 0.9, score_final: 0.84, nivel: 2 }], error: null });
  await expect(obtenerAfinidad('p1')).resolves.toMatchObject({ parecidoA: null });
});

test('«parecidos a este» pide a la base la publicación y un tope', async () => {
  mockRpc.mockResolvedValue({ data: [{ id: 'q1' }], error: null });
  await expect(obtenerParecidas('p1')).resolves.toEqual([{ id: 'q1' }]);
  expect(mockRpc).toHaveBeenCalledWith('publicaciones_parecidas', { p_publicacion: 'p1', p_limite: 4 });
});

test('si falla pedir los parecidos, LANZA y no devuelve una lista vacía', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { message: 'sin red' } });
  await expect(obtenerParecidas('p1')).rejects.toMatchObject({ message: 'sin red' });
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

// ── Editar: las coordenadas no se pierden por un fallo ajeno ──────────────────

// Hallazgo 5 (revisión del 15/10/2026). `actualizarPublicacion` geocodificaba en
// CADA guardado y escribía `coords?.lat ?? null`: si Nominatim o la Edge
// Function fallaban, cambiar solo el precio dejaba la publicación sin
// coordenadas y sin mapa. Un fallo de un servicio externo, sobre un dato que no
// se tocó, borraba un dato bueno.
//
// La regla, y por qué son dos casos y no uno:
//   · misma dirección y con coordenadas → siguen valiendo; ni se geocodifica.
//   · dirección cambiada y el geocoding falla → las viejas apuntan a OTRO sitio,
//     así que se anulan y se marca para reintentar. Conservarlas pondría el pin
//     en un lugar que ya no es el de la dirección.
const anteriorConMapa = { direccion: 'Calle 1', latitud: 19.29, longitud: -99.56 };

test('editar sin cambiar la dirección NO geocodifica ni toca las coordenadas', async () => {
  mockGenerarEmbedding.mockResolvedValue([0.1]);
  const c = cadena({ data: { id: 'p1' }, error: null });
  mockDesde.mockReturnValue(c);

  await actualizarPublicacion('p1', { ...datosBase, precioRenta: 3500 }, anteriorConMapa);

  expect(mockGeocodificar).not.toHaveBeenCalled();
  const [cambios] = (c.update as jest.Mock).mock.calls[0];
  for (const columna of ['latitud', 'longitud', 'geocodificado_por', 'pendiente_geocoding']) {
    expect(columna in cambios).toBe(false);
  }
  expect(cambios.precio_renta).toBe(3500);
});

test('con la dirección cambiada y el geocoding caído, se anulan y se marca pendiente', async () => {
  mockGenerarEmbedding.mockResolvedValue([0.1]);
  mockGeocodificar.mockResolvedValue(null);
  const c = cadena({ data: { id: 'p1' }, error: null });
  mockDesde.mockReturnValue(c);

  await actualizarPublicacion('p1', { ...datosBase, direccion: 'Calle 2' }, anteriorConMapa);

  const [cambios] = (c.update as jest.Mock).mock.calls[0];
  expect(cambios.latitud).toBeNull();
  expect(cambios.longitud).toBeNull();
  expect(cambios.pendiente_geocoding).toBe(true);
});

test('con la dirección cambiada y el geocoding bien, se guardan las nuevas', async () => {
  mockGenerarEmbedding.mockResolvedValue([0.1]);
  mockGeocodificar.mockResolvedValue({ lat: 19.4, lng: -99.1, proveedor: 'nominatim-osm-odbl' });
  const c = cadena({ data: { id: 'p1' }, error: null });
  mockDesde.mockReturnValue(c);

  await actualizarPublicacion('p1', { ...datosBase, direccion: 'Calle 2' }, anteriorConMapa);

  expect(mockGeocodificar).toHaveBeenCalledWith('Calle 2');
  const [cambios] = (c.update as jest.Mock).mock.calls[0];
  expect(cambios).toMatchObject({
    latitud: 19.4,
    longitud: -99.1,
    geocodificado_por: 'nominatim-osm-odbl',
    pendiente_geocoding: false,
  });
});

// Misma dirección PERO sin coordenadas previas: era una pendiente. Editar es una
// oportunidad de resolverla, así que sí se intenta.
test('misma dirección pero sin coordenadas previas: se intenta geocodificar', async () => {
  mockGenerarEmbedding.mockResolvedValue([0.1]);
  mockGeocodificar.mockResolvedValue({ lat: 19.4, lng: -99.1, proveedor: 'nominatim-osm-odbl' });
  const c = cadena({ data: { id: 'p1' }, error: null });
  mockDesde.mockReturnValue(c);

  await actualizarPublicacion('p1', datosBase, { direccion: 'Calle 1', latitud: null, longitud: null });

  expect(mockGeocodificar).toHaveBeenCalledTimes(1);
  const [cambios] = (c.update as jest.Mock).mock.calls[0];
  expect(cambios.pendiente_geocoding).toBe(false);
});

// Un espacio de más al final no es otra dirección.
test('un espacio sobrante en la dirección no cuenta como cambio', async () => {
  mockGenerarEmbedding.mockResolvedValue([0.1]);
  const c = cadena({ data: { id: 'p1' }, error: null });
  mockDesde.mockReturnValue(c);

  await actualizarPublicacion('p1', { ...datosBase, direccion: 'Calle 1 ' }, anteriorConMapa);

  expect(mockGeocodificar).not.toHaveBeenCalled();
});

// ── Crear: nunca queda una publicación a medias a la vista de todos ───────────

// Hallazgo 6 (revisión del 15/10/2026). `crearPublicacion` insertaba la fila,
// luego subía las fotos y luego actualizaba `fotos`. Tres pasos sin ninguna
// coordinación:
//
//   · Si una subida fallaba, quedaba una publicación SIN FOTOS en el catálogo de
//     todos, y quien publicaba, al ver el error, la volvía a crear: duplicada.
//   · Si la app moría a mitad de la subida —el sistema mata procesos en segundo
//     plano todo el tiempo— no corría ningún código de limpieza y la fila a
//     medias se quedaba para siempre.
//
// La solución tiene dos mitades, porque una sola no cubre los dos casos:
//   1. La fila nace INACTIVA cuando hay fotos que subir y se activa en el mismo
//      `update` que escribe `fotos`. Cubre la muerte del proceso: aunque nada se
//      limpie, nadie ve la fila.
//   2. Si algo falla y el proceso sigue vivo, se DESHACE: se borran los archivos
//      subidos y la fila, y se propaga el error ORIGINAL.
const RUTA = (i: number) => `publicaciones/u1/p1/${i}.jpg`;
const fotosNuevas = [
  { esNueva: true as const, uri: 'file:///a.jpg' },
  { esNueva: true as const, uri: 'file:///b.jpg' },
];
const conFotos = { ...datosBase, fotos: fotosNuevas };

describe('crearPublicacion con fotos', () => {
  beforeEach(() => {
    mockGenerarEmbedding.mockResolvedValue([0.1]);
    mockGeocodificar.mockResolvedValue(null);
    mockBorrarFotos.mockReset();
    mockBorrarFotos.mockResolvedValue(undefined);
    mockSubirFoto.mockImplementation(async (_u: string, _p: string, i: number) => RUTA(i));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  test('la fila nace INACTIVA y se activa en el mismo update que escribe las fotos', async () => {
    const insertar = cadena({ data: { id: 'p1' }, error: null });
    const actualizar = cadena({ data: { id: 'p1', fotos: [RUTA(0), RUTA(1)] }, error: null });
    mockDesde.mockReturnValueOnce(insertar).mockReturnValueOnce(actualizar);

    await crearPublicacion(conFotos);

    const [fila] = (insertar.insert as jest.Mock).mock.calls[0];
    expect(fila.activa).toBe(false);
    expect(actualizar.update).toHaveBeenCalledWith({ fotos: [RUTA(0), RUTA(1)], activa: true });
  });

  // Sin fotos no hay nada que pueda quedar a medias: nace activa y termina ahí.
  test('sin fotos no nace inactiva ni hace un segundo paso', async () => {
    const insertar = cadena({ data: { id: 'p1' }, error: null });
    mockDesde.mockReturnValueOnce(insertar);

    await crearPublicacion(datosBase);

    const [fila] = (insertar.insert as jest.Mock).mock.calls[0];
    expect(fila.activa).not.toBe(false);
    expect(mockDesde).toHaveBeenCalledTimes(1);
  });

  test('si una subida falla: se borra la fila, se borran las fotos que sí subieron y llega el error original', async () => {
    mockSubirFoto.mockImplementation(async (_u: string, _p: string, i: number) => {
      if (i === 1) throw new Error('sin espacio en el bucket');
      return RUTA(i);
    });
    const insertar = cadena({ data: { id: 'p1' }, error: null });
    const borrar = cadena({ error: null });
    mockDesde.mockReturnValueOnce(insertar).mockReturnValueOnce(borrar);

    await expect(crearPublicacion(conFotos)).rejects.toThrow('sin espacio en el bucket');

    expect(borrar.delete).toHaveBeenCalled();
    expect(borrar.eq).toHaveBeenCalledWith('id', 'p1');
    expect(mockBorrarFotos).toHaveBeenCalledWith([RUTA(0)]);
    // Y nunca se llegó a activar: no hubo un segundo `update`.
    expect(mockDesde).toHaveBeenCalledTimes(2);
  });

  test('si falla el update final: se deshace todo y llega ESE error', async () => {
    const insertar = cadena({ data: { id: 'p1' }, error: null });
    const actualizar = cadena({ data: null, error: { message: 'violación de policy' } });
    const borrar = cadena({ error: null });
    mockDesde.mockReturnValueOnce(insertar).mockReturnValueOnce(actualizar).mockReturnValueOnce(borrar);

    await expect(crearPublicacion(conFotos)).rejects.toMatchObject({ message: 'violación de policy' });

    expect(borrar.delete).toHaveBeenCalled();
    expect(mockBorrarFotos).toHaveBeenCalledWith([RUTA(0), RUTA(1)]);
  });

  // La limpieza corre cuando ya algo anda mal, y es probable que sea la misma
  // red. Si lanzara, taparía el error que la persona necesita leer.
  test('si la limpieza TAMBIÉN falla, el error que llega es el original', async () => {
    mockSubirFoto.mockImplementation(async () => {
      throw new Error('falló la subida');
    });
    const insertar = cadena({ data: { id: 'p1' }, error: null });
    const borrar = cadena({ error: null });
    (borrar.eq as jest.Mock).mockImplementation(() => {
      throw new Error('también se cayó el borrado');
    });
    mockBorrarFotos.mockRejectedValue(new Error('y el de fotos'));
    mockDesde.mockReturnValueOnce(insertar).mockReturnValueOnce(borrar);

    await expect(crearPublicacion(conFotos)).rejects.toThrow('falló la subida');
  });

  // `Promise.all` rechaza en cuanto UNA falla y deja las demás en vuelo: la
  // limpieza correría sin saber de la que aún no termina, y esa foto subiría
  // DESPUÉS de borrar, huérfana para siempre. Hay que esperar a todas.
  test('la limpieza espera a las subidas que aún están en vuelo', async () => {
    let terminarLaLenta!: () => void;
    mockSubirFoto.mockImplementation(async (_u: string, _p: string, i: number) => {
      if (i === 0) throw new Error('falló la rápida');
      await new Promise<void>((r) => {
        terminarLaLenta = r;
      });
      return RUTA(i);
    });
    const insertar = cadena({ data: { id: 'p1' }, error: null });
    const borrar = cadena({ error: null });
    mockDesde.mockReturnValueOnce(insertar).mockReturnValueOnce(borrar);

    const resultado = crearPublicacion(conFotos).catch((e: Error) => e);
    await new Promise((r) => setTimeout(r, 0));
    expect(mockBorrarFotos).not.toHaveBeenCalled(); // todavía espera a la lenta

    terminarLaLenta();
    expect((await resultado).message).toBe('falló la rápida');
    expect(mockBorrarFotos).toHaveBeenCalledWith([RUTA(1)]);
  });
});
