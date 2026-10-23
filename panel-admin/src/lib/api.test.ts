import { describe, expect, test, vi } from 'vitest';

import { crearApi, type ClienteAdmin } from './api';
import { ErrorAdmin } from './errores';

const respuestaConError = (status: number, cuerpo: unknown) => ({
  data: null,
  error: { context: { status, json: async () => cuerpo } },
});

const clienteCon = (invoke: ClienteAdmin['functions']['invoke']): ClienteAdmin => ({ functions: { invoke } });

describe('api.resumen', () => {
  test('llama a la función `admin` con la acción y devuelve el resumen', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { resumen: { cuentas: 3 } }, error: null });
    const r = await crearApi(clienteCon(invoke)).resumen();
    expect(invoke).toHaveBeenCalledWith('admin', { body: { accion: 'resumen' } });
    expect(r).toEqual({ cuentas: 3 });
  });

  test('un 403 lanza «prohibido»: no es admin', async () => {
    const invoke = vi.fn().mockResolvedValue(respuestaConError(403, { error: 'prohibido' }));
    await expect(crearApi(clienteCon(invoke)).resumen()).rejects.toMatchObject({ tipo: 'prohibido' });
  });

  test('sin respuesta (la red) lanza «red», no un resumen vacío', async () => {
    const invoke = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    await expect(crearApi(clienteCon(invoke)).resumen()).rejects.toMatchObject({ tipo: 'red' });
  });

  test('un error sin contexto HTTP es «red»', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: null, error: new Error('x') });
    await expect(crearApi(clienteCon(invoke)).resumen()).rejects.toMatchObject({ tipo: 'red' });
  });

  test.each([null, undefined, 'texto', { resumen: null }, {}])('una respuesta 2xx sin la forma esperada (%p) lanza «desconocido»', async (data) => {
    const invoke = vi.fn().mockResolvedValue({ data, error: null });
    const intento = crearApi(clienteCon(invoke)).resumen();
    await expect(intento).rejects.toBeInstanceOf(ErrorAdmin);
    await expect(intento).rejects.toMatchObject({ tipo: 'desconocido' });
  });
});
