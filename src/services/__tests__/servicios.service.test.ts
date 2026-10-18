// Servicios · Cuervo 360 · migración 0047.
//
// Los negocios se leen SIEMPRE por las vistas públicas (negocios_publicos, negocio_items_publicos): las tablas
// están cerradas. El filtro de categoría y la búsqueda se aplican en el SERVIDOR (invariante 5), no sobre una página
// ya recortada en el teléfono. Y «falló la lectura» no es «no hay negocios» (invariante 2): se lanza.

const mockDesde = jest.fn();
jest.mock('@/lib/supabase', () => ({ supabase: { from: (...a: unknown[]) => mockDesde(...a) } }));

import { listarCategorias, listarNegocios, obtenerNegocio } from '../servicios.service';

function cadena(resultado: { data?: unknown; error?: unknown }) {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'ilike', 'order', 'maybeSingle']) c[m] = jest.fn(() => c);
  c.then = (f: (v: unknown) => unknown) => Promise.resolve(resultado).then(f);
  return c;
}

beforeEach(() => mockDesde.mockReset());

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
  test('lee de la VISTA pública, destacados primero y luego por nombre', async () => {
    const c = cadena({ data: [] });
    mockDesde.mockReturnValue(c);
    await listarNegocios({});
    expect(mockDesde).toHaveBeenCalledWith('negocios_publicos');
    expect(c.order).toHaveBeenNthCalledWith(1, 'destacado', { ascending: false });
    expect(c.order).toHaveBeenNthCalledWith(2, 'nombre', { ascending: true });
  });

  test('las columnas van enumeradas, sin select *', async () => {
    const c = cadena({ data: [] });
    mockDesde.mockReturnValue(c);
    await listarNegocios({});
    const [columnas] = (c.select as jest.Mock).mock.calls[0];
    expect(columnas).not.toBe('*');
    expect(columnas).toContain('nombre');
    expect(columnas).not.toContain('usuario_id');
  });

  test('la categoría se filtra en el servidor', async () => {
    const c = cadena({ data: [] });
    mockDesde.mockReturnValue(c);
    await listarNegocios({ categoriaId: 'cafes' });
    expect(c.eq).toHaveBeenCalledWith('categoria_id', 'cafes');
  });

  test('sin categoría no filtra por categoría', async () => {
    const c = cadena({ data: [] });
    mockDesde.mockReturnValue(c);
    await listarNegocios({});
    expect(c.eq).not.toHaveBeenCalled();
  });

  test('la búsqueda se filtra en el servidor por nombre, sin importar mayúsculas', async () => {
    const c = cadena({ data: [] });
    mockDesde.mockReturnValue(c);
    await listarNegocios({ texto: '  taco  ' });
    expect(c.ilike).toHaveBeenCalledWith('nombre', '%taco%');
  });

  test('los comodines de LIKE del texto se escapan: «50%» no es «todo»', async () => {
    const c = cadena({ data: [] });
    mockDesde.mockReturnValue(c);
    await listarNegocios({ texto: '50%_a' });
    expect(c.ilike).toHaveBeenCalledWith('nombre', '%50\\%\\_a%');
  });

  test('un texto en blanco no filtra', async () => {
    const c = cadena({ data: [] });
    mockDesde.mockReturnValue(c);
    await listarNegocios({ texto: '   ' });
    expect(c.ilike).not.toHaveBeenCalled();
  });

  test('si falla, LANZA y no devuelve una lista vacía', async () => {
    mockDesde.mockReturnValue(cadena({ error: { message: 'sin red' } }));
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
