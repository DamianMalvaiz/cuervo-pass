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

const VERIF = {
  usuario_id: 'a3b1c2d4-0000-4000-8000-123456789abc', rol: 'comerciante', nombre_usuario: 'ana', nombre_legal: 'Ana Pérez', direccion: 'Calle 1, Toluca',
  enviada_en: '2026-10-20T10:00:00Z', version_aviso: 'v3', fotos_del_lugar: 2, rostro_estado: 'coincide',
};

describe('api.verificaciones', () => {
  test('pide la acción «verificaciones» y devuelve la lista', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { verificaciones: [VERIF] }, error: null });
    const r = await crearApi(clienteCon(invoke)).verificaciones();
    expect(invoke).toHaveBeenCalledWith('admin', { body: { accion: 'verificaciones' } });
    expect(r).toEqual([VERIF]);
  });

  test('una lista vacía es una lista vacía', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { verificaciones: [] }, error: null });
    expect(await crearApi(clienteCon(invoke)).verificaciones()).toEqual([]);
  });

  test.each([
    ['sin la clave', {}],
    ['no es lista', { verificaciones: 'x' }],
    ['un elemento sin nombre legal', { verificaciones: [{ ...VERIF, nombre_legal: undefined }] }],
    ['rol inventado', { verificaciones: [{ ...VERIF, rol: 'dueño' }] }],
    ['fotos que no es número', { verificaciones: [{ ...VERIF, fotos_del_lugar: 'dos' }] }],
  ])('forma rota (%s) → «desconocido»: nunca «no hay pendientes»', async (_n, data) => {
    const invoke = vi.fn().mockResolvedValue({ data, error: null });
    await expect(crearApi(clienteCon(invoke)).verificaciones()).rejects.toMatchObject({ tipo: 'desconocido' });
  });
});

describe('api.documentos', () => {
  test('pide los documentos de ESA persona y ese rol', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { documentos: [{ etiqueta: 'INE (frente)', url: 'https://x.supabase.co/a' }, { etiqueta: 'Foto 1', url: null }] }, error: null });
    const r = await crearApi(clienteCon(invoke), { origenArchivos: 'https://x.supabase.co' }).documentos(VERIF.usuario_id, 'comerciante');
    expect(invoke).toHaveBeenCalledWith('admin', { body: { accion: 'documentos', usuario_id: VERIF.usuario_id, rol: 'comerciante' } });
    expect(r).toHaveLength(2);
    expect(r[0].url).toBe('https://x.supabase.co/a');
    expect(r[1].url).toBeNull();
  });

  test.each([
    'javascript:alert(1)',
    'http://x.supabase.co/a',
    'https://otro.com/a',
    'https://x.supabase.co.atacante.com/a',
    'https://atacante.com/?https://x.supabase.co/a',
    '//x.supabase.co/a',
  ])('una URL que no es de NUESTRO Supabase (%s) se descarta: no se pinta lo que no se puede confiar', async (url) => {
    const invoke = vi.fn().mockResolvedValue({ data: { documentos: [{ etiqueta: 'a', url }] }, error: null });
    const r = await crearApi(clienteCon(invoke), { origenArchivos: 'https://x.supabase.co' }).documentos(VERIF.usuario_id, 'comerciante');
    expect(r.map((d) => d.url)).toEqual([null]);
  });

  test('sin origen configurado no se acepta ninguna URL (falla cerrado)', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { documentos: [{ etiqueta: 'a', url: 'https://x.supabase.co/a' }] }, error: null });
    const r = await crearApi(clienteCon(invoke)).documentos(VERIF.usuario_id, 'comerciante');
    expect(r[0].url).toBeNull();
  });

  test('forma rota → «desconocido»', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { documentos: [{ url: 'https://x' }] }, error: null });
    await expect(crearApi(clienteCon(invoke)).documentos(VERIF.usuario_id, 'comerciante')).rejects.toMatchObject({ tipo: 'desconocido' });
  });
});

describe('api.resolver', () => {
  test('aprobar manda la decisión, sin motivo', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { ok: true }, error: null });
    await crearApi(clienteCon(invoke)).resolver(VERIF.usuario_id, 'comerciante', true, null);
    expect(invoke).toHaveBeenCalledWith('admin', { body: { accion: 'resolver', usuario_id: VERIF.usuario_id, rol: 'comerciante', aprobar: true, motivo: null } });
  });

  test('rechazar manda el motivo', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { ok: true }, error: null });
    await crearApi(clienteCon(invoke)).resolver(VERIF.usuario_id, 'arrendador', false, 'INE ilegible');
    expect(invoke).toHaveBeenCalledWith('admin', { body: expect.objectContaining({ aprobar: false, motivo: 'INE ilegible', rol: 'arrendador' }) });
  });

  test.each([
    [409, 'no_pendiente', 'no_pendiente'],
    [400, 'motivo_requerido', 'motivo_requerido'],
    [403, 'prohibido', 'prohibido'],
  ])('un %i (%s) lanza «%s»', async (status, codigo, tipo) => {
    const invoke = vi.fn().mockResolvedValue(respuestaConError(status, { error: codigo }));
    await expect(crearApi(clienteCon(invoke)).resolver(VERIF.usuario_id, 'comerciante', true, null)).rejects.toMatchObject({ tipo });
  });
});

const ITEM = { tipo: 'resena', id: 'c1', titulo: 'Tacos El Güero · 1 estrellas', texto: 'Mala atención', autor: 'eva', reportes: 2, oculto: false, creado_en: '2026-10-21T10:00:00Z' };
const ENTRADA = { accion: 'aprobar_verificacion', admin: 'ana_admin', objetivo_id: 'u1', objetivo: 'vend_t', detalle: 'comerciante', creado_en: '2026-10-22T10:00:00Z' };

describe('api.moderacion y api.moderar', () => {
  test('moderacion pide la lista y la devuelve', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { moderacion: [ITEM, { ...ITEM, tipo: 'negocio', texto: null }] }, error: null });
    const r = await crearApi(clienteCon(invoke)).moderacion();
    expect(invoke).toHaveBeenCalledWith('admin', { body: { accion: 'moderacion' } });
    expect(r).toHaveLength(2);
  });

  test.each([
    ['sin la clave', {}],
    ['tipo inventado', { moderacion: [{ ...ITEM, tipo: 'usuario' }] }],
    ['reportes que no es número', { moderacion: [{ ...ITEM, reportes: '2' }] }],
    ['oculto que no es booleano', { moderacion: [{ ...ITEM, oculto: 'no' }] }],
    ['autor sin texto', { moderacion: [{ ...ITEM, autor: null }] }],
  ])('forma rota (%s) → «desconocido»', async (_n, data) => {
    const invoke = vi.fn().mockResolvedValue({ data, error: null });
    await expect(crearApi(clienteCon(invoke)).moderacion()).rejects.toMatchObject({ tipo: 'desconocido' });
  });

  test('moderar manda tipo, id, si se oculta y el motivo', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { ok: true }, error: null });
    await crearApi(clienteCon(invoke)).moderar('negocio', 'n1', true, 'Publicidad engañosa');
    expect(invoke).toHaveBeenCalledWith('admin', { body: { accion: 'moderar', tipo: 'negocio', id: 'n1', ocultar: true, motivo: 'Publicidad engañosa' } });
  });

  test('moderar sin motivo suficiente lanza «motivo_requerido» (400 del servidor)', async () => {
    const invoke = vi.fn().mockResolvedValue(respuestaConError(400, { error: 'motivo_requerido' }));
    await expect(crearApi(clienteCon(invoke)).moderar('resena', 'c1', true, null)).rejects.toMatchObject({ tipo: 'motivo_requerido' });
  });
});

describe('api.auditoria', () => {
  test('pide la acción «auditoria» y devuelve las entradas', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { auditoria: [ENTRADA, { ...ENTRADA, objetivo_id: null, objetivo: null, detalle: null }] }, error: null });
    const r = await crearApi(clienteCon(invoke)).auditoria();
    expect(invoke).toHaveBeenCalledWith('admin', { body: { accion: 'auditoria' } });
    expect(r).toHaveLength(2);
  });

  test.each([
    ['sin la clave', {}],
    ['entrada sin acción', { auditoria: [{ ...ENTRADA, accion: undefined }] }],
    ['fecha que no es texto', { auditoria: [{ ...ENTRADA, creado_en: 5 }] }],
    ['admin que no es texto', { auditoria: [{ ...ENTRADA, admin: null }] }],
  ])('forma rota (%s) → «desconocido»', async (_n, data) => {
    const invoke = vi.fn().mockResolvedValue({ data, error: null });
    await expect(crearApi(clienteCon(invoke)).auditoria()).rejects.toMatchObject({ tipo: 'desconocido' });
  });
});
