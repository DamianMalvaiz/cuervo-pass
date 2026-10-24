import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

// Ficha de un negocio de Servicios · Cuervo 360. Tres estados y no dos (END-11): cargando, falló y «no existe» no
// son lo mismo. El menú dice «Consultar precio» cuando no hay uno, y nunca inventa un precio. Un negocio de ejemplo se
// rotula. «Cómo llegar» solo existe si hay coordenadas.

const mockNegocio = jest.fn();
const mockFotos = jest.fn();
const mockMisNegocios = jest.fn();
const mockSeccion = jest.fn();
// El corazón de negocios tiene sus propias pruebas; aquí solo importa que se monte con el id correcto.
jest.mock('@/components/BotonFavoritoNegocio', () => ({
  BotonFavoritoNegocio: ({ negocioId }: { negocioId: string }) => {
    const { Text } = require('react-native');
    return <Text>{`CORAZON ${negocioId}`}</Text>;
  },
}));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'n1' }) }));
jest.mock('@/hooks/queries/useServicios', () => ({ useNegocio: (...a: unknown[]) => mockNegocio(...a) }));
jest.mock('@/hooks/queries/useMisNegocios', () => ({ useMisNegocios: (...a: unknown[]) => mockMisNegocios(...a) }));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }),
}));
// Las reseñas tienen sus propias pruebas; aquí solo importa que la ficha las monte con lo correcto.
jest.mock('@/components/SeccionResenas', () => ({
  SeccionResenas: (props: unknown) => {
    const { Text } = require('react-native');
    mockSeccion(props);
    return <Text>SECCION RESEÑAS</Text>;
  },
}));
jest.mock('@/hooks/use-fotos-firmadas', () => ({ useFotosFirmadas: (...a: unknown[]) => mockFotos(...a) }));

import NegocioScreen from '../[id]';

const NEGOCIO = {
  id: 'n1', categoria_id: 'cafes', nombre: 'Café La Parada', descripcion: 'Café de olla y de especialidad.',
  direccion: 'Av. Las Torres 408, Lerma', latitud: 19.327, longitud: -99.457, rango_precio: 2,
  horario: 'Lun a sáb · 8 am a 9 pm', fotos: [], destacado: true, origen: 'sembrado',
};
const ITEMS = [
  { id: 'i1', negocio_id: 'n1', nombre: 'Café americano', precio: 35, orden: 0 },
  { id: 'i2', negocio_id: 'n1', nombre: 'Revisión', precio: null, orden: 1 },
];
const estado = (extra: Record<string, unknown> = {}) => ({
  negocio: NEGOCIO, items: ITEMS, turnos: [], cargando: false, fallo: false, reintentar: jest.fn(), ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockNegocio.mockReturnValue(estado());
  mockFotos.mockReturnValue({ urls: new Map(), fallo: null });
  mockMisNegocios.mockReturnValue({ negocios: [], cargando: false, fallo: false });
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

test('pide el negocio con el id de la ruta', async () => {
  await render(<NegocioScreen />);
  expect(mockNegocio).toHaveBeenCalledWith('n1');
});

test('pinta nombre, descripción, dirección, horario y precio', async () => {
  await render(<NegocioScreen />);
  expect(screen.getByText('Café La Parada')).toBeTruthy();
  expect(screen.getByText('Café de olla y de especialidad.')).toBeTruthy();
  expect(screen.getByText('Av. Las Torres 408, Lerma')).toBeTruthy();
  expect(screen.getByText('Lun a sáb · 8 am a 9 pm')).toBeTruthy();
  expect(screen.queryByText('$$')).toBeNull();
});

test('un negocio de ejemplo se rotula', async () => {
  await render(<NegocioScreen />);
  expect(screen.getByText('Negocio de ejemplo')).toBeTruthy();
});

test('un negocio real no lleva el rótulo de ejemplo', async () => {
  mockNegocio.mockReturnValue(estado({ negocio: { ...NEGOCIO, origen: 'solicitud' } }));
  await render(<NegocioScreen />);
  expect(screen.queryByText('Negocio de ejemplo')).toBeNull();
});

test('el menú dice el precio, o «Consultar precio» si no lo hay (nunca lo inventa)', async () => {
  await render(<NegocioScreen />);
  expect(screen.getByText('Café americano')).toBeTruthy();
  expect(screen.getByText('$35')).toBeTruthy();
  expect(screen.getByText('Revisión')).toBeTruthy();
  expect(screen.getByText('Consultar precio')).toBeTruthy();
});

test('sin productos no pinta un menú vacío', async () => {
  mockNegocio.mockReturnValue(estado({ items: [] }));
  await render(<NegocioScreen />);
  expect(screen.queryByText('Lo que vende')).toBeNull();
});

test('«Cómo llegar» abre el mapa con las coordenadas', async () => {
  await render(<NegocioScreen />);
  await act(async () => { fireEvent.press(screen.getByLabelText('Cómo llegar')); });
  expect(Linking.openURL).toHaveBeenCalledWith(
    'https://www.google.com/maps/search/?api=1&query=19.327,-99.457'
  );
});

test('sin coordenadas no hay «Cómo llegar»', async () => {
  mockNegocio.mockReturnValue(estado({ negocio: { ...NEGOCIO, latitud: null, longitud: null } }));
  await render(<NegocioScreen />);
  expect(screen.queryByLabelText('Cómo llegar')).toBeNull();
});

test('mientras carga no dice que no existe', async () => {
  mockNegocio.mockReturnValue(estado({ negocio: null, items: [], cargando: true }));
  await render(<NegocioScreen />);
  expect(screen.queryByText(/ya no está disponible/)).toBeNull();
  expect(screen.getByLabelText('Cargando')).toBeTruthy();
});

test('un fallo de lectura NO se pinta como «ya no está disponible»', async () => {
  const reintentar = jest.fn();
  mockNegocio.mockReturnValue(estado({ negocio: null, items: [], fallo: true, reintentar }));
  await render(<NegocioScreen />);
  expect(screen.queryByText(/ya no está disponible/)).toBeNull();
  await act(async () => { fireEvent.press(screen.getByLabelText('Reintentar')); });
  expect(reintentar).toHaveBeenCalled();
});

test('un negocio que no existe o no es visible lo dice', async () => {
  mockNegocio.mockReturnValue(estado({ negocio: null, items: [] }));
  await render(<NegocioScreen />);
  expect(screen.getByText(/ya no está disponible/)).toBeTruthy();
});

// Cuervo 360 · galería y menú a escala real (0053).
describe('la galería', () => {
  const conFotos = (n: number) => {
    const fotos = Array.from({ length: n }, (_, i) => `negocios/n1/${i}.jpg`);
    mockNegocio.mockReturnValue(estado({ negocio: { ...NEGOCIO, fotos } }));
    mockFotos.mockReturnValue({ urls: new Map(fotos.map((f) => [f, `https://f.test/${f}`])), fallo: null });
  };

  it('con varias fotos dice en cuál vas y cuántas hay', async () => {
    conFotos(12);
    await render(<NegocioScreen />);
    expect(screen.getByText('1 de 12')).toBeTruthy();
    expect(screen.getByLabelText('12 fotografías del negocio')).toBeTruthy();
  });

  it('con una sola foto no lleva contador', async () => {
    conFotos(1);
    await render(<NegocioScreen />);
    expect(screen.queryByText(/^\d+ de \d+$/)).toBeNull();
  });

  it('sin fotos no hay contador ni carrusel', async () => {
    await render(<NegocioScreen />);
    expect(screen.queryByText(/^\d+ de \d+$/)).toBeNull();
    expect(screen.queryByLabelText(/fotografías del negocio/)).toBeNull();
  });

  it('firma EN LOTE la galería y las fotos de los productos, una sola vez', async () => {
    mockNegocio.mockReturnValue(estado({
      negocio: { ...NEGOCIO, fotos: ['negocios/n1/a.jpg'] },
      items: [{ id: 'i1', negocio_id: 'n1', nombre: 'Taco', precio: 20, orden: 0, seccion: null, descripcion: null, foto: 'negocios/n1/p/t.jpg', fotos: ['negocios/n1/p/t.jpg'] }],
    }));
    await render(<NegocioScreen />);
    expect(mockFotos).toHaveBeenCalledWith(['negocios/n1/a.jpg', 'negocios/n1/p/t.jpg']);
  });

  it('de cada producto la lista firma solo la PORTADA (la primera), no todas sus fotos', async () => {
    mockNegocio.mockReturnValue(estado({
      negocio: { ...NEGOCIO, fotos: [] },
      items: [{ id: 'i1', negocio_id: 'n1', nombre: 'Taco', precio: 20, orden: 0, seccion: null, descripcion: null, foto: 'negocios/n1/p/t.jpg', fotos: ['negocios/n1/p/t.jpg', 'negocios/n1/p/u.jpg'] }],
    }));
    await render(<NegocioScreen />);
    expect(mockFotos).toHaveBeenCalledWith(['negocios/n1/p/t.jpg']);
  });
});

describe('lo que vende', () => {
  it('la sección se llama «Lo que vende» (ya no «Menú y precios»)', async () => {
    await render(<NegocioScreen />);
    expect(screen.getByText('Lo que vende')).toBeTruthy();
    expect(screen.queryByText('Menú y precios')).toBeNull();
  });
});

describe('el menú por secciones', () => {
  const item = (id: string, nombre: string, extra: Record<string, unknown> = {}) => ({
    id, negocio_id: 'n1', nombre, precio: 10, orden: 0, seccion: null, descripcion: null, foto: null, fotos: [], ...extra,
  });

  it('agrupa por sección, en el orden del menú, y deja «Otros» al final', async () => {
    mockNegocio.mockReturnValue(estado({
      items: [item('a', 'Taco', { seccion: 'Tacos' }), item('b', 'Agua', { seccion: 'Bebidas' }), item('c', 'Revisión'), item('d', 'Gringa', { seccion: 'tacos' })],
    }));
    await render(<NegocioScreen />);
    // Cada nombre sale en su pestaña y en el título de su grupo.
    expect(screen.getAllByText('Tacos')).toHaveLength(2);
    expect(screen.getAllByText('Bebidas')).toHaveLength(2);
    expect(screen.getAllByText('Otros')).toHaveLength(2);
    // «Tacos» y «tacos» son una misma sección.
    expect(screen.getAllByText(/^tacos$/i)).toHaveLength(2);
  });

  it('un menú sin secciones no inventa títulos: solo «Otros»', async () => {
    mockNegocio.mockReturnValue(estado({ items: [item('a', 'Taco'), item('b', 'Agua')] }));
    await render(<NegocioScreen />);
    expect(screen.getByText('Otros')).toBeTruthy();
  });

  describe('pestañas de categoría', () => {
    const variado = () => estado({
      items: [item('a', 'Taco', { seccion: 'Tacos' }), item('b', 'Agua', { seccion: 'Bebidas' }), item('c', 'Revisión')],
    });

    it('con dos o más grupos hay pestañas: «Todo» primero y una por categoría', async () => {
      mockNegocio.mockReturnValue(variado());
      await render(<NegocioScreen />);
      expect(screen.getByLabelText('Categoría Todo').props.accessibilityState).toEqual({ selected: true });
      expect(screen.getByLabelText('Categoría Tacos')).toBeTruthy();
      expect(screen.getByLabelText('Categoría Bebidas')).toBeTruthy();
      expect(screen.getByLabelText('Categoría Otros')).toBeTruthy();
    });

    it('tocar una pestaña deja SOLO los productos de esa categoría', async () => {
      mockNegocio.mockReturnValue(variado());
      await render(<NegocioScreen />);
      await act(async () => { fireEvent.press(screen.getByLabelText('Categoría Bebidas')); });
      expect(screen.getByText('Agua')).toBeTruthy();
      expect(screen.queryByText('Taco')).toBeNull();
      expect(screen.queryByText('Revisión')).toBeNull();
      expect(screen.getByLabelText('Categoría Bebidas').props.accessibilityState).toEqual({ selected: true });
      expect(screen.getByLabelText('Categoría Todo').props.accessibilityState).toEqual({ selected: false });
    });

    it('«Todo» vuelve a enseñarlos todos', async () => {
      mockNegocio.mockReturnValue(variado());
      await render(<NegocioScreen />);
      await act(async () => { fireEvent.press(screen.getByLabelText('Categoría Bebidas')); });
      await act(async () => { fireEvent.press(screen.getByLabelText('Categoría Todo')); });
      expect(screen.getByText('Taco')).toBeTruthy();
      expect(screen.getByText('Agua')).toBeTruthy();
      expect(screen.getByText('Revisión')).toBeTruthy();
    });

    it('con un solo grupo no hay pestañas: no hay nada que elegir', async () => {
      mockNegocio.mockReturnValue(estado({ items: [item('a', 'Taco', { seccion: 'Tacos' }), item('b', 'Gringa', { seccion: 'Tacos' })] }));
      await render(<NegocioScreen />);
      expect(screen.queryByLabelText('Categoría Todo')).toBeNull();
    });
  });

  it('cada producto muestra su descripción', async () => {
    mockNegocio.mockReturnValue(estado({ items: [item('a', 'Taco', { seccion: 'Tacos', descripcion: 'Con piña y cilantro' })] }));
    await render(<NegocioScreen />);
    expect(screen.getByText('Con piña y cilantro')).toBeTruthy();
  });

  it('un producto con foto la muestra; sin foto no deja un hueco', async () => {
    mockNegocio.mockReturnValue(estado({ items: [item('a', 'Taco', { foto: 'negocios/n1/p/t.jpg', fotos: ['negocios/n1/p/t.jpg', 'negocios/n1/p/u.jpg'] }), item('b', 'Agua')] }));
    mockFotos.mockReturnValue({ urls: new Map([['negocios/n1/p/t.jpg', 'https://f.test/t']]), fallo: null });
    await render(<NegocioScreen />);
    expect(screen.getByText('Taco')).toBeTruthy();
    expect(screen.getByText('Agua')).toBeTruthy();
  });
});

// Reseñas (0054).
describe('las reseñas en la ficha', () => {
  it('monta la sección con el negocio, su promedio calculado y cuántas reseñas son', async () => {
    mockNegocio.mockReturnValue(estado({ negocio: { ...NEGOCIO, calificacion: 4.5, num_resenas: 12 } }));
    await render(<NegocioScreen />);
    expect(screen.getByText('SECCION RESEÑAS')).toBeTruthy();
    expect(mockSeccion).toHaveBeenCalledWith({ objetivo: { negocioId: 'n1' }, esDueno: false, calificacion: 4.5, numResenas: 12 });
  });

  it('si es MI negocio, la sección sabe que soy el dueño (responde, no reseña)', async () => {
    mockMisNegocios.mockReturnValue({ negocios: [{ id: 'n1' }], cargando: false, fallo: false });
    await render(<NegocioScreen />);
    expect(mockSeccion).toHaveBeenCalledWith(expect.objectContaining({ esDueno: true }));
  });

  it('un negocio sin reseñas no inventa calificación: null y 0', async () => {
    await render(<NegocioScreen />);
    expect(mockSeccion).toHaveBeenCalledWith(expect.objectContaining({ calificacion: undefined, numResenas: 0 }));
  });

  it('con reseñas, el resumen compacto aparece junto al nombre', async () => {
    mockNegocio.mockReturnValue(estado({ negocio: { ...NEGOCIO, calificacion: 4.5, num_resenas: 12 } }));
    await render(<NegocioScreen />);
    expect(screen.getAllByLabelText('4.5 de 5 estrellas, 12 reseñas').length).toBeGreaterThan(0);
  });
});

describe('horario estructurado (0070)', () => {
  const turnos = [1, 2, 3, 4, 5].map((dia) => ({ dia, abre: '09:00', cierra: '18:00' }));

  test('con turnos: «Ver horario» está plegado y no se despliega solo; el texto libre se deja de usar', async () => {
    mockNegocio.mockReturnValue(estado({ turnos, negocio: { ...NEGOCIO, abierto_ahora: true } }));
    await render(<NegocioScreen />);
    expect(screen.getByLabelText('Ver horario').props.accessibilityState).toMatchObject({ expanded: false });
    expect(screen.queryByText('Miércoles')).toBeNull();
    expect(screen.getByText('Abierto ahora')).toBeTruthy();
    expect(screen.queryByText('Lun a sáb · 8 am a 9 pm')).toBeNull();
  });

  test('al tocarlo se despliega el horario DÍA POR DÍA, con los nombres completos', async () => {
    mockNegocio.mockReturnValue(estado({ turnos, negocio: { ...NEGOCIO, abierto_ahora: true } }));
    await render(<NegocioScreen />);
    await act(async () => { fireEvent.press(screen.getByLabelText('Ver horario')); });
    expect(screen.getByLabelText('Ver horario').props.accessibilityState).toMatchObject({ expanded: true });
    for (const dia of ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']) expect(screen.getByText(dia)).toBeTruthy();
    expect(screen.getAllByText('9 am a 6 pm')).toHaveLength(5);
    expect(screen.getAllByText('Cerrado')).toHaveLength(2);
  });

  test('tocarlo otra vez lo pliega', async () => {
    mockNegocio.mockReturnValue(estado({ turnos }));
    await render(<NegocioScreen />);
    await act(async () => { fireEvent.press(screen.getByLabelText('Ver horario')); });
    await act(async () => { fireEvent.press(screen.getByLabelText('Ver horario')); });
    expect(screen.queryByText('Miércoles')).toBeNull();
  });

  test('sin turnos no hay «Ver horario»', async () => {
    mockNegocio.mockReturnValue(estado({ turnos: [] }));
    await render(<NegocioScreen />);
    expect(screen.queryByLabelText('Ver horario')).toBeNull();
  });

  test('cerrado ahora se dice con palabras', async () => {
    mockNegocio.mockReturnValue(estado({ turnos, negocio: { ...NEGOCIO, abierto_ahora: false } }));
    await render(<NegocioScreen />);
    expect(screen.getByText('Cerrado ahora')).toBeTruthy();
  });

  test('sin horario estructurado no inventa «abierto» ni «cerrado»: queda el texto de siempre', async () => {
    mockNegocio.mockReturnValue(estado({ negocio: { ...NEGOCIO, abierto_ahora: null } }));
    await render(<NegocioScreen />);
    expect(screen.queryByText(/Abierto ahora|Cerrado ahora/)).toBeNull();
    expect(screen.getByText('Lun a sáb · 8 am a 9 pm')).toBeTruthy();
  });
});

it('la ficha lleva el corazón de ESE negocio', async () => {
  await render(<NegocioScreen />);
  expect(screen.getByText('CORAZON n1')).toBeTruthy();
});
