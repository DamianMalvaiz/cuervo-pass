import { fireEvent, render, screen } from '@testing-library/react-native';

// `/servicios`: la página de los negocios. Lo que se fija: los negocios salen en su mosaico, las categorías filtran en el servidor, y «falló» no se pinta como «no hay negocios» (END-11).

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('expo-router/head', () => ({ __esModule: true, default: () => null }));
const mockPantalla = { ancho: 1280 };
jest.mock('@/hooks/use-tamano-pantalla', () => ({
  useTamanoPantalla: () => ({ clase: 'amplia', ancho: mockPantalla.ancho, alto: 900, anchoContenido: 480, anchoLista: 800, altoApretado: false, escalaTitulo: 1 }),
}));

const mockLlamadas: Record<string, unknown>[] = [];
const mockNeg = { negocios: [] as unknown[], cargando: false, fallo: false, reintentar: jest.fn() };
const mockCat = { categorias: [] as unknown[], cargando: false, fallo: false, reintentar: jest.fn() };
jest.mock('@/hooks/queries/useExplorar', () => ({
  useNegociosPublicos: (f: Record<string, unknown>) => {
    mockLlamadas.push(f);
    return mockNeg;
  },
  useCategoriasPublicas: () => mockCat,
  useFotosPublicas: () => ({ fotos: [], cargando: false, fallo: false }),
}));

import Servicios from '../servicios';

const NEG = { id: 'n1', categoria_id: 'c1', nombre: 'Café Lerma', zona: 'Centro, Lerma', abierto_ahora: true, calificacion: null, num_fotos: 0, destacado: false };
const CATS = [{ id: 'c1', nombre: 'Comida', icono: null, orden: 1 }, { id: 'c2', nombre: 'Salud', icono: null, orden: 2 }];
const ultimo = () => mockLlamadas.at(-1);

beforeEach(() => {
  jest.clearAllMocks();
  mockPantalla.ancho = 1280;
  mockLlamadas.length = 0;
  Object.assign(mockNeg, { negocios: [NEG], cargando: false, fallo: false });
  Object.assign(mockCat, { categorias: CATS, cargando: false, fallo: false });
});

test('tiene su título, la barra con Servicios marcado y el pie', async () => {
  await render(<Servicios />);
  expect(screen.getByText('Negocios y servicios')).toBeTruthy();
  expect(screen.getByLabelText('Servicios').props['aria-current']).toBe('page');
  expect(screen.getByText(/Proyecto académico de la UTVT/)).toBeTruthy();
});

test('enseña los negocios y al tocar uno va a su ficha, en su propia página', async () => {
  await render(<Servicios />);
  expect(screen.getByText('Café Lerma')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Café Lerma, Abierto ahora'));
  expect(mockPush).toHaveBeenCalledWith('/servicios/n1');
});

describe('categorías', () => {
  it('trae «Todos» y cada categoría; al inicio sin filtro', async () => {
    await render(<Servicios />);
    expect(screen.getByLabelText('Todos')).toBeTruthy();
    expect(screen.getByLabelText('Comida')).toBeTruthy();
    expect(screen.getByLabelText('Salud')).toBeTruthy();
    expect(screen.getByLabelText('Todos').props.accessibilityRole).toBe('radio');
    expect(screen.getByLabelText('Todos').props.accessibilityState).toEqual({ checked: true });
    expect(ultimo()).toEqual({ limite: 20 });
  });

  it('una categoría filtra en el servidor y queda marcada; «Todos» la quita', async () => {
    await render(<Servicios />);
    await fireEvent.press(screen.getByLabelText('Salud'));
    expect(ultimo()).toEqual({ limite: 20, categoriaId: 'c2' });
    expect(screen.getByLabelText('Salud').props.accessibilityState).toEqual({ checked: true });
    await fireEvent.press(screen.getByLabelText('Todos'));
    expect(ultimo()).toEqual({ limite: 20 });
  });

  it('si las categorías fallan, los negocios siguen a la vista (no se bloquea la página)', async () => {
    Object.assign(mockCat, { categorias: [], fallo: true });
    await render(<Servicios />);
    expect(screen.getByText('Café Lerma')).toBeTruthy();
  });
});

describe('estados', () => {
  it('en una categoría sin negocios dice que no hay en ESA categoría, y se puede quitar', async () => {
    Object.assign(mockNeg, { negocios: [] });
    await render(<Servicios />);
    await fireEvent.press(screen.getByLabelText('Salud'));
    expect(screen.getByText(/No hay negocios en esta categoría/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Quitar filtro'));
    expect(ultimo()).toEqual({ limite: 20 });
  });

  it('sin negocios publicados lo dice sin alarmar', async () => {
    Object.assign(mockNeg, { negocios: [] });
    await render(<Servicios />);
    expect(screen.getByText(/Todavía no hay negocios publicados/)).toBeTruthy();
  });

  it('si la lectura falla dice que falló (con reintento), no «no hay negocios»', async () => {
    Object.assign(mockNeg, { negocios: [], fallo: true });
    await render(<Servicios />);
    expect(screen.queryByText(/Todavía no hay negocios/)).toBeNull();
    await fireEvent.press(screen.getByLabelText('Reintentar'));
    expect(mockNeg.reintentar).toHaveBeenCalled();
  });
});

describe('en el teléfono (390 px)', () => {
  beforeEach(() => {
    mockPantalla.ancho = 390;
  });

  it('cada negocio es una tarjeta compacta (foto con el nombre debajo) que lleva a su ficha', async () => {
    await render(<Servicios />);
    expect(screen.getByText('Café Lerma').props.numberOfLines).toBe(2);
    await fireEvent.press(screen.getByLabelText('Café Lerma, Abierto ahora'));
    expect(mockPush).toHaveBeenCalledWith('/servicios/n1');
  });

  it('las categorías siguen filtrando y la barra inferior está', async () => {
    await render(<Servicios />);
    await fireEvent.press(screen.getByLabelText('Salud'));
    expect(ultimo()).toEqual({ limite: 20, categoriaId: 'c2' });
    expect(screen.getByLabelText('Navegación principal')).toBeTruthy();
  });
});
