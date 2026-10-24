// Mi negocio · 0052. El cliente lee lo suyo y escribe por columnas; toda lectura que falla lanza.

const mockDesde = jest.fn();
const mockBorrarFotos = jest.fn();
const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({ supabase: { from: (...a: unknown[]) => mockDesde(...a), rpc: (...a: unknown[]) => mockRpc(...a) } }));
jest.mock('@/lib/storage', () => ({ borrarFotos: (...a: unknown[]) => mockBorrarFotos(...a) }));

import {
  actualizarNegocio, borrarNegocio, crearNegocio, guardarHorario, guardarMenu, listarMisNegocios, obtenerMiNegocio,
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
  mockRpc.mockReset();
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
    const turnos = cadena({ data: [{ dia: 2, abre: '08:00:00', cierra: '14:00:00' }] });
    mockDesde.mockImplementation((t: string) => (t === 'negocios' ? neg : t === 'negocio_horarios' ? turnos : items));
    await expect(obtenerMiNegocio('n1')).resolves.toEqual({
      negocio: { id: 'n1' }, items: [{ id: 'i1' }], turnos: [{ dia: 2, abre: '08:00', cierra: '14:00' }],
    });
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

describe('guardarHorario', () => {
  test('manda los turnos a la función del servidor', async () => {
    mockRpc.mockResolvedValue({ error: null });
    const turnos = [{ dia: 1 as const, abre: '09:00', cierra: '18:00' }];
    await guardarHorario('n1', turnos);
    expect(mockRpc).toHaveBeenCalledWith('guardar_horario', { p_negocio: 'n1', p_turnos: turnos });
  });
  test('si falla, LANZA', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'no' } });
    await expect(guardarHorario('n1', [])).rejects.toMatchObject({ message: 'no' });
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
  const items = [
    { id: 'a', nombre: 'Taco', precio: 20, seccion: 'Tacos', descripcion: null, fotos: [], estrella: false },
    { nombre: 'Agua', precio: null, seccion: null, descripcion: 'Fresca', fotos: ['negocios/n1/p/a.jpg', 'negocios/n1/p/b.jpg'], estrella: true },
  ];

  test('manda el menú ENTERO en una sola llamada a la RPC, en orden', async () => {
    mockRpc.mockResolvedValue({ error: null });
    await guardarMenu('n1', items);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('guardar_menu', { p_negocio: 'n1', p_items: items });
    expect(mockDesde).not.toHaveBeenCalled();
  });

  test('un menú vacío también se manda: así se borra lo que había', async () => {
    mockRpc.mockResolvedValue({ error: null });
    await guardarMenu('n1', []);
    expect(mockRpc).toHaveBeenCalledWith('guardar_menu', { p_negocio: 'n1', p_items: [] });
  });

  test('el tope del plan (CP009) llega con su código', async () => {
    mockRpc.mockResolvedValue({ error: { code: 'CP009', message: 'tope' } });
    await expect(guardarMenu('n1', items)).rejects.toMatchObject({ code: 'CP009' });
  });

  test('cualquier otro error se lanza', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'sin red' } });
    await expect(guardarMenu('n1', items)).rejects.toMatchObject({ message: 'sin red' });
  });
});

describe('borrarNegocio', () => {
  test('borra las fotos de la galería Y las de los productos ANTES de la fila', async () => {
    const items = cadena({ data: [{ foto: 'negocios/n1/p/a.jpg', fotos: ['negocios/n1/p/a.jpg', 'negocios/n1/p/b.jpg'] }, { foto: null, fotos: [] }] });
    const fila = cadena({ error: null });
    const secuencia = [items, fila];
    mockDesde.mockImplementation(() => secuencia.shift());
    await borrarNegocio('n1', ['negocios/n1/a.jpg']);
    // Todas las fotos de cada producto, sin repetir la portada (que es la primera de `fotos`).
    expect(mockBorrarFotos).toHaveBeenCalledWith(['negocios/n1/a.jpg', 'negocios/n1/p/a.jpg', 'negocios/n1/p/b.jpg']);
    expect(mockBorrarFotos.mock.invocationCallOrder[0]).toBeLessThan((fila.delete as jest.Mock).mock.invocationCallOrder[0]);
    expect(fila.eq).toHaveBeenCalledWith('id', 'n1');
  });
  test('si no se pueden leer las fotos de productos, LANZA y no borra nada', async () => {
    mockDesde.mockReturnValue(cadena({ error: { message: 'sin red' } }));
    await expect(borrarNegocio('n1', ['x'])).rejects.toMatchObject({ message: 'sin red' });
    expect(mockBorrarFotos).not.toHaveBeenCalled();
  });
  test('si falla borrar la fila, LANZA', async () => {
    const items = cadena({ data: [] });
    const fila = cadena({ error: { message: 'x' } });
    const secuencia = [items, fila];
    mockDesde.mockImplementation(() => secuencia.shift());
    await expect(borrarNegocio('n1', [])).rejects.toBeTruthy();
  });
});
