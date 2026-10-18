// Reseñas · 0054. Lo público por la vista, lo propio por la tabla, el dueño responde y se reporta por RPC.

const mockDesde = jest.fn();
const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { from: (...a: unknown[]) => mockDesde(...a), rpc: (...a: unknown[]) => mockRpc(...a) },
}));

import {
  borrarMiResena, guardarResena, listarResenas, obtenerCalificacionPublicacion, obtenerMiResena, reportarResena, responderResena,
} from '../resenas.service';

function cadena(resultado: { data?: unknown; error?: unknown }) {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order', 'limit', 'maybeSingle', 'insert', 'update', 'delete']) c[m] = jest.fn(() => c);
  c.then = (f: (v: unknown) => unknown) => Promise.resolve(resultado).then(f);
  return c;
}

beforeEach(() => {
  mockDesde.mockReset();
  mockRpc.mockReset();
});

describe('listarResenas', () => {
  test('lee de la VISTA pública las de un negocio, recientes primero y con tope', async () => {
    const c = cadena({ data: [{ id: 'r1' }] });
    mockDesde.mockReturnValue(c);
    await expect(listarResenas({ negocioId: 'n1' })).resolves.toEqual([{ id: 'r1' }]);
    expect(mockDesde).toHaveBeenCalledWith('resenas_publicas');
    expect(c.eq).toHaveBeenCalledWith('negocio_id', 'n1');
    expect(c.order).toHaveBeenCalledWith('creado_en', { ascending: false });
    expect(c.limit).toHaveBeenCalledWith(50);
    expect((c.select as jest.Mock).mock.calls[0][0]).not.toBe('*');
  });
  test('las de una vivienda filtran por publicación', async () => {
    const c = cadena({ data: [] });
    mockDesde.mockReturnValue(c);
    await listarResenas({ publicacionId: 'p1' });
    expect(c.eq).toHaveBeenCalledWith('publicacion_id', 'p1');
  });
  test('si falla, LANZA y no devuelve una lista vacía', async () => {
    mockDesde.mockReturnValue(cadena({ error: { message: 'sin red' } }));
    await expect(listarResenas({ negocioId: 'n1' })).rejects.toMatchObject({ message: 'sin red' });
  });
});

describe('obtenerMiResena', () => {
  test('lee de la TABLA solo la de esta cuenta sobre este objetivo', async () => {
    const c = cadena({ data: { id: 'r1', estrellas: 4 } });
    mockDesde.mockReturnValue(c);
    await expect(obtenerMiResena('u1', { negocioId: 'n1' })).resolves.toEqual({ id: 'r1', estrellas: 4 });
    expect(mockDesde).toHaveBeenCalledWith('resenas');
    expect(c.eq).toHaveBeenCalledWith('usuario_id', 'u1');
    expect(c.eq).toHaveBeenCalledWith('negocio_id', 'n1');
  });
  test('si nunca reseñó, devuelve null (no es un fallo)', async () => {
    mockDesde.mockReturnValue(cadena({ data: null }));
    await expect(obtenerMiResena('u1', { publicacionId: 'p1' })).resolves.toBeNull();
  });
  test('si falla, LANZA', async () => {
    mockDesde.mockReturnValue(cadena({ error: { message: 'x' } }));
    await expect(obtenerMiResena('u1', { negocioId: 'n1' })).rejects.toBeTruthy();
  });
});

describe('guardarResena', () => {
  test('sin id INSERTA, a nombre propio y con el texto recortado', async () => {
    const c = cadena({ error: null });
    mockDesde.mockReturnValue(c);
    await guardarResena('u1', { negocioId: 'n1' }, { estrellas: 5, texto: '  Muy bueno  ' });
    expect(c.insert).toHaveBeenCalledWith({ usuario_id: 'u1', negocio_id: 'n1', publicacion_id: null, estrellas: 5, texto: 'Muy bueno' });
  });
  test('una reseña de vivienda manda publicacion_id y no negocio_id', async () => {
    const c = cadena({ error: null });
    mockDesde.mockReturnValue(c);
    await guardarResena('u1', { publicacionId: 'p1' }, { estrellas: 3, texto: '' });
    expect(c.insert).toHaveBeenCalledWith({ usuario_id: 'u1', negocio_id: null, publicacion_id: 'p1', estrellas: 3, texto: null });
  });
  test('con id ACTUALIZA solo estrellas y texto', async () => {
    const c = cadena({ error: null });
    mockDesde.mockReturnValue(c);
    await guardarResena('u1', { negocioId: 'n1' }, { id: 'r1', estrellas: 2, texto: 'Regular' });
    expect(c.update).toHaveBeenCalledWith({ estrellas: 2, texto: 'Regular' });
    expect(c.eq).toHaveBeenCalledWith('id', 'r1');
    expect(c.insert).not.toHaveBeenCalled();
  });
  test('NUNCA manda columnas que el cliente no puede escribir', async () => {
    const c = cadena({ error: null });
    mockDesde.mockReturnValue(c);
    await guardarResena('u1', { negocioId: 'n1' }, { estrellas: 5, texto: 'x' });
    const enviado = (c.insert as jest.Mock).mock.calls[0][0];
    for (const prohibida of ['respuesta', 'oculta_por_reportes', 'respondida_en', 'id']) expect(enviado).not.toHaveProperty(prohibida);
  });
  test('un duplicado (23505) y un objetivo no permitido (42501) llegan con su código', async () => {
    mockDesde.mockReturnValue(cadena({ error: { code: '23505', message: 'dup' } }));
    await expect(guardarResena('u1', { negocioId: 'n1' }, { estrellas: 5, texto: '' })).rejects.toMatchObject({ code: '23505' });
    mockDesde.mockReturnValue(cadena({ error: { code: '42501', message: 'rls' } }));
    await expect(guardarResena('u1', { negocioId: 'n1' }, { estrellas: 5, texto: '' })).rejects.toMatchObject({ code: '42501' });
  });
});

describe('borrarMiResena', () => {
  test('borra por id', async () => {
    const c = cadena({ error: null });
    mockDesde.mockReturnValue(c);
    await borrarMiResena('r1');
    expect(c.delete).toHaveBeenCalled();
    expect(c.eq).toHaveBeenCalledWith('id', 'r1');
  });
  test('si falla, LANZA', async () => {
    mockDesde.mockReturnValue(cadena({ error: { message: 'x' } }));
    await expect(borrarMiResena('r1')).rejects.toBeTruthy();
  });
});

describe('responderResena y reportarResena', () => {
  test('responder llama a la RPC con el texto', async () => {
    mockRpc.mockResolvedValue({ error: null });
    await responderResena('r1', 'Gracias');
    expect(mockRpc).toHaveBeenCalledWith('responder_resena', { p_resena: 'r1', p_texto: 'Gracias' });
  });
  test('responder con texto vacío quita la respuesta (lo decide la base)', async () => {
    mockRpc.mockResolvedValue({ error: null });
    await responderResena('r1', '');
    expect(mockRpc).toHaveBeenCalledWith('responder_resena', { p_resena: 'r1', p_texto: '' });
  });
  test('reportar llama a la RPC con el motivo', async () => {
    mockRpc.mockResolvedValue({ error: null });
    await reportarResena('r1', 'spam');
    expect(mockRpc).toHaveBeenCalledWith('reportar_resena', { p_resena: 'r1', p_motivo: 'spam' });
  });
  test('los errores de las RPC se lanzan con su código', async () => {
    mockRpc.mockResolvedValue({ error: { code: '42501', message: 'no' } });
    await expect(responderResena('r1', 'x')).rejects.toMatchObject({ code: '42501' });
    await expect(reportarResena('r1', 'x')).rejects.toMatchObject({ code: '42501' });
  });
});

describe('obtenerCalificacionPublicacion', () => {
  test('lee la calificación CALCULADA de la vivienda', async () => {
    const c = cadena({ data: { calificacion: 4.5, num_resenas: 2 } });
    mockDesde.mockReturnValue(c);
    await expect(obtenerCalificacionPublicacion('p1')).resolves.toEqual({ calificacion: 4.5, num_resenas: 2 });
    expect(mockDesde).toHaveBeenCalledWith('calificacion_publicaciones');
    expect(c.eq).toHaveBeenCalledWith('publicacion_id', 'p1');
  });
  test('sin reseñas devuelve null, no un cero', async () => {
    mockDesde.mockReturnValue(cadena({ data: null }));
    await expect(obtenerCalificacionPublicacion('p1')).resolves.toBeNull();
  });
  test('si falla, LANZA', async () => {
    mockDesde.mockReturnValue(cadena({ error: { message: 'x' } }));
    await expect(obtenerCalificacionPublicacion('p1')).rejects.toBeTruthy();
  });
});
