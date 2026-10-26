import { fireEvent, render, screen } from '@testing-library/react-native';

// Portada pública de la web (tramo 1): se ve SIN cuenta, con datos reducidos. Lo que se fija: dice qué es, los filtros y el buscador filtran DE VERDAD en el servidor (el buscador solo al
// pulsar Buscar; los chips al instante), un fallo de lectura NO se pinta como «no hay nada» (END-11) y lo que necesita cuenta lleva a entrar.

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));

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
  expect(screen.getByText('Cuarto en Santa María')).toBeTruthy();
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

describe('negocios', () => {
  const NEG = { id: 'n1', nombre: 'Café Lerma', zona: 'Centro, Lerma, México, CP 52000', abierto_ahora: true, calificacion: 4.6, num_fotos: 0, destacado: false };

  it('enseña los negocios y al tocar uno va a su ficha pública', async () => {
    Object.assign(mockNeg, { negocios: [NEG] });
    await render(<Explorar />);
    expect(screen.getByText('Café Lerma')).toBeTruthy();
    expect(screen.getByText(/Abierto ahora/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(/Café Lerma/));
    expect(mockPush).toHaveBeenCalledWith('/explorar/negocio/n1');
  });

  it('si fallan lo dice y deja reintentar; los lugares siguen a la vista', async () => {
    Object.assign(mockNeg, { negocios: [], fallo: true });
    await render(<Explorar />);
    expect(screen.getByText('Cuarto en Santa María')).toBeTruthy();
    await fireEvent.press(screen.getAllByLabelText('Reintentar')[0]);
    expect(mockNeg.reintentar).toHaveBeenCalled();
  });
});

test('la pestaña Roomies pide entrar: sus perfiles solo se ven con cuenta', async () => {
  await render(<Explorar />);
  await fireEvent.press(screen.getByLabelText('Roomies'));
  expect(mockPush).toHaveBeenCalledWith('/(auth)/login');
});
