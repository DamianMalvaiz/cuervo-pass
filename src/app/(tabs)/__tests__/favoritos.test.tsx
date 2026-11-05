import { fireEvent, render, screen } from '@testing-library/react-native';

// Favoritos · Cuervo 360.
//
// Cuatro estados, y los cuatro distintos (END-11): cargando, falló la lectura, no hay nada
// guardado, y lista. Que falle la lectura NO puede decir «no guardaste nada». Y las publicaciones
// guardadas que ya no son visibles se DICEN, no se callan.

const mockFavoritos = jest.fn();
jest.mock('@/hooks/queries/useFavoritos', () => ({ useMisFavoritos: (...a: unknown[]) => mockFavoritos(...a) }));
const mockNegocios = jest.fn();
jest.mock('@/hooks/queries/useFavoritosNegocios', () => ({ useMisNegociosFavoritos: (...a: unknown[]) => mockNegocios(...a) }));
jest.mock('@/components/BotonFavoritoNegocio', () => ({
  BotonFavoritoNegocio: ({ negocioId }: { negocioId: string }) => {
    const { Text } = require('react-native');
    return <Text>{`CORAZON_NEGOCIO:${negocioId}`}</Text>;
  },
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/hooks/use-fotos-firmadas', () => ({ useFotosFirmadas: () => ({ urls: new Map(), fallo: null }) }));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }),
}));
// Mutable para poder probar una cuenta SIN coordenadas de universidad (la distancia no se inventa).
let mockPerfil: { id: string; latitud_universidad: number | null; longitud_universidad: number | null } = { id: 'u1', latitud_universidad: 19.28, longitud_universidad: -99.55 };
jest.mock('@/store/usePerfilStore', () => ({
  usePerfilStore: (sel?: (s: unknown) => unknown) => {
    const estado = { perfil: mockPerfil, cargarPerfil: jest.fn() };
    return sel ? sel(estado) : estado;
  },
}));
jest.mock('@/components/BotonFavorito', () => ({
  BotonFavorito: ({ publicacionId }: { publicacionId: string }) => {
    const { Text } = require('react-native');
    return <Text>{`CORAZON:${publicacionId}`}</Text>;
  },
}));

// Vistos y Comparar viven solo en el teléfono y tienen sus propias pruebas; aquí solo importa que Favoritos los ofrezca y los monte.
let mockVistos: string[] = [];
let mockComparados: string[] = [];
jest.mock('@/hooks/use-vistos', () => ({ useVistos: () => mockVistos }));
jest.mock('@/hooks/use-comparar', () => ({ useComparar: () => ({ ids: mockComparados, lleno: false, alternar: jest.fn() }) }));
jest.mock('@/components/ListasLocalesApp', () => {
  const { Text } = require('react-native');
  return { ListaVistos: () => <Text>LISTA VISTOS</Text>, ListaComparar: () => <Text>LISTA COMPARAR</Text> };
});

import FavoritosScreen from '../favoritos';

const pub = (id: string, extra: Record<string, unknown> = {}) => ({
  id, usuario_id: 'o1', titulo: `Depa ${id}`, tipo: 'depa', direccion: 'Calle 1',
  latitud: 19.29, longitud: -99.56, precio_renta: 2500, fotos: [], ...extra,
});
const estado = (extra: Record<string, unknown> = {}) => ({
  publicaciones: [], noDisponibles: 0, cargando: false, fallo: false, refrescando: false, reintentar: jest.fn(), ...extra,
});

const negocio = (id: string) => ({ id, categoria_id: 'comida', nombre: `Negocio ${id}`, descripcion: null, direccion: 'Calle 1', latitud: null, longitud: null, rango_precio: 1, horario: null, fotos: [], destacado: false, origen: 'solicitud' });
const estadoNegocios = (extra: Record<string, unknown> = {}) => ({ negocios: [], noDisponibles: 0, cargando: false, fallo: false, reintentar: jest.fn(), ...extra });

beforeEach(() => {
  jest.clearAllMocks();
  mockVistos = [];
  mockComparados = [];
  mockPerfil = { id: 'u1', latitud_universidad: 19.28, longitud_universidad: -99.55 };
  mockFavoritos.mockReturnValue(estado());
  mockNegocios.mockReturnValue(estadoNegocios());
});

test('sin nada guardado lo dice y explica cómo guardar', async () => {
  await render(<FavoritosScreen />);
  expect(await screen.findByText(/Aún no guardas ninguna publicación/i)).toBeTruthy();
});

test('muestra las guardadas con su corazón, en el orden recibido', async () => {
  mockFavoritos.mockReturnValue(estado({ publicaciones: [pub('a'), pub('b')] }));
  await render(<FavoritosScreen />);
  expect(await screen.findByText('Depa a')).toBeTruthy();
  expect(screen.getByText('Depa b')).toBeTruthy();
  expect(screen.getByText('CORAZON:a')).toBeTruthy();
  expect(screen.queryByText(/Aún no guardas/i)).toBeNull();
});

test('tocar una abre su ficha', async () => {
  mockFavoritos.mockReturnValue(estado({ publicaciones: [pub('a')] }));
  await render(<FavoritosScreen />);
  await fireEvent.press(await screen.findByLabelText(/Depa a/));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/publicacion/[id]', params: { id: 'a' } });
});

// END-11
test('si falló la lectura lo dice como fallo y NO afirma que no guardaste nada', async () => {
  mockFavoritos.mockReturnValue(estado({ fallo: true }));
  await render(<FavoritosScreen />);
  expect(await screen.findByText(/No pudimos cargar tus favoritos/i)).toBeTruthy();
  expect(screen.queryByText(/Aún no guardas/i)).toBeNull();
});

test('mientras carga no afirma ni fallo ni vacío', async () => {
  mockFavoritos.mockReturnValue(estado({ cargando: true }));
  await render(<FavoritosScreen />);
  expect(screen.queryByText(/Aún no guardas/i)).toBeNull();
  expect(screen.queryByText(/No pudimos cargar/i)).toBeNull();
});

test('dice cuántas guardadas ya no están disponibles, en vez de callarlo', async () => {
  mockFavoritos.mockReturnValue(estado({ publicaciones: [pub('a')], noDisponibles: 2 }));
  await render(<FavoritosScreen />);
  expect(await screen.findByText(/2 publicaciones guardadas ya no están disponibles/i)).toBeTruthy();
});

test('con solo una no disponible usa el singular', async () => {
  mockFavoritos.mockReturnValue(estado({ publicaciones: [pub('a')], noDisponibles: 1 }));
  await render(<FavoritosScreen />);
  expect(await screen.findByText(/1 publicación guardada ya no está disponible/i)).toBeTruthy();
});

test('si todas las guardadas dejaron de estar disponibles, no dice que no guardaste nada', async () => {
  mockFavoritos.mockReturnValue(estado({ publicaciones: [], noDisponibles: 3 }));
  await render(<FavoritosScreen />);
  expect(await screen.findByText(/3 publicaciones guardadas ya no están disponibles/i)).toBeTruthy();
  expect(screen.queryByText(/Aún no guardas ninguna publicación/i)).toBeNull();
});

// Ramas que la cobertura de `(tabs)` echaba de menos desde que se añadió el segmento Negocios: son comportamientos, no relleno.
describe('detalles de las publicaciones guardadas', () => {
  test('con la universidad de la cuenta, cada fila dice a cuántos km queda', async () => {
    mockFavoritos.mockReturnValue(estado({ publicaciones: [pub('a')] }));
    await render(<FavoritosScreen />);
    expect(await screen.findByText(/a \d+\.\d km/)).toBeTruthy();
  });

  // No se inventa lo que no se sabe: sin coordenadas de la universidad (o de la publicación) la fila no enseña ninguna distancia.
  test('sin las coordenadas de la universidad NO inventa la distancia', async () => {
    mockPerfil = { id: 'u1', latitud_universidad: null, longitud_universidad: null };
    mockFavoritos.mockReturnValue(estado({ publicaciones: [pub('a')] }));
    await render(<FavoritosScreen />);
    expect(await screen.findByText('Depa a')).toBeTruthy();
    expect(screen.queryByText(/ km/)).toBeNull();
  });

  test('sin las coordenadas de la publicación tampoco inventa la distancia', async () => {
    mockFavoritos.mockReturnValue(estado({ publicaciones: [pub('a', { latitud: null, longitud: null })] }));
    await render(<FavoritosScreen />);
    expect(await screen.findByText('Depa a')).toBeTruthy();
    expect(screen.queryByText(/ km/)).toBeNull();
  });

  test('una publicación con foto se muestra igual aunque su enlace firmado aún no haya llegado', async () => {
    mockFavoritos.mockReturnValue(estado({ publicaciones: [pub('a', { fotos: ['u1/a.jpg'] })] }));
    await render(<FavoritosScreen />);
    expect(await screen.findByText('Depa a')).toBeTruthy();
  });

  test('tocar el segmento que ya está activo no cambia nada', async () => {
    mockFavoritos.mockReturnValue(estado({ publicaciones: [pub('a')] }));
    await render(<FavoritosScreen />);
    await fireEvent.press(screen.getByLabelText('Publicaciones'));
    expect(screen.getByLabelText('Publicaciones').props.accessibilityState?.selected).toBe(true);
    expect(screen.getByText('Depa a')).toBeTruthy();
  });
});

describe('segmento Negocios (0073)', () => {
  const irANegocios = async () => { await fireEvent.press(screen.getByLabelText('Negocios')); };

  test('arranca en Publicaciones y el segmento activo se dice sin depender del color', async () => {
    await render(<FavoritosScreen />);
    expect(screen.getByLabelText('Publicaciones').props.accessibilityState?.selected).toBe(true);
    expect(screen.getByLabelText('Negocios').props.accessibilityState?.selected).toBe(false);
  });

  test('muestra los negocios guardados con su corazón y tocar uno abre su ficha', async () => {
    mockNegocios.mockReturnValue(estadoNegocios({ negocios: [negocio('n1'), negocio('n2')] }));
    await render(<FavoritosScreen />);
    await irANegocios();
    expect(screen.getByText('Negocio n1')).toBeTruthy();
    expect(screen.getByText('CORAZON_NEGOCIO:n2')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(/Negocio n1/));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/negocio/[id]', params: { id: 'n1' } });
  });

  test('sin negocios guardados lo dice y explica cómo guardar', async () => {
    await render(<FavoritosScreen />);
    await irANegocios();
    expect(screen.getByText(/Aún no guardas ningún negocio/)).toBeTruthy();
  });

  test('si falla, lo dice con reintento y NO dice que no hay nada', async () => {
    const reintentar = jest.fn();
    mockNegocios.mockReturnValue(estadoNegocios({ fallo: true, reintentar }));
    await render(<FavoritosScreen />);
    await irANegocios();
    expect(screen.getByText('No pudimos cargar tus negocios guardados')).toBeTruthy();
    expect(screen.queryByText(/Aún no guardas ningún negocio/)).toBeNull();
    await fireEvent.press(screen.getByLabelText('Reintentar'));
    expect(reintentar).toHaveBeenCalled();
  });

  test('los que ya no están disponibles se DICEN', async () => {
    mockNegocios.mockReturnValue(estadoNegocios({ noDisponibles: 2 }));
    await render(<FavoritosScreen />);
    await irANegocios();
    expect(screen.getByText('2 negocios guardados ya no están disponibles.')).toBeTruthy();
    expect(screen.queryByText(/Aún no guardas/)).toBeNull();
  });

  test('con UN solo negocio no disponible usa el singular', async () => {
    mockNegocios.mockReturnValue(estadoNegocios({ noDisponibles: 1 }));
    await render(<FavoritosScreen />);
    await irANegocios();
    expect(screen.getByText('1 negocio guardado ya no está disponible.')).toBeTruthy();
  });

  test('mientras cargan no afirma ni fallo ni vacío', async () => {
    mockNegocios.mockReturnValue(estadoNegocios({ cargando: true }));
    await render(<FavoritosScreen />);
    await irANegocios();
    expect(screen.queryByText(/Aún no guardas ningún negocio/)).toBeNull();
    expect(screen.queryByText(/No pudimos cargar/)).toBeNull();
  });

  test('un negocio con foto se muestra igual aunque su enlace firmado aún no haya llegado', async () => {
    mockNegocios.mockReturnValue(estadoNegocios({ negocios: [{ ...negocio('n1'), fotos: ['u1/n1.jpg'] }] }));
    await render(<FavoritosScreen />);
    await irANegocios();
    expect(screen.getByText('Negocio n1')).toBeTruthy();
  });

  test('volver a Publicaciones muestra las publicaciones', async () => {
    mockFavoritos.mockReturnValue(estado({ publicaciones: [pub('a')] }));
    await render(<FavoritosScreen />);
    await irANegocios();
    await fireEvent.press(screen.getByLabelText('Publicaciones'));
    expect(screen.getByText('Depa a')).toBeTruthy();
  });
});

describe('Vistos y Comparar (solo en este teléfono)', () => {
  test('ofrece Favoritos, Vistos y Comparar, con la cuenta de lo local (y sin cuenta de Favoritos, que viene de la red)', async () => {
    mockVistos = ['a', 'b'];
    mockComparados = ['a'];
    await render(<FavoritosScreen />);
    expect(screen.getByLabelText('Favoritos').props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText('Vistos (2)')).toBeTruthy();
    expect(screen.getByLabelText('Comparar (1)')).toBeTruthy();
  });

  test('«Vistos» muestra su lista y esconde los segmentos de Publicaciones y Negocios', async () => {
    await render(<FavoritosScreen />);
    await fireEvent.press(screen.getByLabelText('Vistos (0)'));
    expect(screen.getByText('LISTA VISTOS')).toBeTruthy();
    expect(screen.queryByLabelText('Publicaciones')).toBeNull();
    expect(screen.queryByLabelText('Negocios')).toBeNull();
  });

  test('«Comparar» muestra su lista', async () => {
    await render(<FavoritosScreen />);
    await fireEvent.press(screen.getByLabelText('Comparar (0)'));
    expect(screen.getByText('LISTA COMPARAR')).toBeTruthy();
    expect(screen.queryByText('LISTA VISTOS')).toBeNull();
  });

  test('volver a «Favoritos» devuelve las publicaciones y sus segmentos', async () => {
    mockFavoritos.mockReturnValue(estado({ publicaciones: [pub('a')] }));
    await render(<FavoritosScreen />);
    await fireEvent.press(screen.getByLabelText('Vistos (0)'));
    await fireEvent.press(screen.getByLabelText('Favoritos'));
    expect(screen.getByText('Depa a')).toBeTruthy();
    expect(screen.getByLabelText('Negocios')).toBeTruthy();
    expect(screen.queryByText('LISTA VISTOS')).toBeNull();
  });

  test('no ofrece «Búsquedas»: en la app la búsqueda es el perfil, no filtros libres que guardar', async () => {
    await render(<FavoritosScreen />);
    expect(screen.queryByText(/Búsquedas/)).toBeNull();
  });
});
