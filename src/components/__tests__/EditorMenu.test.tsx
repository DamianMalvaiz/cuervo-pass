import { act, fireEvent, render, screen } from '@testing-library/react-native';

// El menú a escala real (0053). Lo que se fija: todo es LOCAL hasta «Guardar menú»; se guarda la lista entera en una sola
// llamada; un menú inválido no sale; y los fallos se dicen como fallos, con su código.

const mockMutate = jest.fn();
const mockBack = jest.fn();
const mockExito = jest.fn();
const mockError = jest.fn();
const mockPermiso = jest.fn();
const mockElegir = jest.fn();
const mockSus = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({ router: { back: (...a: unknown[]) => mockBack(...a), push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/hooks/queries/usePlanes', () => ({ useMiSuscripcion: (...a: unknown[]) => mockSus(...a) }));
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
  id, negocio_id: 'n1', nombre, precio: 20, orden: 0, seccion: null, descripcion: null, foto: null, fotos: [], estrella: false, ...extra,
});
const ITEMS = [
  item('i1', 'Taco al pastor', { seccion: 'Tacos', descripcion: 'Con piña', foto: 'negocios/n1/p/a.jpg', fotos: ['negocios/n1/p/a.jpg'] }),
  item('i2', 'Agua de horchata', { seccion: 'Bebidas', precio: 15 }),
  item('i3', 'Revisión', { precio: null }),
];

const pulsar = async (e: string | RegExp) => { await act(async () => { fireEvent.press(screen.getByLabelText(e)); }); };
const escribir = async (e: string | RegExp, t: string) => { await act(async () => { fireEvent.changeText(screen.getByLabelText(e), t); }); };
const montar = () => render(<EditorMenu negocioId="n1" nombreNegocio="Tacos La Esquina" items={ITEMS as never} />);

beforeEach(() => {
  jest.clearAllMocks();
  mockSus.mockReturnValue({ suscripcion: { max_fotos: 60, max_productos: 250 }, cargando: false, fallo: false });
  mockPermiso.mockResolvedValue({ granted: true });
  mockElegir.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///nueva.jpg' }] });
});

describe('la lista', () => {
  it('muestra el nombre del negocio y cuántos productos hay', async () => {
    await montar();
    expect(screen.getByText('Menú de Tacos La Esquina')).toBeTruthy();
    expect(screen.getByText('3 de 250 productos')).toBeTruthy();
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
    await pulsar(/^Sección:/);
    await pulsar('Otra sección');
    await escribir('Escribe la sección', 'Antojitos');
    await pulsar('Guardar producto');
    expect(screen.getByText('Quesadilla')).toBeTruthy();
    expect(screen.getByText('Antojitos')).toBeTruthy();
    expect(screen.getByText('4 de 250 productos')).toBeTruthy();
  });

  it('un producto sin nombre NO se agrega y dice por qué', async () => {
    await montar();
    await pulsar('Agregar un producto');
    await pulsar('Guardar producto');
    expect(screen.getByText('Escribe el nombre del producto')).toBeTruthy();
    expect(screen.getByText('3 de 250 productos')).toBeTruthy();
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
    expect(screen.getByText('2 de 250 productos')).toBeTruthy();
  });

  it('cancelar el editor no cambia nada', async () => {
    await montar();
    await pulsar('Editar Taco al pastor');
    await escribir('Nombre del producto', 'Cambiado');
    await pulsar('Cancelar');
    expect(screen.getByText('Taco al pastor')).toBeTruthy();
    expect(screen.queryByText('Cambiado')).toBeNull();
  });

  describe('la sección se elige de una lista (con «Otra» al final, donde se escribe)', () => {
    it('sin elegir dice «Sección: sin elegir» y no hay un campo de texto a la vista', async () => {
      await montar();
      await pulsar('Agregar un producto');
      expect(screen.getByLabelText('Sección: sin elegir')).toBeTruthy();
      expect(screen.queryByLabelText('Escribe la sección')).toBeNull();
    });

    it('al abrirla ofrece las predefinidas y «Otra sección» va la ÚLTIMA', async () => {
      await montar();
      await pulsar('Agregar un producto');
      await pulsar(/^Sección:/);
      for (const s of ['Comida', 'Bebidas', 'Postres', 'Productos', 'Servicios']) expect(screen.getAllByLabelText(`Sección ${s}`).length).toBeGreaterThan(0);
      const opciones = screen.getAllByLabelText(/^Sección |^Otra sección$/).map((o) => o.props.accessibilityLabel);
      expect(opciones[opciones.length - 1]).toBe('Otra sección');
    });

    it('elegir una predefinida la guarda y cierra la lista', async () => {
      await montar();
      await pulsar('Agregar un producto');
      await escribir('Nombre del producto', 'Flan');
      await pulsar(/^Sección:/);
      await pulsar('Sección Postres');
      expect(screen.getByLabelText('Sección: Postres')).toBeTruthy();
      expect(screen.queryByLabelText('Sección Comida')).toBeNull();
      await pulsar('Guardar producto');
      expect(screen.getByText('Postres')).toBeTruthy();
    });

    it('las secciones que el negocio ya usa también están en la lista', async () => {
      await montar();
      await pulsar('Agregar un producto');
      await pulsar(/^Sección:/);
      expect(screen.getAllByLabelText('Sección Tacos').length).toBeGreaterThan(0);
    });

    it('«Otra sección» abre un campo para escribirla, con el tope de 40', async () => {
      await montar();
      await pulsar('Agregar un producto');
      await pulsar(/^Sección:/);
      await pulsar('Otra sección');
      expect(screen.getByLabelText('Escribe la sección').props.maxLength).toBe(40);
    });

    it('editar un producto con una sección propia la muestra elegida (no la pierde)', async () => {
      await montar();
      await pulsar('Editar Taco al pastor');
      expect(screen.getByLabelText('Sección: Tacos')).toBeTruthy();
    });
  });

  it('se puede agregar y quitar una foto de un producto', async () => {
    await montar();
    await pulsar('Editar Agua de horchata');
    await pulsar('Agregar una foto del producto');
    expect(screen.getByLabelText('Quitar la foto 1 del producto')).toBeTruthy();
    await pulsar('Quitar la foto 1 del producto');
    expect(screen.queryByLabelText('Quitar la foto 1 del producto')).toBeNull();
  });

  it('un producto puede llevar varias fotos: las guardadas y las nuevas se enumeran juntas', async () => {
    await montar();
    await pulsar('Editar Taco al pastor');
    expect(screen.getByLabelText('Quitar la foto 1 del producto')).toBeTruthy();
    await pulsar('Agregar una foto del producto');
    await pulsar('Agregar una foto del producto');
    expect(screen.getByLabelText('Quitar la foto 3 del producto')).toBeTruthy();
  });

  it('con 5 fotos ya no se ofrece agregar otra: dice el tope', async () => {
    await montar();
    await pulsar('Editar Taco al pastor');
    for (let i = 0; i < 4; i++) await pulsar('Agregar una foto del producto');
    expect(screen.queryByLabelText('Agregar una foto del producto')).toBeNull();
    expect(screen.getByText(/hasta 5 fotos/)).toBeTruthy();
  });

  it('quitar una foto en medio deja las demás y las vuelve a enumerar', async () => {
    await montar();
    await pulsar('Editar Taco al pastor');
    await pulsar('Agregar una foto del producto');
    await pulsar('Quitar la foto 1 del producto');
    expect(screen.getByLabelText('Quitar la foto 1 del producto')).toBeTruthy();
    expect(screen.queryByLabelText('Quitar la foto 2 del producto')).toBeNull();
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

describe('producto estrella', () => {
  it('se marca con un interruptor y viaja al guardar el menú', async () => {
    await montar();
    await pulsar('Editar Agua de horchata');
    await act(async () => { fireEvent(screen.getByLabelText('Producto estrella'), 'valueChange', true); });
    await pulsar('Guardar producto');
    await pulsar('Guardar menú');
    const productos = mockMutate.mock.calls[0][0].productos;
    expect(productos.map((x: { nombre: string; estrella: boolean }) => [x.nombre, x.estrella])).toEqual([
      ['Taco al pastor', false], ['Agua de horchata', true], ['Revisión', false],
    ]);
  });

  it('un producto que ya es estrella llega con el interruptor encendido', async () => {
    mockSus.mockReturnValue({ suscripcion: { max_fotos: 60, max_productos: 250 }, cargando: false, fallo: false });
    await render(<EditorMenu negocioId="n1" nombreNegocio="Tacos" items={[item('i1', 'Taco', { estrella: true })] as never} />);
    await pulsar('Editar Taco');
    expect(screen.getByLabelText('Producto estrella').props.value).toBe(true);
  });

  it('con 6 estrellas ya en otros productos no se ofrece una séptima: lo dice', async () => {
    const seis = Array.from({ length: 6 }, (_, i) => item(`e${i}`, `Estrella ${i}`, { estrella: true }));
    await render(<EditorMenu negocioId="n1" nombreNegocio="Tacos" items={[...seis, item('x', 'Normal')] as never} />);
    await pulsar('Editar Normal');
    expect(screen.queryByLabelText('Producto estrella')).toBeNull();
    expect(screen.getByText(/hasta 6 productos estrella/)).toBeTruthy();
  });

  it('el que YA es estrella conserva su interruptor aunque haya 6 (se puede quitar)', async () => {
    const seis = Array.from({ length: 6 }, (_, i) => item(`e${i}`, `Estrella ${i}`, { estrella: true }));
    await render(<EditorMenu negocioId="n1" nombreNegocio="Tacos" items={seis as never} />);
    await pulsar('Editar Estrella 0');
    expect(screen.getByLabelText('Producto estrella').props.value).toBe(true);
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

  it('las fotos nuevas de un producto viajan en `fotosNuevas` y las guardadas en `fotos`', async () => {
    await montar();
    await pulsar('Editar Taco al pastor');
    await pulsar('Agregar una foto del producto');
    await pulsar('Guardar producto');
    await pulsar('Guardar menú');
    const taco = mockMutate.mock.calls[0][0].productos[0];
    expect(taco.fotos).toEqual(['negocios/n1/p/a.jpg']);
    expect(taco.fotosNuevas).toHaveLength(1);
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

// Cuervo 360 · el límite REAL del plan, a la vista (0053).
describe('el límite de productos del plan', () => {
  it('el contador dice cuántos llevas del total', async () => {
    mockSus.mockReturnValue({ suscripcion: { max_fotos: 20, max_productos: 80 }, cargando: false, fallo: false });
    await montar();
    expect(screen.getByText('3 de 80 productos')).toBeTruthy();
    expect(screen.getByLabelText('Agregar un producto')).toBeTruthy();
  });

  it('al llegar al límite ya no ofrece agregar y lleva a los planes', async () => {
    mockSus.mockReturnValue({ suscripcion: { max_fotos: 4, max_productos: 3 }, cargando: false, fallo: false });
    await montar();
    expect(screen.queryByLabelText('Agregar un producto')).toBeNull();
    expect(screen.getByText(/Llegaste al límite de tu plan \(3\)/)).toBeTruthy();
    await pulsar('Ver planes para agregar más productos');
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/planes/[rol]', params: { rol: 'comerciante' } });
  });

  it('si aún no se sabe el plan, no inventa un límite: rige la cota técnica', async () => {
    mockSus.mockReturnValue({ suscripcion: null, cargando: true, fallo: false });
    await montar();
    expect(screen.getByText('3 productos')).toBeTruthy();
    expect(screen.queryByText(/Llegaste al límite/)).toBeNull();
  });

  it('un menú con más productos que su plan (bajó de plan) NO se manda y dice cuántos quitar', async () => {
    mockSus.mockReturnValue({ suscripcion: { max_fotos: 4, max_productos: 2 }, cargando: false, fallo: false });
    await montar();
    await pulsar('Guardar menú');
    expect(mockMutate).not.toHaveBeenCalled();
    expect(String(mockError.mock.calls[0][0])).toMatch(/hasta 2 productos.*Quita 1/);
  });
});
