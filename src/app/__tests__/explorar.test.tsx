import { fireEvent, render, screen } from '@testing-library/react-native';

// Portada pública de la web (tramo 1): se ve SIN cuenta, con datos reducidos. Lo que se fija: dice qué es, los filtros y el buscador filtran DE VERDAD en el servidor (el buscador solo al
// pulsar Buscar; los chips al instante), un fallo de lectura NO se pinta como «no hay nada» (END-11) y lo que necesita cuenta lleva a entrar.

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));

// La pestaña lleva a su sección con `useDesplazador`; aquí solo importa A QUÉ nodo avisa.
const mockAlNodo = jest.fn();
jest.mock('@/hooks/use-desplazador', () => ({
  useDesplazador: () => ({ registrarScroll: () => {}, onScroll: () => {}, desplazador: { alNodo: (...a: unknown[]) => mockAlNodo(...a) } }),
}));

jest.mock('@/hooks/use-tamano-pantalla', () => ({
  useTamanoPantalla: () => ({ clase: 'amplia', ancho: 1280, alto: 900, anchoContenido: 480, anchoLista: 800, altoApretado: false, escalaTitulo: 1 }),
}));

const mockFiltros: Record<string, unknown>[] = [];
const mockPub = { publicaciones: [] as unknown[], cargando: false, fallo: false, reintentar: jest.fn() };
const mockNeg = { negocios: [] as unknown[], cargando: false, fallo: false, reintentar: jest.fn() };
jest.mock('@/hooks/queries/useExplorar', () => ({
  usePublicacionesPublicas: (f: Record<string, unknown>) => {
    mockFiltros.push(f);
    return mockPub;
  },
  useNegociosPublicos: () => mockNeg,
  useFotosPublicas: () => ({ fotos: [], cargando: false, fallo: false }),
}));

import Explorar from '../explorar';

const DEPA = { id: 'p1', titulo_publico: 'Cuarto en Santa María', tipo: 'cuarto', precio_renta: 2900, zona: 'Santa María, Lerma, México, CP 52000', num_fotos: 0, destacado: true, calificacion: 4.9, num_resenas: 3 };
const ultimoFiltro = () => mockFiltros.filter((f) => (f.limite as number) > 3).at(-1);

beforeEach(() => {
  jest.clearAllMocks();
  mockFiltros.length = 0;
  Object.assign(mockPub, { publicaciones: [DEPA], cargando: false, fallo: false });
  Object.assign(mockNeg, { negocios: [], cargando: false, fallo: false });
});

test('dice qué es en una frase y deja entrar o crear cuenta', async () => {
  await render(<Explorar />);
  expect(screen.getByText(/Encuentra dónde/)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Iniciar sesión'));
  expect(mockPush).toHaveBeenCalledWith('/(auth)/login');
  await fireEvent.press(screen.getByLabelText('Crear cuenta'));
  expect(mockPush).toHaveBeenCalledWith('/(auth)/registro');
});

test('enseña los lugares con precio y zona corta, nunca la dirección ni el CP', async () => {
  await render(<Explorar />);
  expect(screen.getByLabelText(/Cuarto en Santa María, 2,900 pesos al mes/)).toBeTruthy();
  expect(screen.getByText(/2,900/)).toBeTruthy();
  expect(screen.getByText('Santa María, Lerma')).toBeTruthy();
  expect(screen.queryByText(/CP 52000/)).toBeNull();
});

test('al tocar un lugar va a su ficha pública (sin cuenta)', async () => {
  await render(<Explorar />);
  await fireEvent.press(screen.getByLabelText(/Cuarto en Santa María, 2,900 pesos al mes/));
  expect(mockPush).toHaveBeenCalledWith('/explorar/p1');
});

describe('filtros', () => {
  it('sin tocar nada, la lista no lleva filtro', async () => {
    await render(<Explorar />);
    expect(ultimoFiltro()).toEqual({ limite: 12 });
  });

  it('un chip filtra al instante, en el servidor', async () => {
    await render(<Explorar />);
    await fireEvent.press(screen.getByLabelText('Filtrar por departamentos'));
    expect(ultimoFiltro()).toEqual({ limite: 12, tipo: 'depa' });
    await fireEvent.press(screen.getByLabelText('Filtrar por acepta mascotas'));
    expect(ultimoFiltro()).toEqual({ limite: 12, tipo: 'depa', mascotas: true });
  });

  it('el buscador NO filtra mientras se teclea: solo al pulsar Buscar', async () => {
    await render(<Explorar />);
    await fireEvent.changeText(screen.getByLabelText('Zona o colonia'), 'Lerma');
    await fireEvent.changeText(screen.getByLabelText('Presupuesto máximo al mes'), '4000');
    expect(ultimoFiltro()).toEqual({ limite: 12 });
    await fireEvent.press(screen.getByLabelText('Buscar'));
    expect(ultimoFiltro()).toEqual({ limite: 12, zona: 'Lerma', precioMax: 4000 });
  });

  it('con filtros y sin resultados dice que NO hay con esos filtros, y se pueden quitar', async () => {
    Object.assign(mockPub, { publicaciones: [] });
    await render(<Explorar />);
    await fireEvent.press(screen.getByLabelText('Filtrar por cuartos'));
    expect(screen.getByText(/No hay lugares con esos filtros/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Quitar filtros'));
    expect(ultimoFiltro()).toEqual({ limite: 12 });
    expect(screen.queryByText(/No hay lugares con esos filtros/)).toBeNull();
  });

  it('sin filtros y sin lugares publicados, lo dice sin alarmar', async () => {
    Object.assign(mockPub, { publicaciones: [] });
    await render(<Explorar />);
    expect(screen.getByText(/Todavía no hay lugares publicados/)).toBeTruthy();
    expect(screen.queryByLabelText('Quitar filtros')).toBeNull();
  });
});

test('si la lectura falla dice que falló (con reintento), no «no hay lugares»', async () => {
  Object.assign(mockPub, { publicaciones: [], fallo: true });
  await render(<Explorar />);
  expect(screen.queryByText(/Todavía no hay lugares/)).toBeNull();
  expect(screen.queryByText(/No hay lugares con esos filtros/)).toBeNull();
  await fireEvent.press(screen.getAllByLabelText('Reintentar')[0]);
  expect(mockPub.reintentar).toHaveBeenCalled();
});

describe('ver más lugares', () => {
  const muchos = (n: number) => Array.from({ length: n }, (_, i) => ({ ...DEPA, id: `p${i}`, titulo_publico: `Lugar ${i}`, destacado: false }));
  const tarjetas = () => screen.queryAllByLabelText(/pesos al mes/).length;

  it('al principio enseña dos filas (8 en escritorio) y un botón para ver el resto', async () => {
    Object.assign(mockPub, { publicaciones: muchos(12) });
    await render(<Explorar />);
    expect(tarjetas()).toBe(8);
    expect(screen.getByLabelText('Ver más lugares')).toBeTruthy();
  });

  it('al pulsarlo salen todos y el botón desaparece', async () => {
    Object.assign(mockPub, { publicaciones: muchos(12) });
    await render(<Explorar />);
    await fireEvent.press(screen.getByLabelText('Ver más lugares'));
    expect(tarjetas()).toBe(12);
    expect(screen.queryByLabelText('Ver más lugares')).toBeNull();
  });

  it('si caben todos, no hay botón (no promete más de lo que hay)', async () => {
    Object.assign(mockPub, { publicaciones: muchos(8) });
    await render(<Explorar />);
    expect(tarjetas()).toBe(8);
    expect(screen.queryByLabelText('Ver más lugares')).toBeNull();
  });

  it('al cambiar un filtro vuelve a las dos filas (otra búsqueda, otra lista)', async () => {
    Object.assign(mockPub, { publicaciones: muchos(12) });
    await render(<Explorar />);
    await fireEvent.press(screen.getByLabelText('Ver más lugares'));
    expect(tarjetas()).toBe(12);
    await fireEvent.press(screen.getByLabelText('Filtrar por departamentos'));
    expect(tarjetas()).toBe(8);
    expect(screen.getByLabelText('Ver más lugares')).toBeTruthy();
  });
});

describe('ver más lugares · al volver a una búsqueda anterior', () => {
  const muchos = (n: number) => Array.from({ length: n }, (_, i) => ({ ...DEPA, id: `p${i}`, titulo_publico: `Lugar ${i}`, destacado: false }));
  const tarjetas = () => screen.queryAllByLabelText(/pesos al mes/).length;

  it('volver a la búsqueda de antes (apagar el filtro que se prendió) regresa a las dos filas, aunque ahí se hubiera pulsado «Ver más»', async () => {
    Object.assign(mockPub, { publicaciones: muchos(12) });
    await render(<Explorar />);
    await fireEvent.press(screen.getByLabelText('Ver más lugares'));
    expect(tarjetas()).toBe(12);
    await fireEvent.press(screen.getByLabelText('Filtrar por cuartos'));
    await fireEvent.press(screen.getByLabelText('Filtrar por cuartos'));
    expect(tarjetas()).toBe(8);
    expect(screen.getByLabelText('Ver más lugares')).toBeTruthy();
  });
});

describe('negocios', () => {
  const NEG = { id: 'n1', nombre: 'Café Lerma', zona: 'Centro, Lerma, México, CP 52000', abierto_ahora: true, calificacion: 4.6, num_fotos: 0, destacado: false };

  it('enseña los negocios y al tocar uno va a su ficha pública', async () => {
    Object.assign(mockNeg, { negocios: [NEG] });
    await render(<Explorar />);
    expect(screen.getByText('Café Lerma')).toBeTruthy();
    expect(screen.getByLabelText('Café Lerma, Abierto ahora')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(/Café Lerma/));
    expect(mockPush).toHaveBeenCalledWith('/explorar/negocio/n1');
  });

  it('si fallan lo dice y deja reintentar; los lugares siguen a la vista', async () => {
    Object.assign(mockNeg, { negocios: [], fallo: true });
    await render(<Explorar />);
    expect(screen.getByLabelText(/Cuarto en Santa María, 2,900 pesos al mes/)).toBeTruthy();
    await fireEvent.press(screen.getAllByLabelText('Reintentar')[0]);
    expect(mockNeg.reintentar).toHaveBeenCalled();
  });
});

describe('las secciones y las pestañas', () => {
  it('trae todas las secciones de la portada', async () => {
    await render(<Explorar />);
    expect(screen.getByText('Departamentos y cuartos')).toBeTruthy();
    expect(screen.getByText('Negocios cerca')).toBeTruthy();
    expect(screen.getByText('Con quién vives importa tanto como dónde')).toBeTruthy();
    expect(screen.getByText('Cómo funciona, sin adivinar')).toBeTruthy();
    expect(screen.getByText('Hecho para que confíes')).toBeTruthy();
  });

  it('cada pestaña lleva a SU sección (nada de entrar: Roomies ya enseña de qué trata)', async () => {
    await render(<Explorar />);
    await fireEvent.press(screen.getByLabelText('Roomies'));
    await fireEvent.press(screen.getByLabelText('Servicios'));
    await fireEvent.press(screen.getByLabelText('Departamentos'));
    expect(mockAlNodo).toHaveBeenCalledTimes(3);
    expect(mockPush).not.toHaveBeenCalledWith('/(auth)/login');
  });

  it('«Ver roomies», dentro de su sección, sí lleva a entrar', async () => {
    await render(<Explorar />);
    await fireEvent.press(screen.getByLabelText('Ver roomies'));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/login');
  });

  it('«Cómo funciona» usa el título del primer lugar publicado, para reconocerlo (y sigue siendo un ejemplo)', async () => {
    await render(<Explorar />);
    expect(screen.getAllByText('Cuarto en Santa María').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Ejemplo').length).toBeGreaterThan(1);
  });
});
