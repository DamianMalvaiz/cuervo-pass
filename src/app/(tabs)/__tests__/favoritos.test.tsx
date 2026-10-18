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
jest.mock('@/store/usePerfilStore', () => ({
  usePerfilStore: (sel?: (s: unknown) => unknown) => {
    const estado = { perfil: { id: 'u1', latitud_universidad: 19.28, longitud_universidad: -99.55 }, cargarPerfil: jest.fn() };
    return sel ? sel(estado) : estado;
  },
}));
jest.mock('@/components/BotonFavorito', () => ({
  BotonFavorito: ({ publicacionId }: { publicacionId: string }) => {
    const { Text } = require('react-native');
    return <Text>{`CORAZON:${publicacionId}`}</Text>;
  },
}));

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

  test('volver a Publicaciones muestra las publicaciones', async () => {
    mockFavoritos.mockReturnValue(estado({ publicaciones: [pub('a')] }));
    await render(<FavoritosScreen />);
    await irANegocios();
    await fireEvent.press(screen.getByLabelText('Publicaciones'));
    expect(screen.getByText('Depa a')).toBeTruthy();
  });
});
