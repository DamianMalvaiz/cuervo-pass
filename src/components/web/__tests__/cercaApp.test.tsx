import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

// /cerca EN LA APP: sin el marco de la web ni sus tarjetas; filas con foto a la izquierda, la cercanía rotulada como estimación, y los mismos cuatro estados (END-11): cargando, FALLÓ, nada en ese radio y la lista.

jest.mock('@/components/web/PaginaWeb', () => ({
  PaginaWeb: () => {
    throw new Error('la app no debe usar el marco de la web');
  },
}));
jest.mock('@/components/web/TarjetaPublicacionWeb', () => ({
  TarjetaPublicacionWeb: () => {
    throw new Error('la app no debe usar la tarjeta de la web');
  },
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
const mockPerfil = { valor: null as null | { universidad: string | null; latitud_universidad: number | null; longitud_universidad: number | null } };
jest.mock('@/store/usePerfilStore', () => ({ usePerfilStore: (sel: (s: { perfil: unknown }) => unknown) => sel({ perfil: mockPerfil.valor }) }));
const mockCajas: unknown[] = [];
const mockReintentar = jest.fn();
const mockLect = { pubs: [] as unknown[], cargando: false, fallo: false };
jest.mock('@/hooks/queries/useExplorar', () => ({
  usePublicacionesEnCaja: (caja: unknown) => {
    mockCajas.push(caja);
    return { publicaciones: mockLect.pubs, cargando: mockLect.cargando, fallo: mockLect.fallo, reintentar: mockReintentar };
  },
  useFotosPublicas: () => ({ fotos: [], cargando: false, fallo: false }),
}));

import { CercaWeb } from '../CercaWeb';

const U = { lat: 19.32568, lng: -99.458244 };
const lugar = (id: string, dLat: number) => ({
  id, titulo_publico: `Lugar ${id}`, tipo: 'cuarto', precio_renta: 2900, zona: 'Centro, Lerma', recamaras: 1, amueblado: false, num_fotos: 0,
  latitud_aprox: U.lat + dLat, longitud_aprox: U.lng,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(Platform, 'OS', 'ios');
  mockCajas.length = 0;
  Object.assign(mockLect, { pubs: [], cargando: false, fallo: false });
  mockPerfil.valor = null;
});
afterEach(() => jest.restoreAllMocks());

it('dice a qué universidad se mide y que es aproximado, sin el marco de la web', async () => {
  await render(<CercaWeb />);
  expect(screen.getByText(/Distancia a Universidad Tecnológica del Valle de Toluca/)).toBeTruthy();
  expect(screen.getByText(/estimaciones en línea recta/)).toBeTruthy();
});

it('ordena del más cercano al más lejano y rotula la cercanía como estimación (a pie hasta 3 km)', async () => {
  mockLect.pubs = [lugar('lejos', 0.02), lugar('cerca', 0.001)];
  await render(<CercaWeb />);
  const titulos = screen.getAllByText(/^Lugar /).map((n) => n.props.children);
  expect(titulos).toEqual(['Lugar cerca', 'Lugar lejos']);
  expect(screen.getByText('a menos de 1 km · ~1 min a pie')).toBeTruthy();
  expect(screen.getByText('a ~2 km · ~27 min a pie')).toBeTruthy();
});

it('tocar un lugar abre la ficha DE LA APP', async () => {
  mockLect.pubs = [lugar('abc', 0.001)];
  await render(<CercaWeb />);
  await fireEvent.press(screen.getByLabelText(/^Lugar abc,/));
  expect(mockPush).toHaveBeenCalledWith('/publicacion/abc');
});

it('cambiar el radio cambia la consulta al servidor (la caja)', async () => {
  await render(<CercaWeb />);
  const antes = mockCajas.length;
  await fireEvent.press(screen.getByLabelText('A menos de 1 km'));
  expect(mockCajas.length).toBeGreaterThan(antes);
  expect(mockCajas.at(-1)).not.toEqual(mockCajas[0]);
});

it('si la lectura falla lo dice con reintento; no es «nada cerca»', async () => {
  mockLect.fallo = true;
  await render(<CercaWeb />);
  expect(screen.getByText('No pudimos cargar los lugares cercanos')).toBeTruthy();
  expect(screen.queryByText(/No hay lugares publicados/)).toBeNull();
  await fireEvent.press(screen.getByLabelText('Reintentar'));
  expect(mockReintentar).toHaveBeenCalled();
});

it('sin nada en ese radio lo dice y sugiere un radio mayor', async () => {
  await render(<CercaWeb />);
  expect(screen.getByText(/No hay lugares publicados a menos de 3 km/)).toBeTruthy();
});
