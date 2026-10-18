// Mi negocio · 0052. El cliente lee lo suyo y escribe por columnas; toda lectura que falla lanza.

const mockDesde = jest.fn();
const mockBorrarFotos = jest.fn();
jest.mock('@/lib/supabase', () => ({ supabase: { from: (...a: unknown[]) => mockDesde(...a) } }));
jest.mock('@/lib/storage', () => ({ borrarFotos: (...a: unknown[]) => mockBorrarFotos(...a) }));

import {
  actualizarNegocio, borrarNegocio, crearNegocio, guardarMenu, listarMisNegocios, obtenerMiNegocio,
} from '../negociosPropios.service';

function cadena(resultado: { data?: unknown; error?: unknown }) {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'order', 'insert', 'update', 'delete', 'single', 'maybeSingle']) c[m] = jest.fn(() => c);
  c.then = (f: (v: unknown) => unknown) => Promise.resolve(resultado).then(f);
  return c;
}

const DATOS = {
  categoria_id: 'comida', nombre: 'Tacos', descripcion: null, direccion: 'Calle 1', latitud: null, longitud: null,
  rango_precio: 1, horario: null, activo: true,
};

beforeEach(() => {
  mockDesde.mockReset();
  mockBorrarFotos.mockReset().mockResolvedValue(undefined);
});

describe('listarMisNegocios', () => {
  test('lee solo los de esta cuenta, en orden de creación, con columnas enumeradas', async () => {
    const c = cadena({ data: [{ id: 'n1' }] });
    mockDesde.mockReturnValue(c);
    await expect(listarMisNegocios('u1')).resolves.toEqual([{ id: 'n1' }]);
    expect(mockDesde).toHaveBeenCalledWith('negocios');
    expect(c.eq).toHaveBeenCalledWith('usuario_id', 'u1');
    expect(c.order).toHaveBeenCalledWith('creado_en', { ascending: true });
    expect((c.select as jest.Mock).mock.calls[0][0]).not.toBe('*');
  });
  test('si falla, LANZA', async () => {
    mockDesde.mockReturnValue(cadena({ error: { message: 'sin red' } }));
    await expect(listarMisNegocios('u1')).rejects.toMatchObject({ message: 'sin red' });
  });
});

describe('obtenerMiNegocio', () => {
  test('devuelve el negocio y su menú en orden', async () => {
    const neg = cadena({ data: { id: 'n1' } });
    const items = cadena({ data: [{ id: 'i1' }] });
    mockDesde.mockImplementation((t: string) => (t === 'negocios' ? neg : items));
    await expect(obtenerMiNegocio('n1')).resolves.toEqual({ negocio: { id: 'n1' }, items: [{ id: 'i1' }] });
    expect(items.order).toHaveBeenCalledWith('orden', { ascending: true });
  });
  test('uno que no existe o no es tuyo devuelve null', async () => {
    mockDesde.mockReturnValue(cadena({ data: null }));
    await expect(obtenerMiNegocio('x')).resolves.toBeNull();
  });
  test('si falla leer el menú, LANZA: no se enseña un menú vacío por un fallo', async () => {
    const neg = cadena({ data: { id: 'n1' } });
    const items = cadena({ error: { message: 'sin red' } });
    mockDesde.mockImplementation((t: string) => (t === 'negocios' ? neg : items));
    await expect(obtenerMiNegocio('n1')).rejects.toMatchObject({ message: 'sin red' });
  });
});

describe('crearNegocio', () => {
  test('inserta SIN fotos y con el dueño, y devuelve el id', async () => {
    const c = cadena({ data: { id: 'nuevo' } });
    mockDesde.mockReturnValue(c);
    await expect(crearNegocio('u1', DATOS)).resolves.toBe('nuevo');
    expect(c.insert).toHaveBeenCalledWith({ usuario_id: 'u1', ...DATOS, fotos: [] });
  });
  test('NUNCA manda columnas que el cliente no puede escribir', async () => {
    const c = cadena({ data: { id: 'n' } });
    mockDesde.mockReturnValue(c);
    await crearNegocio('u1', DATOS);
    const enviado = (c.insert as jest.Mock).mock.calls[0][0];
    for (const prohibida of ['destacado', 'origen', 'oculto_por_reportes', 'id']) expect(enviado).not.toHaveProperty(prohibida);
  });
  test('el error conserva su código (CP008 = tope de negocios)', async () => {
    mockDesde.mockReturnValue(cadena({ error: { code: 'CP008', message: 'tope' } }));
    await expect(crearNegocio('u1', DATOS)).rejects.toMatchObject({ code: 'CP008' });
  });
});

describe('actualizarNegocio', () => {
  test('actualiza por id', async () => {
    const c = cadena({ error: null });
    mockDesde.mockReturnValue(c);
    await actualizarNegocio('n1', { nombre: 'Nuevo', fotos: ['negocios/n1/a.jpg'] });
    expect(c.update).toHaveBeenCalledWith({ nombre: 'Nuevo', fotos: ['negocios/n1/a.jpg'] });
    expect(c.eq).toHaveBeenCalledWith('id', 'n1');
  });
  test('si falla, LANZA', async () => {
    mockDesde.mockReturnValue(cadena({ error: { message: 'x' } }));
    await expect(actualizarNegocio('n1', {})).rejects.toBeTruthy();
  });
});

describe('guardarMenu', () => {
  test('borra los que ya no están, actualiza los que siguen con su orden e inserta los nuevos', async () => {
    const lectura = cadena({ data: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] });
    const borrado = cadena({ error: null });
    const update = cadena({ error: null });
    const insert = cadena({ error: null });
    const secuencia = [lectura, borrado, update, insert];
    mockDesde.mockImplementation(() => secuencia.shift());
    await guardarMenu('n1', [{ id: 'b', nombre: 'B2', precio: 10 }, { nombre: 'Nuevo', precio: null }]);
    expect(borrado.delete).toHaveBeenCalled();
    expect(borrado.in).toHaveBeenCalledWith('id', ['a', 'c']);
    expect(update.update).toHaveBeenCalledWith({ nombre: 'B2', precio: 10, orden: 0 });
    expect(update.eq).toHaveBeenCalledWith('id', 'b');
    expect(insert.insert).toHaveBeenCalledWith({ negocio_id: 'n1', nombre: 'Nuevo', precio: null, orden: 1 });
  });
  test('si no sobra ninguno, no hace borrado', async () => {
    const lectura = cadena({ data: [{ id: 'a' }] });
    const update = cadena({ error: null });
    const secuencia = [lectura, update];
    mockDesde.mockImplementation(() => secuencia.shift());
    await guardarMenu('n1', [{ id: 'a', nombre: 'A', precio: 1 }]);
    expect(secuencia).toHaveLength(0);
  });
  test('un fallo al leer el menú actual LANZA y no toca nada', async () => {
    mockDesde.mockReturnValue(cadena({ error: { message: 'sin red' } }));
    await expect(guardarMenu('n1', [])).rejects.toMatchObject({ message: 'sin red' });
    expect(mockDesde).toHaveBeenCalledTimes(1);
  });
  test('el tope de 40 productos (CP009) llega con su código', async () => {
    const lectura = cadena({ data: [] });
    const insert = cadena({ error: { code: 'CP009', message: 'tope' } });
    const secuencia = [lectura, insert];
    mockDesde.mockImplementation(() => secuencia.shift());
    await expect(guardarMenu('n1', [{ nombre: 'X', precio: 1 }])).rejects.toMatchObject({ code: 'CP009' });
  });
});

describe('borrarNegocio', () => {
  test('borra las fotos de Storage ANTES de la fila', async () => {
    const c = cadena({ error: null });
    mockDesde.mockReturnValue(c);
    await borrarNegocio('n1', ['negocios/n1/a.jpg']);
    expect(mockBorrarFotos).toHaveBeenCalledWith(['negocios/n1/a.jpg']);
    expect(mockBorrarFotos.mock.invocationCallOrder[0]).toBeLessThan((c.delete as jest.Mock).mock.invocationCallOrder[0]);
    expect(c.eq).toHaveBeenCalledWith('id', 'n1');
  });
  test('si falla borrar la fila, LANZA', async () => {
    mockDesde.mockReturnValue(cadena({ error: { message: 'x' } }));
    await expect(borrarNegocio('n1', [])).rejects.toBeTruthy();
  });
});
