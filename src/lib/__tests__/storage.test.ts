// END-26 · La migración a la API contextual de `expo-image-manipulator`.
//
// Lo que estas pruebas protegen no es que la imagen se vea bien —eso no se juzga
// aquí— sino las dos cosas que la API NUEVA introduce y la vieja no tenía:
// objetos nativos que retienen un bitmap, y un punto donde hay que soltarlos.

const mockResize = jest.fn();
const mockRender = jest.fn();
const mockGuardar = jest.fn();
const mockLiberarContexto = jest.fn();
const mockLiberarImagen = jest.fn();
const mockManipular = jest.fn();
const mockSubir = jest.fn();
const mockRemover = jest.fn();

jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: (...a: unknown[]) => mockManipular(...a) },
  SaveFormat: { JPEG: 'jpeg' },
}));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: (...a: unknown[]) => mockSubir(...a),
        remove: (...a: unknown[]) => mockRemover(...a),
      }),
    },
  },
}));

import { borrarFotos, subirEvidenciaVerificacion, subirFotoNegocio, subirFotoPerfil, subirFotoPublicacion } from '../storage';

beforeEach(() => {
  jest.clearAllMocks();
  const imagen = { saveAsync: mockGuardar, release: mockLiberarImagen };
  mockRender.mockResolvedValue(imagen);
  mockGuardar.mockResolvedValue({ uri: 'file:///comprimida.jpg' });
  mockManipular.mockReturnValue({
    resize: mockResize,
    renderAsync: mockRender,
    release: mockLiberarContexto,
  });
  mockSubir.mockResolvedValue({ error: null });
  mockRemover.mockResolvedValue({ data: [], error: null });
  global.fetch = jest.fn().mockResolvedValue({ arrayBuffer: async () => new ArrayBuffer(8) }) as never;
});

// Solo `width`. Fijar tambien la altura deformaria las fotos verticales, que en
// un telefono son la mayoria.
test('redimensiona por ancho y deja que la altura la calcule la libreria', async () => {
  await subirFotoPublicacion('u1', 'p1', 0, 'file:///original.jpg');
  expect(mockResize).toHaveBeenCalledWith({ width: 1024 });
  expect(mockResize.mock.calls[0][0]).not.toHaveProperty('height');
});

test('el perfil usa un ancho menor que una foto de publicacion', async () => {
  await subirFotoPerfil('u1', 'file:///original.jpg');
  expect(mockResize).toHaveBeenCalledWith({ width: 512 });
});

test('guarda en JPEG con la compresion declarada', async () => {
  await subirFotoPublicacion('u1', 'p1', 0, 'file:///original.jpg');
  expect(mockGuardar).toHaveBeenCalledWith({ compress: 0.7, format: 'jpeg' });
});

// La ruta es lo que se guarda en la base, no una URL: una URL firmada caduca y
// guardarla seria guardar un enlace roto con fecha.
test('devuelve la RUTA del bucket, no la uri local ni una URL', async () => {
  const ruta = await subirFotoPublicacion('u1', 'p1', 2, 'file:///original.jpg');
  expect(ruta).toBe('publicaciones/u1/p1/2.jpg');
});

// `ImageManipulatorContext` e `ImageRef` son objetos NATIVOS que retienen el
// bitmap. Cinco fotos de 4 MB son cinco bitmaps descomprimidos vivos a la vez si
// nadie los suelta — y la API vieja no tenia este problema, asi que es facil
// migrar sin darse cuenta de que ahora existe.
test('libera los dos objetos nativos tras subir', async () => {
  await subirFotoPublicacion('u1', 'p1', 0, 'file:///original.jpg');
  expect(mockLiberarImagen).toHaveBeenCalledTimes(1);
  expect(mockLiberarContexto).toHaveBeenCalledTimes(1);
});

// LA prueba. Si alguien saca los `release()` del `finally` —o los pone despues
// del `return`, que es lo natural al escribirlo— esta sigue siendo la unica que
// lo nota: en el camino feliz no cambia nada. Y el fallo al comprimir es JUSTO
// cuando peor viene acumular memoria, porque suele repetirse al reintentar.
test('libera tambien cuando guardar falla', async () => {
  mockGuardar.mockRejectedValue(new Error('sin espacio'));
  await expect(subirFotoPublicacion('u1', 'p1', 0, 'file:///original.jpg')).rejects.toThrow('sin espacio');
  expect(mockLiberarImagen).toHaveBeenCalledTimes(1);
  expect(mockLiberarContexto).toHaveBeenCalledTimes(1);
});

// Si falla ANTES de materializar la imagen, no hay imagen que liberar — pero el
// contexto ya existe y sigue reteniendo lo suyo.
test('si falla al renderizar, libera el contexto y no revienta por la imagen ausente', async () => {
  mockRender.mockRejectedValue(new Error('formato no soportado'));
  await expect(subirFotoPerfil('u1', 'file:///original.jpg')).rejects.toThrow('formato no soportado');
  expect(mockLiberarContexto).toHaveBeenCalledTimes(1);
  expect(mockLiberarImagen).not.toHaveBeenCalled();
});

test('un error de Storage se propaga: la publicacion no puede darse por subida', async () => {
  mockSubir.mockResolvedValue({ error: { message: 'bucket lleno' } });
  await expect(subirFotoPublicacion('u1', 'p1', 0, 'file:///original.jpg')).rejects.toMatchObject({
    message: 'bucket lleno',
  });
});

// ── borrarFotos · hallazgo 6 ────────────────────────────────────────────────
// Se usa para DESHACER una publicación que no se pudo completar. Va dentro de
// una limpieza, así que nunca puede propagar: un fallo aquí taparía el error
// original, que es el que la persona necesita leer.
describe('borrarFotos', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  test('pide a Storage borrar exactamente esas rutas', async () => {
    await borrarFotos(['publicaciones/u1/p1/0.jpg', 'publicaciones/u1/p1/1.jpg']);
    expect(mockRemover).toHaveBeenCalledWith(['publicaciones/u1/p1/0.jpg', 'publicaciones/u1/p1/1.jpg']);
  });

  test('sin rutas no llama a Storage', async () => {
    await borrarFotos([]);
    expect(mockRemover).not.toHaveBeenCalled();
  });

  test('un error de Storage no se propaga', async () => {
    mockRemover.mockResolvedValue({ data: null, error: { message: 'sin red' } });
    await expect(borrarFotos(['a.jpg'])).resolves.toBeUndefined();
  });

  test('una excepción tampoco se propaga', async () => {
    mockRemover.mockRejectedValue(new Error('se cayó la red'));
    await expect(borrarFotos(['a.jpg'])).resolves.toBeUndefined();
  });
});

// Verificación de vendedor · la evidencia va a un bucket privado aparte, con nombre único y sin sobrescribir.
describe('subirEvidenciaVerificacion', () => {
  it('sube a la carpeta de la cuenta y del rol, y devuelve la ruta', async () => {
    const ruta = await subirEvidenciaVerificacion('u1', 'comerciante', 'ine-frente', 'file:///x.jpg');
    expect(ruta).toMatch(/^u1\/comerciante\/ine-frente-\d+-[a-z0-9]+\.jpg$/);
    expect(mockSubir.mock.calls.at(-1)?.[0]).toBe(ruta);
  });

  it('no sobrescribe: ese bucket no tiene UPDATE', async () => {
    await subirEvidenciaVerificacion('u1', 'comerciante', 'ine-frente', 'file:///x.jpg');
    expect(mockSubir.mock.calls.at(-1)?.[2]).toMatchObject({ upsert: false, contentType: 'image/jpeg' });
  });

  it('comprime a 1600 px de ancho para que la INE siga siendo legible', async () => {
    await subirEvidenciaVerificacion('u1', 'comerciante', 'ine-frente', 'file:///x.jpg');
    expect(mockResize).toHaveBeenCalledWith({ width: 1600 });
  });

  it('dos subidas del mismo archivo no chocan en nombre', async () => {
    const a = await subirEvidenciaVerificacion('u1', 'comerciante', 'ine-frente', 'file:///x.jpg');
    const b = await subirEvidenciaVerificacion('u1', 'comerciante', 'ine-frente', 'file:///x.jpg');
    expect(a).not.toBe(b);
  });

  it('si Storage rechaza, LANZA (no se envía una verificación con rutas que no existen)', async () => {
    mockSubir.mockResolvedValue({ error: { message: 'rechazado' } });
    await expect(subirEvidenciaVerificacion('u1', 'comerciante', 'ine-frente', 'file:///x.jpg')).rejects.toMatchObject({
      message: 'rechazado',
    });
  });
});

describe('subirFotoNegocio', () => {
  it('sube a la carpeta del negocio con nombre único y devuelve la ruta', async () => {
    const a = await subirFotoNegocio('n1', 'file:///x.jpg');
    const b = await subirFotoNegocio('n1', 'file:///x.jpg');
    expect(a).toMatch(/^negocios\/n1\/\d+-[a-z0-9]+\.jpg$/);
    expect(a).not.toBe(b);
    expect(mockSubir.mock.calls.at(-1)?.[0]).toBe(b);
  });

  it('comprime a 1024 px como las fotos de publicación', async () => {
    await subirFotoNegocio('n1', 'file:///x.jpg');
    expect(mockResize).toHaveBeenCalledWith({ width: 1024 });
  });

  it('si Storage rechaza, LANZA', async () => {
    mockSubir.mockResolvedValue({ error: { message: 'rechazado' } });
    await expect(subirFotoNegocio('n1', 'file:///x.jpg')).rejects.toMatchObject({ message: 'rechazado' });
  });
});
