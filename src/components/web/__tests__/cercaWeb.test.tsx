import { fireEvent, render, screen } from '@testing-library/react-native';

// /cerca: usa la universidad de la cuenta si la tiene y, si no, la de la lista (y lo dice); ordena por cercanía con el tiempo rotulado como estimación; cambiar el radio cambia la consulta al servidor;
// y los estados cargando / falló / nada son distintos (END-11).

jest.mock('@/components/web/PaginaWeb', () => ({ PaginaWeb: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/components/web/TarjetaPublicacionWeb', () => {
  const { Text } = require('react-native');
  return { TarjetaPublicacionWeb: ({ p, razon }: { p: { titulo_publico: string }; razon?: string }) => <Text>{`${p.titulo_publico} | ${razon}`}</Text> };
});
jest.mock('@/components/web/EsqueletoWeb', () => ({ EsqueletoTarjetasWeb: () => null }));

const mockPerfil = { valor: null as null | { universidad: string | null; latitud_universidad: number | null; longitud_universidad: number | null } };
jest.mock('@/store/usePerfilStore', () => ({ usePerfilStore: (sel: (s: { perfil: unknown }) => unknown) => sel({ perfil: mockPerfil.valor }) }));

const mockCajas: unknown[] = [];
const mockLect = { pubs: [] as unknown[], cargando: false, fallo: false };
jest.mock('@/hooks/queries/useExplorar', () => ({
  usePublicacionesEnCaja: (caja: unknown) => {
    mockCajas.push(caja);
    return { publicaciones: mockLect.pubs, cargando: mockLect.cargando, fallo: mockLect.fallo, reintentar: jest.fn() };
  },
}));

import { CercaWeb } from '../CercaWeb';

const U = { lat: 19.32568, lng: -99.458244 };
const lugar = (id: string, dLat: number | null) => ({ id, titulo_publico: id, latitud_aprox: dLat === null ? null : U.lat + dLat, longitud_aprox: dLat === null ? null : U.lng });
beforeEach(() => {
  jest.clearAllMocks();
  mockCajas.length = 0;
  Object.assign(mockLect, { pubs: [], cargando: false, fallo: false });
  mockPerfil.valor = null;
});

it('sin cuenta usa la universidad de la lista y lo dice', async () => {
  await render(<CercaWeb />);
  expect(screen.getByText(/Distancia a Universidad Tecnológica del Valle de Toluca/)).toBeTruthy();
});

it('con la universidad de la cuenta usa SU punto y su nombre', async () => {
  mockPerfil.valor = { universidad: 'Mi Universidad', latitud_universidad: 20, longitud_universidad: -100 };
  await render(<CercaWeb />);
  expect(screen.getByText(/Distancia a Mi Universidad\./)).toBeTruthy();
  const caja = mockCajas.at(-1) as { latMin: number; latMax: number };
  expect(caja.latMin).toBeLessThan(20);
  expect(caja.latMax).toBeGreaterThan(20);
});

it('una cuenta con universidad sin coordenadas cae a la de la lista, no a un punto inventado', async () => {
  mockPerfil.valor = { universidad: 'Otra', latitud_universidad: null, longitud_universidad: null };
  await render(<CercaWeb />);
  expect(screen.getByText(/Distancia a Universidad Tecnológica del Valle de Toluca/)).toBeTruthy();
});

it('ordena por cercanía, rotula el tiempo como estimado y omite lo que no se puede ubicar', async () => {
  Object.assign(mockLect, { pubs: [lugar('lejano', 0.02), lugar('sin-ubicar', null), lugar('cercano', 0.005)] });
  await render(<CercaWeb />);
  const filas = screen.getAllByText(/ \| a /).map((n) => n.props.children as string);
  expect(filas).toHaveLength(2);
  expect(filas[0]).toMatch(/^cercano \| a menos de 1 km · ~\d+ min a pie$/);
  expect(filas[1]).toMatch(/^lejano/);
  expect(screen.getByText(/estimaciones en línea recta/)).toBeTruthy();
});

it('cambiar el radio vuelve a consultar al servidor con otra caja', async () => {
  await render(<CercaWeb />);
  const antes = mockCajas.at(-1) as { latMax: number };
  await fireEvent.press(screen.getByLabelText('A menos de 5 km'));
  const despues = mockCajas.at(-1) as { latMax: number };
  expect(despues.latMax).toBeGreaterThan(antes.latMax);
});

it('si la consulta llega al tope, avisa que puede haber más', async () => {
  Object.assign(mockLect, { pubs: Array.from({ length: 150 }, (_, i) => lugar(`l${i}`, 0.001)) });
  await render(<CercaWeb />);
  expect(screen.getByText(/Hay más lugares en la zona/)).toBeTruthy();
});

it('falló ≠ nada ≠ cargando', async () => {
  Object.assign(mockLect, { fallo: true });
  await render(<CercaWeb />);
  expect(screen.getByText('No pudimos cargar los lugares cercanos')).toBeTruthy();
  expect(screen.queryByText(/No hay lugares publicados/)).toBeNull();
});

it('sin lugares en el radio, lo dice con el radio', async () => {
  await render(<CercaWeb />);
  expect(screen.getByText('No hay lugares publicados a menos de 3 km. Prueba con un radio mayor.')).toBeTruthy();
});
