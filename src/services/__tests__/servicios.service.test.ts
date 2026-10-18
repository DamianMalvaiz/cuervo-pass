// Servicios · Cuervo 360 · migración 0047.
//
// Los negocios se leen SIEMPRE por las vistas públicas (negocios_publicos, negocio_items_publicos): las tablas
// están cerradas. El filtro de categoría y la búsqueda se aplican en el SERVIDOR (invariante 5), no sobre una página
// ya recortada en el teléfono. Y «falló la lectura» no es «no hay negocios» (invariante 2): se lanza.

const mockDesde = jest.fn();
const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({ supabase: { from: (...a: unknown[]) => mockDesde(...a), rpc: (...a: unknown[]) => mockRpc(...a) } }));

import { listarCategorias, listarNegocios, obtenerNegocio } from '../servicios.service';

function cadena(resultado: { data?: unknown; error?: unknown }) {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'ilike', 'order', 'maybeSingle']) c[m] = jest.fn(() => c);
  c.then = (f: (v: unknown) => unknown) => Promise.resolve(resultado).then(f);
  return c;
}

beforeEach(() => {
  mockDesde.mockReset();
  mockRpc.mockReset();
});

describe('listarCategorias', () => {
  test('lee las categorías en su orden', async () => {
    const c = cadena({ data: [{ id: 'comida', nombre: 'Comida', icono: 'restaurant-outline', orden: 1 }] });
    mockDesde.mockReturnValue(c);
    await expect(listarCategorias()).resolves.toEqual([
      { id: 'comida', nombre: 'Comida', icono: 'restaurant-outline', orden: 1 },
    ]);
    expect(mockDesde).toHaveBeenCalledWith('categorias_servicio');
    expect(c.order).toHaveBeenCalledWith('orden', { ascending: true });
  });

  test('si falla, LANZA', async () => {
    mockDesde.mockReturnValue(cadena({ error: { message: 'sin red' } }));
    await expect(listarCategorias()).rejects.toMatchObject({ message: 'sin red' });
  });
});

describe('listarNegocios', () => {
  test('pide el orden al SERVIDOR (negocios_ordenados), con tope de 100', async () => {
    mockRpc.mockResolvedValue({ data: [{ id: 'n1', puntaje: 0.8 }], error: null });
    await expect(listarNegocios({})).resolves.toEqual([{ id: 'n1', puntaje: 0.8 }]);
    expect(mockRpc).toHaveBeenCalledWith('negocios_ordenados', { p_categoria: null, p_texto: null, p_limite: 100 });
    expect(mockDesde).not.toHaveBeenCalled();
  });

  test('la categoría viaja al servidor', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    await listarNegocios({ categoriaId: 'cafes' });
    expect(mockRpc).toHaveBeenCalledWith('negocios_ordenados', expect.objectContaining({ p_categoria: 'cafes' }));
  });

  test('la búsqueda viaja recortada; el escape de comodines lo hace la base', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    await listarNegocios({ texto: '  50%_a  ' });
    expect(mockRpc).toHaveBeenCalledWith('negocios_ordenados', expect.objectContaining({ p_texto: '50%_a' }));
  });

  test('un texto en blanco no filtra', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    await listarNegocios({ texto: '   ' });
    expect(mockRpc).toHaveBeenCalledWith('negocios_ordenados', expect.objectContaining({ p_texto: null }));
  });

  test('si falla, LANZA y no devuelve una lista vacía', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'sin red' } });
    await expect(listarNegocios({})).rejects.toMatchObject({ message: 'sin red' });
  });
});

describe('obtenerNegocio', () => {
  test('devuelve el negocio con sus productos en orden', async () => {
    const negocio = cadena({ data: { id: 'n1', nombre: 'Café' } });
    const items = cadena({ data: [{ id: 'i1', nombre: 'Americano', precio: 35, orden: 0 }] });
    mockDesde.mockImplementation((t: string) => (t === 'negocios_publicos' ? negocio : items));
    const r = await obtenerNegocio('n1');
    expect(r).toEqual({ negocio: { id: 'n1', nombre: 'Café' }, items: [{ id: 'i1', nombre: 'Americano', precio: 35, orden: 0 }] });
    expect(negocio.eq).toHaveBeenCalledWith('id', 'n1');
    expect(items.eq).toHaveBeenCalledWith('negocio_id', 'n1');
    expect(items.order).toHaveBeenCalledWith('orden', { ascending: true });
  });

  test('un negocio que no existe o no es visible devuelve null (no es un fallo)', async () => {
    mockDesde.mockReturnValue(cadena({ data: null }));
    await expect(obtenerNegocio('x')).resolves.toBeNull();
  });

  test('si falla leer el negocio, LANZA', async () => {
    mockDesde.mockReturnValue(cadena({ error: { message: 'sin red' } }));
    await expect(obtenerNegocio('n1')).rejects.toMatchObject({ message: 'sin red' });
  });

  test('si falla leer los productos, LANZA: no se enseña un menú vacío por un fallo', async () => {
    const negocio = cadena({ data: { id: 'n1' } });
    const items = cadena({ error: { message: 'sin red' } });
    mockDesde.mockImplementation((t: string) => (t === 'negocios_publicos' ? negocio : items));
    await expect(obtenerNegocio('n1')).rejects.toMatchObject({ message: 'sin red' });
  });
});
