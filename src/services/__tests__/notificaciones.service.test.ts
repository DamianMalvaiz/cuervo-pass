// Centro de avisos · 0072. Lo que se fija: el filtro de mensajes va al SERVIDOR, el conteo no confunde fallo con cero, y marcar solo toca `leida`.

const mockDesde = jest.fn();
jest.mock('@/lib/supabase', () => ({ supabase: { from: (...a: unknown[]) => mockDesde(...a) } }));

import { contarAvisosNoLeidos, LIMITE_AVISOS, listarAvisos, marcarAvisoLeido, marcarTodosLeidos } from '../notificaciones.service';

function cadena(resultado: { data?: unknown; error?: unknown; count?: number | null }) {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'neq', 'eq', 'order', 'limit', 'update']) c[m] = jest.fn(() => c);
  c.then = (f: (v: unknown) => unknown) => Promise.resolve(resultado).then(f);
  return c;
}

beforeEach(() => mockDesde.mockReset());

describe('listarAvisos', () => {
  test('pide al servidor sin mensajes, recientes primero y con tope', async () => {
    const c = cadena({ data: [{ id: 'a1' }] });
    mockDesde.mockReturnValue(c);
    await expect(listarAvisos()).resolves.toEqual([{ id: 'a1' }]);
    expect(mockDesde).toHaveBeenCalledWith('notificaciones');
    expect(c.neq).toHaveBeenCalledWith('tipo', 'nuevo_mensaje');
    expect(c.order).toHaveBeenCalledWith('creado_en', { ascending: false });
    expect(c.limit).toHaveBeenCalledWith(LIMITE_AVISOS);
  });
  test('si falla, LANZA y no devuelve una lista vacía', async () => {
    mockDesde.mockReturnValue(cadena({ error: { message: 'sin red' } }));
    await expect(listarAvisos()).rejects.toMatchObject({ message: 'sin red' });
  });
});

describe('contarAvisosNoLeidos', () => {
  test('cuenta solo lo no leído y sin mensajes', async () => {
    const c = cadena({ count: 3 });
    mockDesde.mockReturnValue(c);
    await expect(contarAvisosNoLeidos()).resolves.toBe(3);
    expect(c.select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
    expect(c.eq).toHaveBeenCalledWith('leida', false);
    expect(c.neq).toHaveBeenCalledWith('tipo', 'nuevo_mensaje');
  });
  test('si falla, LANZA (no se convierte en «0 sin leer»)', async () => {
    mockDesde.mockReturnValue(cadena({ error: { message: 'x' } }));
    await expect(contarAvisosNoLeidos()).rejects.toMatchObject({ message: 'x' });
  });
});

describe('marcar', () => {
  test('uno: solo escribe `leida`', async () => {
    const c = cadena({});
    mockDesde.mockReturnValue(c);
    await marcarAvisoLeido('a1');
    expect(c.update).toHaveBeenCalledWith({ leida: true });
    expect(c.eq).toHaveBeenCalledWith('id', 'a1');
  });
  test('todos: solo los no leídos del centro', async () => {
    const c = cadena({});
    mockDesde.mockReturnValue(c);
    await marcarTodosLeidos();
    expect(c.update).toHaveBeenCalledWith({ leida: true });
    expect(c.eq).toHaveBeenCalledWith('leida', false);
    expect(c.neq).toHaveBeenCalledWith('tipo', 'nuevo_mensaje');
  });
  test('si falla, LANZA', async () => {
    mockDesde.mockReturnValue(cadena({ error: { message: 'no' } }));
    await expect(marcarAvisoLeido('a1')).rejects.toMatchObject({ message: 'no' });
    await expect(marcarTodosLeidos()).rejects.toMatchObject({ message: 'no' });
  });
});
