// Búsquedas guardadas · 0093. Privadas de la cuenta; lo que vuelve de la base se trata como texto de afuera; un fallo LANZA (no es «no guardaste ninguna»).

const mockDesde = jest.fn();
jest.mock('@/lib/supabase', () => ({ supabase: { from: (...a: unknown[]) => mockDesde(...a) } }));

import { borrarBusqueda, guardarBusqueda, listarBusquedasGuardadas } from '../busquedas.service';

function cadena(resultado: { data?: unknown; error?: unknown }) {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order', 'insert', 'delete']) c[m] = jest.fn(() => c);
  c.then = (f: (v: unknown) => unknown) => Promise.resolve(resultado).then(f);
  return c;
}
beforeEach(() => jest.clearAllMocks());

describe('listarBusquedasGuardadas', () => {
  it('pide solo las columnas que usa, las más recientes primero', async () => {
    const c = cadena({ data: [] });
    mockDesde.mockReturnValue(c);
    await listarBusquedasGuardadas();
    expect(mockDesde).toHaveBeenCalledWith('busquedas_guardadas');
    expect(c.select).toHaveBeenCalledWith('id, nombre, filtros, creado_en');
    expect(c.order).toHaveBeenCalledWith('creado_en', { ascending: false });
  });

  it('se queda solo con los filtros que son texto (lo demás no lo escribe la app)', async () => {
    mockDesde.mockReturnValue(cadena({ data: [{ id: 'b1', nombre: 'Lerma', filtros: { zona: 'Lerma', presupuesto: 4000, tipo: 'cuarto', x: null }, creado_en: 'ayer' }] }));
    const r = await listarBusquedasGuardadas();
    expect(r).toEqual([{ id: 'b1', nombre: 'Lerma', filtros: { zona: 'Lerma', tipo: 'cuarto' }, creado_en: 'ayer' }]);
  });

  it('unos filtros que no son un objeto (una lista, un número) son «sin filtros», no un fallo', async () => {
    mockDesde.mockReturnValue(cadena({ data: [{ id: 'b1', nombre: 'A', filtros: ['zona'], creado_en: 'x' }, { id: 'b2', nombre: 'B', filtros: 7, creado_en: 'x' }] }));
    const r = await listarBusquedasGuardadas();
    expect(r.map((b) => b.filtros)).toEqual([{}, {}]);
  });

  it('sin filas es una lista vacía; un fallo de lectura LANZA (no es «no hay ninguna»)', async () => {
    mockDesde.mockReturnValue(cadena({ data: null }));
    await expect(listarBusquedasGuardadas()).resolves.toEqual([]);
    mockDesde.mockReturnValue(cadena({ error: new Error('sin red') }));
    await expect(listarBusquedasGuardadas()).rejects.toThrow('sin red');
  });
});

describe('guardar y borrar', () => {
  it('guarda a nombre de la cuenta, con nombre y filtros', async () => {
    const c = cadena({});
    mockDesde.mockReturnValue(c);
    await guardarBusqueda('u1', 'Lerma · Cuarto', { zona: 'Lerma' });
    expect(c.insert).toHaveBeenCalledWith({ usuario_id: 'u1', nombre: 'Lerma · Cuarto', filtros: { zona: 'Lerma' } });
  });

  it('un fallo al guardar o al borrar lanza (con el código de la base: el tope es CP004)', async () => {
    mockDesde.mockReturnValue(cadena({ error: { code: 'CP004' } }));
    await expect(guardarBusqueda('u1', 'x', {})).rejects.toMatchObject({ code: 'CP004' });
    mockDesde.mockReturnValue(cadena({ error: new Error('x') }));
    await expect(borrarBusqueda('b1')).rejects.toThrow('x');
  });

  it('borra por id', async () => {
    const c = cadena({});
    mockDesde.mockReturnValue(c);
    await borrarBusqueda('b1');
    expect(c.delete).toHaveBeenCalled();
    expect(c.eq).toHaveBeenCalledWith('id', 'b1');
  });
});
