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

const DETALLE = {
  altas_por_semana: Array.from({ length: 8 }, (_, i) => ({ semana: `2026-09-${String(i + 1).padStart(2, '0')}`, cuentas: i })),
  roles_por_estado: [{ rol: 'comerciante', estado: 'aprobado', total: 4 }],
  publicaciones: { total: 10, activas: 7 },
  negocios: { total: 12, activos: 9 },
  conversaciones: 5,
  mensajes_7d: 30,
};

describe('api.resumenDetalle', () => {
  test('pide la acción «resumen_detalle» y devuelve el detalle', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { detalle: DETALLE }, error: null });
    const r = await crearApi(clienteCon(invoke)).resumenDetalle();
    expect(invoke).toHaveBeenCalledWith('admin', { body: { accion: 'resumen_detalle' } });
    expect(r.publicaciones.activas).toBe(7);
    expect(r.altas_por_semana).toHaveLength(8);
  });

  test.each([
    ['sin detalle', { detalle: null }],
    ['altas que no es lista', { detalle: { ...DETALLE, altas_por_semana: 'x' } }],
    ['una semana sin número de cuentas', { detalle: { ...DETALLE, altas_por_semana: [{ semana: '2026-09-01', cuentas: 'muchas' }] } }],
    ['publicaciones sin activas', { detalle: { ...DETALLE, publicaciones: { total: 1 } } }],
    ['mensajes que no es número', { detalle: { ...DETALLE, mensajes_7d: null } }],
    ['roles con un total que no es número', { detalle: { ...DETALLE, roles_por_estado: [{ rol: 'comerciante', estado: 'aprobado', total: '4' }] } }],
  ])('una respuesta con la forma rota (%s) lanza «desconocido», no cifras inventadas', async (_nombre, data) => {
    const invoke = vi.fn().mockResolvedValue({ data, error: null });
    await expect(crearApi(clienteCon(invoke)).resumenDetalle()).rejects.toMatchObject({ tipo: 'desconocido' });
  });

  test('un 403 lanza «prohibido»', async () => {
    const invoke = vi.fn().mockResolvedValue(respuestaConError(403, { error: 'prohibido' }));
    await expect(crearApi(clienteCon(invoke)).resumenDetalle()).rejects.toMatchObject({ tipo: 'prohibido' });
  });
});
