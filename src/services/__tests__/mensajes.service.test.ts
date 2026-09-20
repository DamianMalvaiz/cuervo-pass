// END-22 · El servicio de mensajes. La asercion que justifica este archivo es la
// del CURSOR COMPUESTO (END-20): un mensaje perdido al paginar no es un fallo de
// rendimiento, es la app borrando algo que alguien escribio — y no se ve, porque
// lo que desaparece es justo lo que no estas mirando.

const mockDesde = jest.fn();
const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: { from: (...a: unknown[]) => mockDesde(...a), rpc: (...a: unknown[]) => mockRpc(...a) },
}));

import { abrirConversacion, cursorDe, enviarMensaje, listarMensajes, marcarConversacionComoLeida } from '../mensajes.service';
import type { Mensaje } from '@/types/database.types';

function cadena(resultado: { data?: unknown; error?: unknown }) {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'neq', 'or', 'order', 'limit', 'insert', 'update', 'in']) {
    c[m] = jest.fn(() => c);
  }
  c.single = jest.fn(async () => resultado);
  c.maybeSingle = jest.fn(async () => resultado);
  c.then = (f: (v: unknown) => unknown) => Promise.resolve(resultado).then(f);
  return c;
}

const mensaje = (id: string, creado_en: string): Mensaje =>
  ({ id, conversacion_id: 'c1', remitente_id: 'u1', contenido: 'hola', creado_en, leido: false }) as Mensaje;

beforeEach(() => {
  mockDesde.mockReset();
  mockRpc.mockReset();
});

test('abrir conversacion va por la RPC idempotente', async () => {
  mockRpc.mockResolvedValue({ data: 'conv-1', error: null });
  await expect(abrirConversacion('otro')).resolves.toBe('conv-1');
  expect(mockRpc).toHaveBeenCalledWith('abrir_conversacion', { p_otro: 'otro' });
});

// LA prueba. El cursor era solo `creado_en` con `.lt(...)`: dos mensajes con la
// MISMA marca de tiempo —dos personas escriben a la vez— hacian que uno cayera
// fuera del `<` y no se pidiera nunca.
test('el cursor pagina por el PAR (creado_en, id), no solo por la fecha', async () => {
  const c = cadena({ data: [], error: null });
  mockDesde.mockReturnValue(c);
  await listarMensajes('c1', { creadoEn: '2026-09-20T00:00:00Z', id: 'm5' });
  const [condicion] = (c.or as jest.Mock).mock.calls[0];
  expect(condicion).toContain('creado_en.lt.2026-09-20T00:00:00Z');
  // La segunda mitad es la que rescata al mensaje empatado.
  expect(condicion).toContain('and(creado_en.eq.2026-09-20T00:00:00Z,id.lt.m5)');
});

// Y el ORDEN lleva el mismo desempate que la condicion. Si el orden fuera solo
// por fecha, el corte y el orden discreparian: la pagina siguiente empezaria en
// un sitio que la condicion no previo.
test('el orden desempata por id, igual que la condicion', async () => {
  const c = cadena({ data: [], error: null });
  mockDesde.mockReturnValue(c);
  await listarMensajes('c1');
  const orden = (c.order as jest.Mock).mock.calls;
  expect(orden[0]).toEqual(['creado_en', { ascending: false }]);
  expect(orden[1]).toEqual(['id', { ascending: false }]);
});

test('sin cursor no se manda condicion de rango: es la primera pagina', async () => {
  const c = cadena({ data: [], error: null });
  mockDesde.mockReturnValue(c);
  await listarMensajes('c1');
  expect(c.or).not.toHaveBeenCalled();
});

// La base devuelve del mas nuevo al mas viejo; la pantalla pinta al reves.
test('los mensajes vuelven en orden de lectura, no en el de la consulta', async () => {
  mockDesde.mockReturnValue(
    cadena({ data: [mensaje('m3', '2026-09-20T03:00:00Z'), mensaje('m1', '2026-09-20T01:00:00Z')], error: null })
  );
  const r = await listarMensajes('c1');
  expect(r.map((m) => m.id)).toEqual(['m1', 'm3']);
});

test('cursorDe toma el PRIMERO, que tras invertir es el mas viejo de la pagina', () => {
  const pagina = [mensaje('m1', '2026-09-20T01:00:00Z'), mensaje('m3', '2026-09-20T03:00:00Z')];
  expect(cursorDe(pagina)).toEqual({ creadoEn: '2026-09-20T01:00:00Z', id: 'm1' });
});

test('cursorDe de una pagina vacia es undefined, no un cursor roto', () => {
  expect(cursorDe([])).toBeUndefined();
});

// El trigger trg_mensaje_inmutable (0012) rechaza cualquier otro cambio, asi que
// esta forma exacta de update es la unica que la base acepta desde el cliente.
// Y los tres filtros importan: sin `neq` marcarias como leidos los TUYOS.
test('marcar como leido solo toca mensajes AJENOS y sin leer', async () => {
  const c = cadena({ error: null });
  mockDesde.mockReturnValue(c);
  await marcarConversacionComoLeida('c1', 'yo');
  expect(c.update).toHaveBeenCalledWith({ leido: true });
  expect(c.eq).toHaveBeenCalledWith('conversacion_id', 'c1');
  expect(c.neq).toHaveBeenCalledWith('remitente_id', 'yo');
  expect(c.eq).toHaveBeenCalledWith('leido', false);
});

test('enviar devuelve la fila insertada, que es la que lleva el id real', async () => {
  mockDesde.mockReturnValue(cadena({ data: mensaje('m9', '2026-09-20T09:00:00Z'), error: null }));
  await expect(enviarMensaje('c1', 'u1', 'hola')).resolves.toMatchObject({ id: 'm9' });
});

test('un error al enviar se propaga: el mensaje optimista tiene que poder pintarse en rojo', async () => {
  mockDesde.mockReturnValue(cadena({ data: null, error: { message: 'sin red' } }));
  await expect(enviarMensaje('c1', 'u1', 'hola')).rejects.toMatchObject({ message: 'sin red' });
});
