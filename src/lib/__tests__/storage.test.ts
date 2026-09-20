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

jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: (...a: unknown[]) => mockManipular(...a) },
  SaveFormat: { JPEG: 'jpeg' },
}));
jest.mock('@/lib/supabase', () => ({
  supabase: { storage: { from: () => ({ upload: (...a: unknown[]) => mockSubir(...a) }) } },
}));

import { subirFotoPerfil, subirFotoPublicacion } from '../storage';

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
