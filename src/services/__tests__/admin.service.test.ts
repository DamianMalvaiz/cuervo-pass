const mockInvoke = jest.fn();
jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => mockInvoke(...a) } } }));

import { ErrorAdmin } from '@/lib/admin';

import { documentosDe, fijarModoDemo, listarModeracion, listarVerificaciones, moderar, obtenerResumen, resolverVerificacion } from '../admin.service';

const UUID = '00000000-0000-0000-0000-0000000000f7';
const httpError = (status: number, cuerpo: unknown) => ({
  message: 'x',
  context: { status, json: async () => cuerpo },
});

beforeEach(() => mockInvoke.mockReset());

describe('el cuerpo que se manda', () => {
  it('resumen', async () => {
    mockInvoke.mockResolvedValue({ data: { resumen: { cuentas: 3 } }, error: null });
    expect(await obtenerResumen()).toEqual({ cuentas: 3 });
    expect(mockInvoke).toHaveBeenCalledWith('admin', { body: { accion: 'resumen' } });
  });

  it('verificaciones y moderación devuelven listas', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { verificaciones: [{ usuario_id: UUID }] }, error: null });
    expect(await listarVerificaciones()).toEqual([{ usuario_id: UUID }]);
    mockInvoke.mockResolvedValueOnce({ data: { moderacion: [] }, error: null });
    expect(await listarModeracion()).toEqual([]);
  });

  it('documentos manda usuario y rol (el admin sale de la sesión, no del cuerpo)', async () => {
    mockInvoke.mockResolvedValue({ data: { documentos: [{ etiqueta: 'INE (frente)', url: 'https://x' }] }, error: null });
    await documentosDe(UUID, 'comerciante');
    expect(mockInvoke).toHaveBeenCalledWith('admin', { body: { accion: 'documentos', usuario_id: UUID, rol: 'comerciante' } });
    const cuerpo = mockInvoke.mock.calls[0][1].body;
    expect(Object.keys(cuerpo)).not.toContain('admin_id');
  });

  it('resolver y moderar', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });
    await resolverVerificacion(UUID, 'arrendador', false, 'La INE no se lee');
    expect(mockInvoke).toHaveBeenLastCalledWith('admin', {
      body: { accion: 'resolver', usuario_id: UUID, rol: 'arrendador', aprobar: false, motivo: 'La INE no se lee' },
    });
    await moderar('resena', UUID, true, 'Insulta');
    expect(mockInvoke).toHaveBeenLastCalledWith('admin', { body: { accion: 'moderar', tipo: 'resena', id: UUID, ocultar: true, motivo: 'Insulta' } });
  });

  it('modo demo devuelve el valor que quedó', async () => {
    mockInvoke.mockResolvedValue({ data: { modo_demo: true }, error: null });
    expect(await fijarModoDemo(true)).toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith('admin', { body: { accion: 'modo_demo', activo: true } });
  });
});

describe('los errores', () => {
  it('un 403 es «prohibido»', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: httpError(403, { error: 'prohibido' }) });
    await expect(obtenerResumen()).rejects.toMatchObject({ tipo: 'prohibido' });
  });

  it('un 409 con «no_pendiente» se lee por su código', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: httpError(409, { error: 'no_pendiente' }) });
    await expect(resolverVerificacion(UUID, 'comerciante', true, null)).rejects.toMatchObject({ tipo: 'no_pendiente' });
  });

  it('sin respuesta HTTP es «red»', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } });
    await expect(obtenerResumen()).rejects.toMatchObject({ tipo: 'red' });
  });

  it('si invoke lanza, también es «red» y nunca se interpreta como éxito', async () => {
    mockInvoke.mockRejectedValue(new Error('boom'));
    await expect(listarVerificaciones()).rejects.toBeInstanceOf(ErrorAdmin);
  });

  it('un cuerpo de error ilegible no tumba la lectura del tipo', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'x', context: { status: 500, json: async () => { throw new Error('no json'); } } } });
    await expect(obtenerResumen()).rejects.toMatchObject({ tipo: 'desconocido' });
  });

  it('una respuesta con forma inesperada NO es éxito', async () => {
    mockInvoke.mockResolvedValue({ data: { algo: 1 }, error: null });
    await expect(listarVerificaciones()).rejects.toMatchObject({ tipo: 'desconocido' });
    await expect(obtenerResumen()).rejects.toMatchObject({ tipo: 'desconocido' });
  });
});
