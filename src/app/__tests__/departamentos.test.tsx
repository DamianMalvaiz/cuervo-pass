import { fireEvent, render, screen } from '@testing-library/react-native';

// `/departamentos`: la página de los lugares, con el buscador y los filtros. Se ve SIN cuenta, con datos reducidos. Lo que se fija: los filtros filtran DE VERDAD en el servidor (el buscador solo al pulsar Buscar, los chips al
// instante), la búsqueda puede venir en la URL (enlace compartible), un fallo de lectura NO se pinta como «no hay nada» (END-11), y la cuadrícula se ajusta al ancho de la ventana.

const mockPush = jest.fn();
const mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) }, useLocalSearchParams: () => mockParams }));
jest.mock('expo-router/head', () => ({ __esModule: true, default: () => null }));

const mockPantalla = { ancho: 1280 };
jest.mock('@/hooks/use-tamano-pantalla', () => ({
  useTamanoPantalla: () => ({ clase: 'amplia', ancho: mockPantalla.ancho, alto: 900, anchoContenido: 480, anchoLista: 800, altoApretado: false, escalaTitulo: 1 }),
}));

const mockFiltros: Record<string, unknown>[] = [];
const mockPub = { publicaciones: [] as unknown[], cargando: false, fallo: false, reintentar: jest.fn() };
jest.mock('@/hooks/queries/useExplorar', () => ({
  usePublicacionesPublicas: (f: Record<string, unknown>) => {
    mockFiltros.push(f);
    return mockPub;
  },
  useFotosPublicas: () => ({ fotos: [], cargando: false, fallo: false }),
}));

import Departamentos from '../departamentos';

const DEPA = { id: 'p1', titulo_publico: 'Cuarto en Santa María', tipo: 'cuarto', precio_renta: 2900, zona: 'Santa María, Lerma, México, CP 52000', num_fotos: 0, destacado: true, calificacion: 4.9, num_resenas: 3 };
const muchos = (n: number) => Array.from({ length: n }, (_, i) => ({ ...DEPA, id: `p${i}`, titulo_publico: `Lugar ${i}`, destacado: false }));
const ultimoFiltro = () => mockFiltros.at(-1);
const tarjetas = () => screen.queryAllByLabelText(/pesos al mes/).length;

beforeEach(() => {
  jest.clearAllMocks();
  mockFiltros.length = 0;
  for (const k of Object.keys(mockParams)) delete mockParams[k];
  mockPantalla.ancho = 1280;
  Object.assign(mockPub, { publicaciones: [DEPA], cargando: false, fallo: false });
});

describe('la página', () => {
  it('tiene su título, la barra con Departamentos marcado y el pie', async () => {
    await render(<Departamentos />);
    expect(screen.getByText('Departamentos y cuartos')).toBeTruthy();
    expect(screen.getByLabelText('Departamentos').props['aria-current']).toBe('page');
    expect(screen.getByText(/Proyecto académico de la UTVT/)).toBeTruthy();
  });

  it('enseña los lugares con precio y zona corta, nunca la dirección ni el CP', async () => {
    await render(<Departamentos />);
    expect(screen.getByLabelText(/Cuarto en Santa María, 2,900 pesos al mes/)).toBeTruthy();
    expect(screen.getByText('Santa María, Lerma')).toBeTruthy();
    expect(screen.queryByText(/CP 52000/)).toBeNull();
  });

  it('al tocar un lugar va a su ficha pública, en su propia página', async () => {
    await render(<Departamentos />);
    await fireEvent.press(screen.getByLabelText(/Cuarto en Santa María, 2,900 pesos al mes/));
    expect(mockPush).toHaveBeenCalledWith('/departamentos/p1');
  });
});

describe('la búsqueda viene en la URL', () => {
  it('sin parámetros, sin filtros', async () => {
    await render(<Departamentos />);
    expect(ultimoFiltro()).toEqual({ limite: 20 });
  });

  it('con parámetros abre la búsqueda ya filtrada, y los campos lo reflejan', async () => {
    Object.assign(mockParams, { tipo: 'cuarto', zona: 'Lerma', presupuesto: '4000', mascotas: '1' });
    await render(<Departamentos />);
    expect(ultimoFiltro()).toEqual({ limite: 20, zona: 'Lerma', precioMax: 4000, tipo: 'cuarto', mascotas: true });
    expect(screen.getByLabelText('Zona o colonia').props.value).toBe('Lerma');
    expect(screen.getByLabelText('Presupuesto máximo al mes').props.value).toBe('4000');
    expect(screen.getByLabelText('Filtrar por cuartos').props.accessibilityState).toEqual({ checked: true });
  });

  it('un parámetro roto no se vuelve filtro', async () => {
    Object.assign(mockParams, { tipo: 'mansion', presupuesto: 'abc', amueblado: 'true' });
    await render(<Departamentos />);
    expect(ultimoFiltro()).toEqual({ limite: 20 });
  });
});

describe('filtros', () => {
  it('un chip filtra al instante, en el servidor', async () => {
    await render(<Departamentos />);
    await fireEvent.press(screen.getByLabelText('Filtrar por departamentos'));
    expect(ultimoFiltro()).toEqual({ limite: 20, tipo: 'depa' });
    await fireEvent.press(screen.getByLabelText('Filtrar por acepta mascotas'));
    expect(ultimoFiltro()).toEqual({ limite: 20, tipo: 'depa', mascotas: true });
  });

  it('el buscador NO filtra mientras se teclea: solo al pulsar Buscar', async () => {
    await render(<Departamentos />);
    await fireEvent.changeText(screen.getByLabelText('Zona o colonia'), 'Lerma');
    await fireEvent.changeText(screen.getByLabelText('Presupuesto máximo al mes'), '4000');
    expect(ultimoFiltro()).toEqual({ limite: 20 });
    await fireEvent.press(screen.getByLabelText('Buscar'));
    expect(ultimoFiltro()).toEqual({ limite: 20, zona: 'Lerma', precioMax: 4000 });
  });

  it('con filtros y sin resultados dice que NO hay con esos filtros, y se pueden quitar', async () => {
    Object.assign(mockPub, { publicaciones: [] });
    await render(<Departamentos />);
    await fireEvent.press(screen.getByLabelText('Filtrar por cuartos'));
    expect(screen.getByText(/No hay lugares con esos filtros/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Quitar filtros'));
    expect(ultimoFiltro()).toEqual({ limite: 20 });
    expect(screen.queryByText(/No hay lugares con esos filtros/)).toBeNull();
  });

  it('sin filtros y sin lugares publicados, lo dice sin alarmar', async () => {
    Object.assign(mockPub, { publicaciones: [] });
    await render(<Departamentos />);
    expect(screen.getByText(/Todavía no hay lugares publicados/)).toBeTruthy();
    expect(screen.queryByLabelText('Quitar filtros')).toBeNull();
  });
});

test('si la lectura falla dice que falló (con reintento), no «no hay lugares»', async () => {
  Object.assign(mockPub, { publicaciones: [], fallo: true });
  await render(<Departamentos />);
  expect(screen.queryByText(/Todavía no hay lugares/)).toBeNull();
  expect(screen.queryByText(/No hay lugares con esos filtros/)).toBeNull();
  await fireEvent.press(screen.getByLabelText('Reintentar'));
  expect(mockPub.reintentar).toHaveBeenCalled();
});

describe('la cuadrícula se ajusta al ancho de la ventana', () => {
  it.each([
    [1920, 10], // 5 por fila, dos filas
    [1280, 8], // 4 por fila
    [800, 6], // 3 por fila
    [560, 6], // 2 por fila (mínimo seis)
    [390, 6], // una columna (mínimo seis)
  ])('con %i px de ancho, las dos filas del principio son %i lugares', async (ancho, esperadas) => {
    mockPantalla.ancho = ancho;
    Object.assign(mockPub, { publicaciones: muchos(20) });
    await render(<Departamentos />);
    expect(tarjetas()).toBe(esperadas);
  });
});

describe('ver más lugares', () => {
  it('al principio enseña dos filas y un botón; al pulsarlo salen todos y el botón desaparece', async () => {
    Object.assign(mockPub, { publicaciones: muchos(12) });
    await render(<Departamentos />);
    expect(tarjetas()).toBe(8);
    await fireEvent.press(screen.getByLabelText('Ver más lugares'));
    expect(tarjetas()).toBe(12);
    expect(screen.queryByLabelText('Ver más lugares')).toBeNull();
  });

  it('si caben todos, no hay botón (no promete más de lo que hay)', async () => {
    Object.assign(mockPub, { publicaciones: muchos(8) });
    await render(<Departamentos />);
    expect(screen.queryByLabelText('Ver más lugares')).toBeNull();
  });

  it('cualquier cambio de búsqueda, incluso volver a la de antes, regresa a las dos filas', async () => {
    Object.assign(mockPub, { publicaciones: muchos(12) });
    await render(<Departamentos />);
    await fireEvent.press(screen.getByLabelText('Ver más lugares'));
    expect(tarjetas()).toBe(12);
    await fireEvent.press(screen.getByLabelText('Filtrar por cuartos'));
    await fireEvent.press(screen.getByLabelText('Filtrar por cuartos'));
    expect(tarjetas()).toBe(8);
  });
});

describe('en el teléfono (390 px)', () => {
  beforeEach(() => {
    mockPantalla.ancho = 390;
  });

  it('el buscador es una píldora: los campos están ocultos hasta tocarla', async () => {
    await render(<Departamentos />);
    expect(screen.getByLabelText('¿Dónde quieres vivir?. Zona · presupuesto · tipo')).toBeTruthy();
    expect(screen.queryByLabelText('Zona o colonia')).toBeNull();
    await fireEvent.press(screen.getByLabelText('¿Dónde quieres vivir?. Zona · presupuesto · tipo'));
    expect(screen.getByLabelText('Zona o colonia')).toBeTruthy();
  });

  it('al pulsar Buscar filtra y la píldora se pliega diciendo qué se buscó', async () => {
    await render(<Departamentos />);
    await fireEvent.press(screen.getByLabelText('¿Dónde quieres vivir?. Zona · presupuesto · tipo'));
    await fireEvent.changeText(screen.getByLabelText('Zona o colonia'), 'Lerma');
    await fireEvent.press(screen.getByLabelText('Buscar'));
    expect(ultimoFiltro()).toEqual({ limite: 20, zona: 'Lerma' });
    expect(screen.queryByLabelText('Zona o colonia')).toBeNull();
    expect(screen.getByLabelText('Lerma. Todos los tipos')).toBeTruthy();
  });

  it('una búsqueda que viene en la URL se resume en la píldora', async () => {
    Object.assign(mockParams, { tipo: 'cuarto', zona: 'Lerma', presupuesto: '4000' });
    await render(<Departamentos />);
    expect(screen.getByLabelText('Lerma. Cuarto · hasta $4,000')).toBeTruthy();
  });

  it('las tarjetas son compactas (título de hasta dos renglones) y trae la barra inferior', async () => {
    await render(<Departamentos />);
    expect(screen.getByText('Cuarto en Santa María').props.numberOfLines).toBe(2);
    expect(screen.getByLabelText('Navegación principal')).toBeTruthy();
  });
});

test('en el teléfono el subtítulo no gasta espacio; en escritorio sí está', async () => {
  mockPantalla.ancho = 390;
  const { unmount } = await render(<Departamentos />);
  expect(screen.queryByText(/Cuartos, departamentos y casas compartidas/)).toBeNull();
  await unmount();
  mockPantalla.ancho = 1280;
  await render(<Departamentos />);
  expect(screen.getByText(/Cuartos, departamentos y casas compartidas/)).toBeTruthy();
});
