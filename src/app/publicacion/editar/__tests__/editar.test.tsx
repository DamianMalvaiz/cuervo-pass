import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// V.8 · `app/publicacion/editar` estaba al 0 %.
//
// Es la ruta con más piezas del producto: el formulario de dieciséis campos, la
// subida de fotos con `upsert`, el regeneramiento del embedding y el reintento
// de geocodificación. Y la única sin red.
//
// Los casos no son inventados: cada uno es un fallo que este repositorio ya
// pagó. La precarga es `9aed935` («Editar una publicación estaba roto: la
// dirección no volvía a sus campos»), y el de la carga fallida es END-11, que
// se corrigió en `publicacion/[id].tsx` y aquí nadie tocó.

const mockObtener = jest.fn();
const mockActualizar = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  router: { replace: (...a: unknown[]) => mockReplace(...a), push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ id: 'pub1' }),
}));
jest.mock('@/services/publicaciones.service', () => ({
  obtenerMiPublicacion: (...a: unknown[]) => mockObtener(...a),
  actualizarPublicacion: (...a: unknown[]) => mockActualizar(...a),
}));
jest.mock('@/lib/direccionMx', () => ({ buscarPorCodigoPostal: jest.fn() }));
jest.mock('@/lib/mapboxAutocomplete', () => ({ buscarCalles: jest.fn() }));
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  MediaTypeOptions: { Images: 'Images' },
}));
jest.mock('@/hooks/use-fotos-firmadas', () => ({ useFotosFirmadas: () => ({ urls: new Map(), fallo: null }) }));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }),
}));
jest.mock('@/lib/registro', () => ({ aviso: jest.fn(), fallo: jest.fn() }));

import EditarPublicacionScreen from '../[id]';

// El formato canónico que produce `armarDireccion`, con el prefijo «CP» en el
// último trozo. Sin él, `partirDireccion` no reconoce la cadena y la prueba
// mediría el caso ilegible sin saberlo.
const DIRECCION = 'Calle Zapata 224, Guadalupe, San Mateo Atenco, San Mateo Atenco, México, CP 52104';

const PUBLICACION = {
  id: 'pub1',
  usuario_id: 'u1',
  titulo: 'Depa de 1 recámara',
  tipo: 'depa',
  direccion: DIRECCION,
  latitud: 19.29,
  longitud: -99.56,
  precio_renta: 2500,
  descripcion: 'Cerca del campus',
  permite_mascotas: true,
  amueblado: false,
  servicios_incluidos: true,
  recamaras: 1,
  whatsapp: '5512345678',
  fotos: [],
  activa: true,
};

const montar = async () => {
  await render(<EditarPublicacionScreen />);
  await waitFor(() => expect(screen.queryByText('CONSULTANDO LA PUBLICACIÓN')).toBeNull());
};

beforeEach(() => {
  jest.clearAllMocks();
  mockObtener.mockResolvedValue(PUBLICACION);
  mockActualizar.mockResolvedValue(PUBLICACION);
});

describe('precarga · regresión de 9aed935', () => {
  it('los valores de la publicación llegan al formulario, dirección incluida', async () => {
    await montar();

    // La dirección se GUARDA como una cadena y el formulario la pide en ocho
    // campos. Nacían vacíos, siete son obligatorios, y Zod fallaba en silencio:
    // no se podía guardar ningún cambio. Desde fuera parecía «al cambiar la
    // foto se borran los datos».
    expect(screen.getByDisplayValue('Depa de 1 recámara')).toBeTruthy();
    expect(screen.getByDisplayValue('2500')).toBeTruthy();
    expect(screen.getByDisplayValue('5512345678')).toBeTruthy();
    expect(screen.getByDisplayValue('224')).toBeTruthy();
    expect(screen.getByDisplayValue('52104')).toBeTruthy();
    // La calle va en un desplegable con buscador, no en una entrada libre: su
    // valor se PINTA, no se expone como `displayValue`. Se afirma sobre lo que
    // el componente de verdad hace y no sobre lo que uno supondría.
    expect(screen.getByText('Calle Zapata')).toBeTruthy();
    expect(screen.getByText('Guadalupe')).toBeTruthy();
  });
});

describe('guardar', () => {
  it('al guardar bien, lleva a la ficha de esa publicación', async () => {
    await montar();
    await act(async () => { fireEvent.press(screen.getByLabelText('Guardar cambios')); });

    await waitFor(() => expect(mockActualizar).toHaveBeenCalledTimes(1));
    expect(mockActualizar.mock.calls[0][0]).toBe('pub1');
    // Hallazgo 5 · la ubicación ANTERIOR viaja con el guardado: sin ella el
    // servicio no puede saber si la dirección cambió, y cada edición volvería a
    // geocodificar y a arriesgarse a borrar las coordenadas.
    expect(mockActualizar.mock.calls[0][2]).toMatchObject({
      direccion: DIRECCION,
      latitud: 19.29,
      longitud: -99.56,
    });
    // A la ficha, y con `replace`: volver atrás desde la ficha recién guardada
    // no debe devolver al formulario de edición.
    expect(mockReplace).toHaveBeenCalledWith('/publicacion/pub1');
  });

  it('si guardar falla, NO navega y dice el motivo', async () => {
    mockActualizar.mockRejectedValue(new Error('No se pudo subir la foto'));
    await montar();
    await act(async () => { fireEvent.press(screen.getByLabelText('Guardar cambios')); });

    // Navegar tras un fallo deja a la persona mirando su publicación SIN los
    // cambios, convencida de que los guardó.
    await waitFor(() => expect(screen.getByText('No se pudo subir la foto')).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

describe('carga fallida · END-11', () => {
  it('un fallo de red NO se presenta como publicación inexistente', async () => {
    mockObtener.mockRejectedValue(new Error('network request failed'));
    await montar();

    // `.catch(aviso)` deja `publicacion` en null, y la pantalla entonces dice
    // «No se encontró esta publicación». Se cayó el wifi y la app afirma que tu
    // propia publicación ya no existe — el mismo defecto que END-11 corrigió en
    // la ficha pública y que aquí quedó sin tocar.
    expect(screen.queryByText('No se encontró esta publicación.')).toBeNull();
    expect(screen.getByText('NO PUDIMOS CONSULTAR')).toBeTruthy();
  });

  it('ofrece reintentar, y el reintento carga de verdad', async () => {
    mockObtener.mockRejectedValueOnce(new Error('network request failed'));
    await montar();

    // Un estado de error sin salida deja a la persona atrapada: la mitad que
    // importa de decir «falló» es ofrecer qué hacer.
    await act(async () => { fireEvent.press(screen.getByLabelText('Reintentar')); });

    await waitFor(() => expect(screen.getByDisplayValue('Depa de 1 recámara')).toBeTruthy());
    expect(mockObtener).toHaveBeenCalledTimes(2);
  });
});
