import { fireEvent, render, screen } from '@testing-library/react-native';

// Ficha pública de un negocio (sin cuenta): descripción, si está abierto, horario día por día y productos con precio. Un menú que no cargó NO es un menú vacío (END-11);
// «no existe» y «falló» son estados distintos. Escribir al negocio o guardarlo pide cuenta.

const mockHead = jest.fn();
jest.mock('expo-router/head', () => ({
  __esModule: true,
  default: (props: unknown) => {
    mockHead(props);
    return null;
  },
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a), canGoBack: () => true, back: jest.fn() },
  useLocalSearchParams: () => ({ id: 'n1' }),
}));

const mockNeg = { negocio: null as unknown, cargando: false, fallo: false, reintentar: jest.fn() };
const mockProd = { productos: [] as unknown[], cargando: false, fallo: false, reintentar: jest.fn() };
const mockHor = { horario: [] as unknown[], cargando: false, fallo: false, reintentar: jest.fn() };
jest.mock('@/hooks/queries/useExplorar', () => ({
  useNegocioPublico: () => mockNeg,
  useProductosPublicos: () => mockProd,
  useHorarioPublico: () => mockHor,
  useFotosPublicas: () => ({ fotos: [], cargando: false, fallo: false }),
}));

import FichaNegocio from '../servicios/[id]';

const NEGOCIO = {
  id: 'n1', categoria_id: 'c1', nombre: 'Café Lerma', descripcion: 'Café y pan del día', zona: 'Centro, Lerma', horario: null,
  num_fotos: 0, destacado: false, calificacion: 4.6, num_resenas: 5, abierto_ahora: true,
};
const PRODUCTOS = [
  { id: 'i1', negocio_id: 'n1', nombre: 'Capuchino', precio: 45, seccion: 'Bebidas', descripcion: null, num_fotos: 0, estrella: true, orden: 1 },
  { id: 'i2', negocio_id: 'n1', nombre: 'Concha', precio: null, seccion: 'Pan', descripcion: null, num_fotos: 0, estrella: false, orden: 2 },
];

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockNeg, { negocio: NEGOCIO, cargando: false, fallo: false });
  Object.assign(mockProd, { productos: PRODUCTOS, cargando: false, fallo: false });
  Object.assign(mockHor, { horario: [{ negocio_id: 'n1', dia: 1, abre: '09:00:00', cierra: '18:00:00' }], cargando: false, fallo: false });
});

test('enseña nombre, descripción, zona, calificación y que está abierto', async () => {
  await render(<FichaNegocio />);
  expect(screen.getByText('Café Lerma')).toBeTruthy();
  expect(screen.getByText('Café y pan del día')).toBeTruthy();
  expect(screen.getByText(/Centro, Lerma/)).toBeTruthy();
  expect(screen.getByText(/4\.6/)).toBeTruthy();
  expect(screen.getByText(/Abierto ahora/)).toBeTruthy();
});

test('un negocio cerrado lo dice', async () => {
  Object.assign(mockNeg, { negocio: { ...NEGOCIO, abierto_ahora: false } });
  await render(<FichaNegocio />);
  expect(screen.getByText(/Cerrado ahora/)).toBeTruthy();
});

test('horario día por día, con los siete días', async () => {
  await render(<FichaNegocio />);
  expect(screen.getByText('Lunes')).toBeTruthy();
  expect(screen.getByText('Domingo')).toBeTruthy();
  expect(screen.getAllByText('Cerrado').length).toBe(6);
});

test('productos con precio; sin precio dice «Consulta el precio», no inventa uno', async () => {
  await render(<FichaNegocio />);
  expect(screen.getByText('Capuchino')).toBeTruthy();
  expect(screen.getByText(/\$45/)).toBeTruthy();
  expect(screen.getByText('Concha')).toBeTruthy();
  expect(screen.getByText(/Consulta el precio/)).toBeTruthy();
});

test('sin secciones ni estrellas no inventa un rótulo de grupo', async () => {
  Object.assign(mockProd, { productos: [{ ...PRODUCTOS[0], seccion: null, estrella: false }] });
  await render(<FichaNegocio />);
  expect(screen.queryByText('PRODUCTOS')).toBeNull();
  expect(screen.getByText('Capuchino')).toBeTruthy();
});

test('las estrellas van bajo «Destacados» y el resto, bajo su sección', async () => {
  await render(<FichaNegocio />);
  expect(screen.getByText('DESTACADOS')).toBeTruthy();
  expect(screen.getByText('PAN')).toBeTruthy();
  expect(screen.queryByText('BEBIDAS')).toBeNull();
});

test('si el menú falla, ofrece reintentar y NO dice que no hay productos', async () => {
  Object.assign(mockProd, { productos: [], fallo: true });
  await render(<FichaNegocio />);
  expect(screen.queryByText(/no tiene productos/i)).toBeNull();
  await fireEvent.press(screen.getByLabelText('Reintentar'));
  expect(mockProd.reintentar).toHaveBeenCalled();
});

test('un negocio sin productos publicados lo dice sin alarmar', async () => {
  Object.assign(mockProd, { productos: [] });
  await render(<FichaNegocio />);
  expect(screen.getByText(/no tiene productos/i)).toBeTruthy();
});

test('no existe → «ya no está disponible»; falla → reintentar', async () => {
  Object.assign(mockNeg, { negocio: null });
  const { unmount } = await render(<FichaNegocio />);
  expect(screen.getByText(/ya no está disponible/i)).toBeTruthy();
  await unmount();
  Object.assign(mockNeg, { negocio: null, fallo: true });
  await render(<FichaNegocio />);
  expect(screen.queryByText(/ya no está disponible/i)).toBeNull();
  await fireEvent.press(screen.getByLabelText('Reintentar'));
  expect(mockNeg.reintentar).toHaveBeenCalled();
});

test('lo que necesita cuenta lleva a entrar, sin prometer escribirle a un negocio (la app no lo permite)', async () => {
  await render(<FichaNegocio />);
  expect(screen.queryByLabelText('Iniciar sesión para escribir')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Entrar para ver la dirección exacta'));
  expect(mockPush).toHaveBeenCalledWith('/(auth)/login');
});

describe('la pestaña del navegador', () => {
  it('lleva el nombre del negocio y el del sitio', async () => {
    mockHead.mockClear();
    await render(<FichaNegocio />);
    const titulos = mockHead.mock.calls.map((c) => (c[0] as { children: { props: { children: string } } }).children.props.children);
    expect(titulos).toContain('Café Lerma · Cuervo 360');
  });
});

describe('el diseño nuevo de la ficha del negocio', () => {
  it('trae la barra con «Volver» y el título «Menú»', async () => {
    await render(<FichaNegocio />);
    expect(screen.getByLabelText('Volver')).toBeTruthy();
    expect(screen.getByText('Menú')).toBeTruthy();
  });

  it('el horario marca un día como hoy', async () => {
    await render(<FichaNegocio />);
    expect(screen.getAllByLabelText(/, hoy:/)).toHaveLength(1);
  });

  it('los productos estrella salen primero bajo «Destacados»', async () => {
    await render(<FichaNegocio />);
    expect(screen.getByText('DESTACADOS')).toBeTruthy();
  });

  it('la invitación a entrar habla de guardarlo y de su dirección exacta, no de escribirle', async () => {
    await render(<FichaNegocio />);
    expect(screen.getByText('Entra para guardarlo y ver su dirección exacta.')).toBeTruthy();
    expect(screen.queryByText(/escribirle/i)).toBeNull();
  });

  it('un negocio sin fotos lo dice', async () => {
    await render(<FichaNegocio />);
    expect(screen.getByText('Este negocio todavía no tiene fotos')).toBeTruthy();
  });
});
