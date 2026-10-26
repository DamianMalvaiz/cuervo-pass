// Explorar sin cuenta · Cuervo 360 · migración 0090 + Edge Function `fotos-publicas`.
//
// La web se explora sin sesión con datos REDUCIDOS. Lo que se fija aquí: se lee SOLO de las cinco vistas `explorar_*` (nunca de las tablas), las columnas van enumeradas, y un
// fallo se LANZA (END-11): «no se pudo leer» nunca se pinta como «no hay nada». Las fotos vienen de la función, que devuelve URL ya firmadas.

const mockDesde = jest.fn();
const mockInvocar = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { from: (...a: unknown[]) => mockDesde(...a), functions: { invoke: (...a: unknown[]) => mockInvocar(...a) } },
}));

import {
  COLUMNAS_EXPLORAR_NEGOCIO,
  COLUMNAS_EXPLORAR_PUBLICACION,
  fotosPublicas,
  listarCategoriasPublicas,
  listarHorarioPublico,
  listarProductosPublicos,
  listarNegociosPublicos,
  listarPublicacionesPublicas,
  obtenerNegocioPublico,
  obtenerPublicacionPublica,
} from '../explorar.service';

function cadena(resultado: { data?: unknown; error?: unknown }) {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order', 'limit', 'lte', 'maybeSingle']) c[m] = jest.fn(() => c);
  c.then = (f: (v: unknown) => unknown) => Promise.resolve(resultado).then(f);
  return c;
}

beforeEach(() => {
  mockDesde.mockReset();
  mockInvocar.mockReset();
});

describe('columnas', () => {
  it('nunca piden lo que la vista no enseña ni lo sensible', () => {
    for (const col of ['direccion', 'telefono', 'usuario_id', 'latitud', 'longitud', 'fotos', 'descripcion_vivienda', 'vector_embedding']) {
      expect(COLUMNAS_EXPLORAR_PUBLICACION.split(',').map((s) => s.trim())).not.toContain(col);
      expect(COLUMNAS_EXPLORAR_NEGOCIO.split(',').map((s) => s.trim())).not.toContain(col);
    }
  });
});

describe('listarPublicacionesPublicas', () => {
  it('lee de explorar_publicaciones, con columnas enumeradas, las destacadas y nuevas primero', async () => {
    const c = cadena({ data: [{ id: 'a' }] });
    mockDesde.mockReturnValue(c);
    await expect(listarPublicacionesPublicas({ limite: 12 })).resolves.toEqual([{ id: 'a' }]);
    expect(mockDesde).toHaveBeenCalledWith('explorar_publicaciones');
    expect(c.select).toHaveBeenCalledWith(COLUMNAS_EXPLORAR_PUBLICACION);
    expect(c.order).toHaveBeenNthCalledWith(1, 'destacado', { ascending: false });
    expect(c.order).toHaveBeenNthCalledWith(2, 'creado_en', { ascending: false });
    expect(c.limit).toHaveBeenCalledWith(12);
  });

  it('un filtro de precio se aplica en el SERVIDOR (invariante 5)', async () => {
    const c = cadena({ data: [] });
    mockDesde.mockReturnValue(c);
    await listarPublicacionesPublicas({ limite: 30, precioMax: 4000 });
    expect(c.lte).toHaveBeenCalledWith('precio_renta', 4000);
  });

  it('si la lectura falla, LANZA y no devuelve una lista vacía (END-11)', async () => {
    mockDesde.mockReturnValue(cadena({ error: new Error('red') }));
    await expect(listarPublicacionesPublicas({ limite: 5 })).rejects.toThrow('red');
  });
});

describe('obtenerPublicacionPublica', () => {
  it('devuelve null solo cuando NO existe o no es visible; un fallo lanza', async () => {
    mockDesde.mockReturnValueOnce(cadena({ data: null }));
    await expect(obtenerPublicacionPublica('x')).resolves.toBeNull();
    mockDesde.mockReturnValueOnce(cadena({ error: new Error('boom') }));
    await expect(obtenerPublicacionPublica('x')).rejects.toThrow('boom');
  });
});

describe('negocios y categorías', () => {
  it('lee de explorar_negocios y explorar_categorias', async () => {
    const n = cadena({ data: [{ id: 'n1' }] });
    mockDesde.mockReturnValueOnce(n);
    await expect(listarNegociosPublicos({ limite: 8 })).resolves.toEqual([{ id: 'n1' }]);
    expect(mockDesde).toHaveBeenLastCalledWith('explorar_negocios');
    expect(n.select).toHaveBeenCalledWith(COLUMNAS_EXPLORAR_NEGOCIO);

    const k = cadena({ data: [{ id: 'k1' }] });
    mockDesde.mockReturnValueOnce(k);
    await listarCategoriasPublicas();
    expect(mockDesde).toHaveBeenLastCalledWith('explorar_categorias');
    expect(k.order).toHaveBeenCalledWith('orden', { ascending: true });
  });

  it('un negocio por id: null si no existe, lanza si falla', async () => {
    const c = cadena({ data: { id: 'n1' } });
    mockDesde.mockReturnValueOnce(c);
    await expect(obtenerNegocioPublico('n1')).resolves.toEqual({ id: 'n1' });
    expect(c.eq).toHaveBeenCalledWith('id', 'n1');
    mockDesde.mockReturnValueOnce(cadena({ error: new Error('x') }));
    await expect(obtenerNegocioPublico('n1')).rejects.toThrow('x');
  });
});

describe('fotosPublicas', () => {
  it('pide a la función solo tipo e id y devuelve las URL', async () => {
    mockInvocar.mockResolvedValue({ data: { fotos: ['https://f/1'] }, error: null });
    await expect(fotosPublicas('publicacion', 'abc')).resolves.toEqual(['https://f/1']);
    expect(mockInvocar).toHaveBeenCalledWith('fotos-publicas', { body: { tipo: 'publicacion', id: 'abc' } });
  });

  it('si la función falla, LANZA (sin fotos ≠ no se pudieron traer)', async () => {
    mockInvocar.mockResolvedValue({ data: null, error: new Error('500') });
    await expect(fotosPublicas('negocio', 'abc')).rejects.toThrow('500');
  });

  it('una respuesta sin lista de fotos es un fallo, no una galería vacía', async () => {
    mockInvocar.mockResolvedValue({ data: { error: 'x' }, error: null });
    await expect(fotosPublicas('negocio', 'abc')).rejects.toThrow();
  });
});

describe('productos y horario de un negocio', () => {
  it('productos: de explorar_productos, de ESE negocio, estrellas primero y luego por orden', async () => {
    const c = cadena({ data: [{ id: 'i1' }] });
    mockDesde.mockReturnValue(c);
    await expect(listarProductosPublicos('n1')).resolves.toEqual([{ id: 'i1' }]);
    expect(mockDesde).toHaveBeenCalledWith('explorar_productos');
    expect(c.eq).toHaveBeenCalledWith('negocio_id', 'n1');
    expect(c.order).toHaveBeenNthCalledWith(1, 'estrella', { ascending: false });
    expect(c.order).toHaveBeenNthCalledWith(2, 'orden', { ascending: true });
  });

  it('horario: de explorar_horarios, de ESE negocio', async () => {
    const c = cadena({ data: [{ negocio_id: 'n1', dia: 1, abre: '09:00:00', cierra: '18:00:00' }] });
    mockDesde.mockReturnValue(c);
    await expect(listarHorarioPublico('n1')).resolves.toHaveLength(1);
    expect(mockDesde).toHaveBeenCalledWith('explorar_horarios');
    expect(c.eq).toHaveBeenCalledWith('negocio_id', 'n1');
  });

  it('si fallan, LANZAN (un menú que no cargó no es un menú vacío)', async () => {
    mockDesde.mockReturnValueOnce(cadena({ error: new Error('a') }));
    await expect(listarProductosPublicos('n1')).rejects.toThrow('a');
    mockDesde.mockReturnValueOnce(cadena({ error: new Error('b') }));
    await expect(listarHorarioPublico('n1')).rejects.toThrow('b');
  });
});
