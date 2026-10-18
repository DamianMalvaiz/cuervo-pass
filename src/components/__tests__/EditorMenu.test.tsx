import { act, fireEvent, render, screen } from '@testing-library/react-native';

// El menú a escala real (0053). Lo que se fija: todo es LOCAL hasta «Guardar menú»; se guarda la lista entera en una sola
// llamada; un menú inválido no sale; y los fallos se dicen como fallos, con su código.

const mockMutate = jest.fn();
const mockBack = jest.fn();
const mockExito = jest.fn();
const mockError = jest.fn();
const mockPermiso = jest.fn();
const mockElegir = jest.fn();

jest.mock('expo-router', () => ({ router: { back: (...a: unknown[]) => mockBack(...a) } }));
jest.mock('@/hooks/queries/useMisNegocios', () => ({
  useGuardarMenu: () => ({ mutate: (...a: unknown[]) => mockMutate(...a), isPending: false }),
}));
jest.mock('@/hooks/use-fotos-firmadas', () => ({
  useFotosFirmadas: () => ({ urls: new Map([['negocios/n1/p/a.jpg', 'https://f.test/a']]) }),
}));
jest.mock('@/lib/toast', () => ({
  toast: { exito: (...a: unknown[]) => mockExito(...a), error: (...a: unknown[]) => mockError(...a), info: jest.fn() },
}));
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: (...a: unknown[]) => mockPermiso(...a),
  launchImageLibraryAsync: (...a: unknown[]) => mockElegir(...a),
}));

import { EditorMenu } from '../EditorMenu';

const item = (id: string, nombre: string, extra: Record<string, unknown> = {}) => ({
  id, negocio_id: 'n1', nombre, precio: 20, orden: 0, seccion: null, descripcion: null, foto: null, ...extra,
});
const ITEMS = [
  item('i1', 'Taco al pastor', { seccion: 'Tacos', descripcion: 'Con piña', foto: 'negocios/n1/p/a.jpg' }),
  item('i2', 'Agua de horchata', { seccion: 'Bebidas', precio: 15 }),
  item('i3', 'Revisión', { precio: null }),
];

const pulsar = async (e: string | RegExp) => { await act(async () => { fireEvent.press(screen.getByLabelText(e)); }); };
const escribir = async (e: string | RegExp, t: string) => { await act(async () => { fireEvent.changeText(screen.getByLabelText(e), t); }); };
const montar = () => render(<EditorMenu negocioId="n1" nombreNegocio="Tacos La Esquina" items={ITEMS as never} />);

beforeEach(() => {
  jest.clearAllMocks();
  mockPermiso.mockResolvedValue({ granted: true });
  mockElegir.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///nueva.jpg' }] });
});

describe('la lista', () => {
  it('muestra el nombre del negocio y cuántos productos hay', async () => {
    await montar();
    expect(screen.getByText('Menú de Tacos La Esquina')).toBeTruthy();
    expect(screen.getByText('3 productos')).toBeTruthy();
  });

  it('agrupa por secciones y deja «Sin sección» al final', async () => {
    await montar();
    expect(screen.getByText('Tacos')).toBeTruthy();
    expect(screen.getByText('Bebidas')).toBeTruthy();
    expect(screen.getByText('Sin sección')).toBeTruthy();
  });

  it('dice el precio, o «Consultar» si no hay uno (nunca inventa)', async () => {
    await montar();
    expect(screen.getByText('$20')).toBeTruthy();
    expect(screen.getByText('$15')).toBeTruthy();
    expect(screen.getByText('Consultar')).toBeTruthy();
  });

  it('un menú vacío lo dice y ofrece agregar', async () => {
    await render(<EditorMenu negocioId="n1" nombreNegocio="X" items={[]} />);
    expect(screen.getByText(/Todavía no hay productos/)).toBeTruthy();
  });
});

describe('la búsqueda', () => {
  it('filtra sin importar mayúsculas ni acentos', async () => {
    await montar();
    await escribir('Buscar en el menú', 'PASTOR');
    expect(screen.getByText('Taco al pastor')).toBeTruthy();
    expect(screen.queryByText('Agua de horchata')).toBeNull();
  });

  it('sin coincidencias lo dice', async () => {
    await montar();
    await escribir('Buscar en el menú', 'zzzz');
    expect(screen.getByText('No hay productos con esa búsqueda.')).toBeTruthy();
  });
});

describe('editar productos (todo local hasta guardar)', () => {
  it('tocar un producto abre su editor con sus datos', async () => {
    await montar();
    await pulsar('Editar Taco al pastor');
    expect(screen.getByText('Editar producto')).toBeTruthy();
    expect(screen.getByDisplayValue('Taco al pastor')).toBeTruthy();
    expect(screen.getByDisplayValue('Con piña')).toBeTruthy();
  });

  it('cambiar un producto actualiza la lista pero NO llama a la red', async () => {
    await montar();
    await pulsar('Editar Taco al pastor');
    await escribir('Nombre del producto', 'Taco de pastor');
    await pulsar('Guardar producto');
    expect(screen.getByText('Taco de pastor')).toBeTruthy();
    expect(screen.queryByText('Taco al pastor')).toBeNull();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('agregar un producto nuevo lo suma a la lista', async () => {
    await montar();
    await pulsar('Agregar un producto');
    expect(screen.getByText('Nuevo producto')).toBeTruthy();
    await escribir('Nombre del producto', 'Quesadilla');
    await escribir(/Precio/, '35');
    await escribir(/Sección/, 'Antojitos');
    await pulsar('Guardar producto');
    expect(screen.getByText('Quesadilla')).toBeTruthy();
    expect(screen.getByText('Antojitos')).toBeTruthy();
    expect(screen.getByText('4 productos')).toBeTruthy();
  });

  it('un producto sin nombre NO se agrega y dice por qué', async () => {
    await montar();
    await pulsar('Agregar un producto');
    await pulsar('Guardar producto');
    expect(screen.getByText('Escribe el nombre del producto')).toBeTruthy();
    expect(screen.getByText('3 productos')).toBeTruthy();
  });

  it('un precio inválido NO se acepta', async () => {
    await montar();
    await pulsar('Agregar un producto');
    await escribir('Nombre del producto', 'Taco');
    await escribir(/Precio/, 'mucho');
    await pulsar('Guardar producto');
    expect(screen.getByText(/Escribe solo números/)).toBeTruthy();
  });

  it('quitar un producto lo saca de la lista', async () => {
    await montar();
    await pulsar('Editar Revisión');
    await pulsar('Quitar el producto del menú');
    expect(screen.queryByText('Revisión')).toBeNull();
    expect(screen.getByText('2 productos')).toBeTruthy();
  });

  it('cancelar el editor no cambia nada', async () => {
    await montar();
    await pulsar('Editar Taco al pastor');
    await escribir('Nombre del producto', 'Cambiado');
    await pulsar('Cancelar');
    expect(screen.getByText('Taco al pastor')).toBeTruthy();
    expect(screen.queryByText('Cambiado')).toBeNull();
  });

  it('las secciones que ya existen se ofrecen como atajos', async () => {
    await montar();
    await pulsar('Agregar un producto');
    await pulsar('Usar la sección Bebidas');
    expect(screen.getByDisplayValue('Bebidas')).toBeTruthy();
  });

  it('se puede agregar y quitar la foto de un producto', async () => {
    await montar();
    await pulsar('Editar Agua de horchata');
    await pulsar('Agregar una foto del producto');
    expect(screen.getByLabelText('Quitar la foto del producto')).toBeTruthy();
    await pulsar('Quitar la foto del producto');
    expect(screen.queryByLabelText('Quitar la foto del producto')).toBeNull();
  });

  it('sin permiso de galería no agrega foto', async () => {
    mockPermiso.mockResolvedValue({ granted: false, canAskAgain: true });
    await montar();
    await pulsar('Editar Agua de horchata');
    await pulsar('Agregar una foto del producto');
    expect(mockElegir).not.toHaveBeenCalled();
    expect(mockError).toHaveBeenCalled();
  });
});

describe('guardar el menú', () => {
  it('manda la lista ENTERA y las fotos con que se cargó, en una sola llamada', async () => {
    await montar();
    await pulsar('Guardar menú');
    expect(mockMutate).toHaveBeenCalledTimes(1);
    const entrada = mockMutate.mock.calls[0][0];
    expect(entrada.productos.map((p: { nombre: string }) => p.nombre)).toEqual(['Taco al pastor', 'Agua de horchata', 'Revisión']);
    expect(entrada.fotosAnteriores).toEqual(['negocios/n1/p/a.jpg']);
    expect(entrada.productos[0].id).toBe('i1');
  });

  it('los cambios locales viajan en esa llamada', async () => {
    await montar();
    await pulsar('Editar Revisión');
    await pulsar('Quitar el producto del menú');
    await pulsar('Guardar menú');
    expect(mockMutate.mock.calls[0][0].productos).toHaveLength(2);
  });

  it('al guardar bien avisa y vuelve atrás', async () => {
    mockMutate.mockImplementation((_e, { onSuccess }) => onSuccess());
    await montar();
    await pulsar('Guardar menú');
    expect(mockExito).toHaveBeenCalledWith('Menú guardado');
    expect(mockBack).toHaveBeenCalled();
  });

  it('CP009 se explica por código: tu plan permite menos productos', async () => {
    mockMutate.mockImplementation((_e, { onError }) => onError({ code: 'CP009' }));
    await montar();
    await pulsar('Guardar menú');
    expect(String(mockError.mock.calls[0][0])).toMatch(/plan permite menos productos/);
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('un fallo de red se dice como fallo, sin éxito', async () => {
    mockMutate.mockImplementation((_e, { onError }) => onError(new Error('Network request failed')));
    await montar();
    await pulsar('Guardar menú');
    expect(String(mockError.mock.calls[0][0])).toMatch(/conexión/);
    expect(mockExito).not.toHaveBeenCalled();
  });
});
