// Favoritos · Cuervo 360 · migración 0044.
//
// Un favorito es privado (solo su dueña lo lee) y solo se guarda lo visible. Estas pruebas fijan el
// contrato del lado de la app: guardar es idempotente (tocar el corazón dos veces no es un error),
// la lista sale de la VISTA pública (lo oculto desaparece sin filtrarse) y se dice cuántas ya no
// están disponibles en vez de callarlo.

const mockDesde = jest.fn();
const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { from: (...a: unknown[]) => mockDesde(...a), rpc: (...a: unknown[]) => mockRpc(...a) },
}));

import {
  guardarFavorito,
  listarMisFavoritos,
  listarMisFavoritosIds,
  quitarFavorito,
} from '../favoritos.service';

function cadena(resultado: { data?: unknown; error?: unknown }) {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'order', 'insert', 'delete']) c[m] = jest.fn(() => c);
  c.then = (f: (v: unknown) => unknown) => Promise.resolve(resultado).then(f);
  return c;
}

beforeEach(() => mockDesde.mockReset());

describe('listarMisFavoritosIds', () => {
  test('lee solo los de esta cuenta, los más recientes primero', async () => {
    const c = cadena({ data: [{ publicacion_id: 'b' }, { publicacion_id: 'a' }] });
    mockDesde.mockReturnValue(c);
    await expect(listarMisFavoritosIds('u1')).resolves.toEqual(['b', 'a']);
    expect(mockDesde).toHaveBeenCalledWith('favoritos');
    expect(c.eq).toHaveBeenCalledWith('usuario_id', 'u1');
    expect(c.order).toHaveBeenCalledWith('creado_en', { ascending: false });
  });

  // END-11: «falló la lectura» no es «no tienes favoritos».
  test('si la lectura falla, LANZA y no devuelve una lista vacía', async () => {
    mockDesde.mockReturnValue(cadena({ error: { message: 'sin red' } }));
    await expect(listarMisFavoritosIds('u1')).rejects.toMatchObject({ message: 'sin red' });
  });
});

describe('guardarFavorito', () => {
  test('inserta la pareja cuenta-publicación', async () => {
    const c = cadena({ error: null });
    mockDesde.mockReturnValue(c);
    await guardarFavorito('u1', 'p1');
    expect(c.insert).toHaveBeenCalledWith({ usuario_id: 'u1', publicacion_id: 'p1' });
  });

  test('guardar lo que ya estaba guardado NO es un error (idempotente)', async () => {
    mockDesde.mockReturnValue(cadena({ error: { code: '23505', message: 'duplicate key' } }));
    await expect(guardarFavorito('u1', 'p1')).resolves.toBeUndefined();
  });

  test('cualquier otro error se lanza CON su código (CP004 es el tope)', async () => {
    mockDesde.mockReturnValue(cadena({ error: { code: 'CP004', message: 'tope de favoritos alcanzado' } }));
    await expect(guardarFavorito('u1', 'p1')).rejects.toMatchObject({ code: 'CP004' });
  });
});

describe('quitarFavorito', () => {
  test('borra por cuenta y publicación', async () => {
    const c = cadena({ error: null });
    mockDesde.mockReturnValue(c);
    await quitarFavorito('u1', 'p1');
    expect(c.delete).toHaveBeenCalled();
    expect(c.eq).toHaveBeenCalledWith('usuario_id', 'u1');
    expect(c.eq).toHaveBeenCalledWith('publicacion_id', 'p1');
  });

  test('si falla, lanza', async () => {
    mockDesde.mockReturnValue(cadena({ error: { message: 'sin red' } }));
    await expect(quitarFavorito('u1', 'p1')).rejects.toMatchObject({ message: 'sin red' });
  });
});

describe('listarMisFavoritos', () => {
  const pub = (id: string) => ({ id, titulo: `Depa ${id}`, tipo: 'depa', precio_renta: 2500, fotos: [] });

  test('sin favoritos no consulta la vista y no hay nada «no disponible»', async () => {
    mockDesde.mockReturnValueOnce(cadena({ data: [] }));
    await expect(listarMisFavoritos('u1')).resolves.toEqual({ publicaciones: [], noDisponibles: 0 });
    expect(mockDesde).toHaveBeenCalledTimes(1);
  });

  test('lee las publicaciones por la VISTA pública y respeta el orden de guardado', async () => {
    const vista = cadena({ data: [pub('b'), pub('a')] });
    mockDesde
      .mockReturnValueOnce(cadena({ data: [{ publicacion_id: 'a' }, { publicacion_id: 'b' }] }))
      .mockReturnValueOnce(vista);

    const r = await listarMisFavoritos('u1');

    expect(mockDesde).toHaveBeenNthCalledWith(2, 'publicaciones_publicas');
    expect(vista.in).toHaveBeenCalledWith('id', ['a', 'b']);
    expect(r.publicaciones.map((p) => p.id)).toEqual(['a', 'b']);
    expect(r.noDisponibles).toBe(0);
  });

  // Una publicación ya no visible (inactiva u oculta) desaparece de la vista; el favorito sigue
  // en la tabla. Se dice cuántas faltan en vez de callarlo.
  test('cuenta las que ya no están disponibles', async () => {
    mockDesde
      .mockReturnValueOnce(cadena({ data: [{ publicacion_id: 'a' }, { publicacion_id: 'b' }, { publicacion_id: 'c' }] }))
      .mockReturnValueOnce(cadena({ data: [pub('a')] }));
    const r = await listarMisFavoritos('u1');
    expect(r.publicaciones).toHaveLength(1);
    expect(r.noDisponibles).toBe(2);
  });

  test('si falla la lectura de la vista, lanza', async () => {
    mockDesde
      .mockReturnValueOnce(cadena({ data: [{ publicacion_id: 'a' }] }))
      .mockReturnValueOnce(cadena({ error: { message: 'sin red' } }));
    await expect(listarMisFavoritos('u1')).rejects.toMatchObject({ message: 'sin red' });
  });
});

// ── Cuántas personas guardaron una publicación (migración 0045) ─────────────
// Se ve el NÚMERO, nunca quién. La función de la base solo devuelve (id, total).

describe('contarFavoritos', () => {
  test('sin ids no pregunta nada', async () => {
    const { contarFavoritos } = require('../favoritos.service');
    mockRpc.mockClear();
    await expect(contarFavoritos([])).resolves.toEqual(new Map());
    expect(mockRpc).not.toHaveBeenCalled();
  });

  test('pide los conteos por RPC y devuelve un mapa id → total', async () => {
    const { contarFavoritos } = require('../favoritos.service');
    mockRpc.mockResolvedValue({ data: [{ publicacion_id: 'a', total: 3 }, { publicacion_id: 'b', total: 0 }], error: null });
    const mapa = await contarFavoritos(['a', 'b']);
    expect(mockRpc).toHaveBeenCalledWith('favoritos_por_publicacion', { p_ids: ['a', 'b'] });
    expect(mapa.get('a')).toBe(3);
    expect(mapa.get('b')).toBe(0);
  });

  // La función rechaza más de 50 ids por llamada: la lista del dueño puede pasar de 50.
  test('parte la consulta en tandas de 50 y junta los resultados', async () => {
    const { contarFavoritos } = require('../favoritos.service');
    const ids = Array.from({ length: 120 }, (_, i) => `id${i}`);
    mockRpc.mockClear();
    mockRpc.mockImplementation(async (_n: string, { p_ids }: { p_ids: string[] }) => ({
      data: p_ids.map((id) => ({ publicacion_id: id, total: 1 })), error: null,
    }));
    const mapa = await contarFavoritos(ids);
    expect(mockRpc).toHaveBeenCalledTimes(3);
    for (const [, args] of mockRpc.mock.calls) expect(args.p_ids.length).toBeLessThanOrEqual(50);
    expect(mapa.size).toBe(120);
  });

  // END-11: una publicación sin fila NO es «cero»: es «no puedes verla». El mapa no inventa ceros.
  test('una publicación sin fila no aparece en el mapa (no se inventa un 0)', async () => {
    const { contarFavoritos } = require('../favoritos.service');
    mockRpc.mockResolvedValue({ data: [{ publicacion_id: 'a', total: 2 }], error: null });
    const mapa = await contarFavoritos(['a', 'oculta']);
    expect(mapa.has('oculta')).toBe(false);
  });

  test('si falla, lanza', async () => {
    const { contarFavoritos } = require('../favoritos.service');
    mockRpc.mockResolvedValue({ data: null, error: { message: 'sin red' } });
    await expect(contarFavoritos(['a'])).rejects.toMatchObject({ message: 'sin red' });
  });
});
