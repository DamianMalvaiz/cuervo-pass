import { fireEvent, render, screen } from '@testing-library/react-native';

// La página de Favoritos de la web. Cuatro estados y los cuatro distintos (invariante 2): cargando, FALLÓ la lectura (nunca «no guardaste nada»), nada guardado y lista. Lo guardado que ya no es visible se DICE.

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('expo-router/head', () => ({ __esModule: true, default: () => null }));
jest.mock('@/hooks/use-tamano-pantalla', () => ({ useTamanoPantalla: () => ({ ancho: 1440, alto: 900, clase: 'amplia' }) }));
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }) }));

const mockIdsPub = { ids: new Set<string>(), cargando: false, fallo: false };
const mockIdsNeg = { ids: new Set<string>(), cargando: false, fallo: false };
jest.mock('@/hooks/queries/useFavoritos', () => ({ useMisFavoritosIds: () => mockIdsPub }));
jest.mock('@/hooks/queries/useFavoritosNegocios', () => ({ useMisNegociosFavoritosIds: () => mockIdsNeg }));

const reintentar = jest.fn();
const mockPub = { publicaciones: [] as { id: string; titulo_publico: string }[], cargando: false, fallo: false, reintentar };
const mockNeg = { negocios: [] as { id: string; nombre: string }[], cargando: false, fallo: false, reintentar };
jest.mock('@/hooks/queries/useExplorar', () => ({ usePublicacionesPorIds: () => mockPub, useNegociosPorIds: () => mockNeg }));

jest.mock('../TarjetaPublicacionWeb', () => ({ TarjetaPublicacionWeb: ({ p }: { p: { titulo_publico: string } }) => require('react').createElement(require('react-native').Text, null, `VIV ${p.titulo_publico}`) }));
jest.mock('../TarjetaNegocioWeb', () => ({ TarjetaNegocioWeb: ({ n }: { n: { nombre: string } }) => require('react').createElement(require('react-native').Text, null, `NEG ${n.nombre}`) }));
jest.mock('../PieWeb', () => ({ PieWeb: () => null }));

import { FavoritosWeb } from '../FavoritosWeb';

beforeEach(() => {
  jest.clearAllMocks();
  mockIdsPub.ids = new Set();
  mockIdsPub.cargando = false;
  mockIdsPub.fallo = false;
  mockIdsNeg.ids = new Set();
  mockIdsNeg.cargando = false;
  mockIdsNeg.fallo = false;
  Object.assign(mockPub, { publicaciones: [], cargando: false, fallo: false });
  Object.assign(mockNeg, { negocios: [], cargando: false, fallo: false });
});

describe('FavoritosWeb', () => {
  it('con viviendas guardadas las enseña, con cuántas hay en la pestaña', async () => {
    mockIdsPub.ids = new Set(['a', 'b']);
    mockPub.publicaciones = [{ id: 'a', titulo_publico: 'Cuarto Lerma' }, { id: 'b', titulo_publico: 'Depa Toluca' }];
    await render(<FavoritosWeb />);
    expect(screen.getByText('VIV Cuarto Lerma')).toBeTruthy();
    expect(screen.getByText('VIV Depa Toluca')).toBeTruthy();
    expect(screen.getByLabelText('Publicaciones (2)')).toBeTruthy();
  });

  it('sin nada guardado lo dice y ofrece ir a explorar', async () => {
    await render(<FavoritosWeb />);
    expect(screen.getByText(/Aún no guardas ningún lugar/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Explorar lugares'));
    expect(mockPush).toHaveBeenCalledWith('/departamentos');
  });

  it('un FALLO al leer los guardados NO se pinta como «no guardaste nada»', async () => {
    mockIdsPub.fallo = true;
    await render(<FavoritosWeb />);
    expect(screen.getByText('No pudimos cargar tus favoritos')).toBeTruthy();
    expect(screen.queryByText(/Aún no guardas/)).toBeNull();
  });

  it('un fallo al leer las viviendas tampoco: se dice y se puede reintentar', async () => {
    mockIdsPub.ids = new Set(['a']);
    mockPub.fallo = true;
    await render(<FavoritosWeb />);
    expect(screen.getByText('No pudimos cargar tus favoritos')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Reintentar'));
    expect(reintentar).toHaveBeenCalled();
  });

  it('mientras carga no afirma que no hay nada', async () => {
    mockIdsPub.cargando = true;
    await render(<FavoritosWeb />);
    expect(screen.getByLabelText('Cargando')).toBeTruthy();
    expect(screen.queryByText(/Aún no guardas/)).toBeNull();
  });

  it('lo guardado que ya no es visible se DICE (la fila se conserva, solo no se pinta)', async () => {
    mockIdsPub.ids = new Set(['a', 'b', 'c']);
    mockPub.publicaciones = [{ id: 'a', titulo_publico: 'Cuarto Lerma' }];
    await render(<FavoritosWeb />);
    expect(screen.getByText('2 publicaciones guardadas ya no están disponibles.')).toBeTruthy();
  });

  it('la pestaña de negocios enseña los negocios guardados', async () => {
    mockIdsNeg.ids = new Set(['n1']);
    mockNeg.negocios = [{ id: 'n1', nombre: 'Café La Parada' }];
    await render(<FavoritosWeb />);
    await fireEvent.press(screen.getByLabelText('Negocios (1)'));
    expect(screen.getByText('NEG Café La Parada')).toBeTruthy();
  });

  it('sin negocios guardados lo dice con las palabras de los negocios', async () => {
    await render(<FavoritosWeb />);
    await fireEvent.press(screen.getByLabelText('Negocios (0)'));
    expect(screen.getByText(/Aún no guardas ningún negocio/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Explorar negocios'));
    expect(mockPush).toHaveBeenCalledWith('/servicios');
  });
});
