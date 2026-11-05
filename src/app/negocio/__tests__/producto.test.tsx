import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

// La pantalla de UN producto (maqueta B): sus fotos que se deslizan, su categoría, el precio grande, la descripción y de qué negocio es. Cuatro estados, y distintos
// (END-11): cargando, falló, el producto ya no existe, y lo que se enseña. Sin precio dice «Consultar precio», nunca un cero.

const mockNegocio = jest.fn();
const mockFotos = jest.fn();
const mockPush = jest.fn();
let mockParams: Record<string, string> = { id: 'p1', negocio: 'n1' };
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  router: { push: (...a: unknown[]) => mockPush(...a) },
}));
jest.mock('@/hooks/queries/useServicios', () => ({ useNegocio: (...a: unknown[]) => mockNegocio(...a) }));
jest.mock('@/hooks/use-fotos-firmadas', () => ({ useFotosFirmadas: (...a: unknown[]) => mockFotos(...a) }));

import ProductoScreen from '../producto/[id]';

const PRODUCTO = {
  id: 'p1', negocio_id: 'n1', nombre: 'Edredón matrimonial', precio: 120, orden: 0, seccion: 'Edredones', descripcion: 'Lavado y secado, listo en 24 horas.',
  foto: null, fotos: [] as string[], estrella: false,
};
const NEGOCIO = { id: 'n1', nombre: 'Lavandería Burbuja', latitud: 19.3, longitud: -99.4, abierto_ahora: true, fotos: [] };
const estado = (extra: Record<string, unknown> = {}, producto: Record<string, unknown> = {}) => ({
  negocio: NEGOCIO, items: [{ ...PRODUCTO, ...producto }], turnos: [], cargando: false, fallo: false, reintentar: jest.fn(), ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { id: 'p1', negocio: 'n1' };
  mockNegocio.mockReturnValue(estado());
  mockFotos.mockReturnValue({ urls: new Map(), fallo: null });
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

test('pide el negocio con el id del parámetro y enseña nombre, categoría, descripción y precio', async () => {
  await render(<ProductoScreen />);
  expect(mockNegocio).toHaveBeenCalledWith('n1');
  expect(screen.getByText('Edredón matrimonial')).toBeTruthy();
  expect(screen.getByText('Edredones')).toBeTruthy();
  expect(screen.getByText('Lavado y secado, listo en 24 horas.')).toBeTruthy();
  expect(screen.getByText('$120')).toBeTruthy();
});

test('sin precio dice «Consultar precio»', async () => {
  mockNegocio.mockReturnValue(estado({}, { precio: null }));
  await render(<ProductoScreen />);
  expect(screen.getByText('Consultar precio')).toBeTruthy();
  expect(screen.queryByText('$0')).toBeNull();
});

test('sin categoría ni descripción no deja huecos ni inventa nada', async () => {
  mockNegocio.mockReturnValue(estado({}, { seccion: null, descripcion: null }));
  await render(<ProductoScreen />);
  expect(screen.queryByText('Edredones')).toBeNull();
  expect(screen.getByText('Edredón matrimonial')).toBeTruthy();
});

describe('las fotos', () => {
  const con = (n: number) => {
    const fotos = Array.from({ length: n }, (_, i) => `negocios/n1/p/${i}.jpg`);
    mockNegocio.mockReturnValue(estado({}, { fotos, foto: fotos[0] ?? null }));
    return fotos;
  };

  it('con varias dice en cuál va y cuántas hay, y firma TODAS en lote', async () => {
    const fotos = con(3);
    await render(<ProductoScreen />);
    expect(screen.getByLabelText('3 fotografías del producto')).toBeTruthy();
    expect(screen.getByText('1 de 3')).toBeTruthy();
    expect(mockFotos).toHaveBeenCalledWith(fotos);
  });

  it('con una sola no lleva contador', async () => {
    con(1);
    await render(<ProductoScreen />);
    expect(screen.queryByText(/ de /)).toBeNull();
  });

  it('sin fotos no hay carrusel: queda un marcador', async () => {
    con(0);
    await render(<ProductoScreen />);
    expect(screen.queryByLabelText(/fotografías del producto/)).toBeNull();
  });

  it('una fila de antes de la 0085, que solo trae `foto`, también enseña su foto', async () => {
    mockNegocio.mockReturnValue(estado({}, { fotos: [], foto: 'negocios/n1/p/vieja.jpg' }));
    await render(<ProductoScreen />);
    expect(mockFotos).toHaveBeenCalledWith(['negocios/n1/p/vieja.jpg']);
  });
});

test('un producto estrella lo dice', async () => {
  mockNegocio.mockReturnValue(estado({}, { estrella: true }));
  await render(<ProductoScreen />);
  expect(screen.getByText('Destacado')).toBeTruthy();
});

describe('de qué negocio es', () => {
  it('dice el negocio y si está abierto', async () => {
    await render(<ProductoScreen />);
    expect(screen.getByText('Lavandería Burbuja')).toBeTruthy();
    expect(screen.getByText('Abierto ahora')).toBeTruthy();
  });

  it('cerrado se dice con palabras', async () => {
    mockNegocio.mockReturnValue(estado({ negocio: { ...NEGOCIO, abierto_ahora: false } }));
    await render(<ProductoScreen />);
    expect(screen.getByText('Cerrado ahora')).toBeTruthy();
  });

  it('sin horario conocido no inventa abierto ni cerrado', async () => {
    mockNegocio.mockReturnValue(estado({ negocio: { ...NEGOCIO, abierto_ahora: null } }));
    await render(<ProductoScreen />);
    expect(screen.queryByText(/Abierto ahora|Cerrado ahora/)).toBeNull();
  });

  it('«Ver el negocio» abre su ficha', async () => {
    await render(<ProductoScreen />);
    await act(async () => { fireEvent.press(screen.getByLabelText('Ver el negocio')); });
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/negocio/[id]', params: { id: 'n1' } });
  });
});

describe('«Cómo llegar»', () => {
  it('abre el mapa con las coordenadas del negocio', async () => {
    await render(<ProductoScreen />);
    await act(async () => { fireEvent.press(screen.getByLabelText('Cómo llegar')); });
    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining('19.3,-99.4'));
  });

  it('sin coordenadas no se ofrece', async () => {
    mockNegocio.mockReturnValue(estado({ negocio: { ...NEGOCIO, latitud: null, longitud: null } }));
    await render(<ProductoScreen />);
    expect(screen.queryByLabelText('Cómo llegar')).toBeNull();
  });
});

describe('estados', () => {
  it('cargando no afirma nada', async () => {
    mockNegocio.mockReturnValue(estado({ negocio: null, items: [], cargando: true }));
    await render(<ProductoScreen />);
    expect(screen.queryByText('Edredón matrimonial')).toBeNull();
    expect(screen.queryByText(/ya no está disponible/)).toBeNull();
  });

  it('un fallo de lectura se dice y ofrece reintentar, sin decir que no existe', async () => {
    const reintentar = jest.fn();
    mockNegocio.mockReturnValue(estado({ negocio: null, items: [], fallo: true, reintentar }));
    await render(<ProductoScreen />);
    expect(screen.getByText(/No pudimos cargar/)).toBeTruthy();
    expect(screen.queryByText(/ya no está disponible/)).toBeNull();
    await act(async () => { fireEvent.press(screen.getByLabelText('Reintentar')); });
    expect(reintentar).toHaveBeenCalled();
  });

  it('un producto que ya no está en el negocio se dice', async () => {
    mockParams = { id: 'otro', negocio: 'n1' };
    await render(<ProductoScreen />);
    expect(screen.getByText(/Este producto ya no está disponible/)).toBeTruthy();
  });

  it('un negocio que ya no existe también', async () => {
    mockNegocio.mockReturnValue(estado({ negocio: null, items: [] }));
    await render(<ProductoScreen />);
    expect(screen.getByText(/Este producto ya no está disponible/)).toBeTruthy();
  });
});
