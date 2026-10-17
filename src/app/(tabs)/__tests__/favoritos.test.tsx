import { fireEvent, render, screen } from '@testing-library/react-native';

// Favoritos · Cuervo 360.
//
// Cuatro estados, y los cuatro distintos (END-11): cargando, falló la lectura, no hay nada
// guardado, y lista. Que falle la lectura NO puede decir «no guardaste nada». Y las publicaciones
// guardadas que ya no son visibles se DICEN, no se callan.

const mockFavoritos = jest.fn();
jest.mock('@/hooks/queries/useFavoritos', () => ({ useMisFavoritos: (...a: unknown[]) => mockFavoritos(...a) }));
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

beforeEach(() => {
  jest.clearAllMocks();
  mockFavoritos.mockReturnValue(estado());
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
