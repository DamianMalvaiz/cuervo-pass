// END-22 · El servicio de mensajes. La asercion que justifica este archivo es la
// del CURSOR COMPUESTO (END-20): un mensaje perdido al paginar no es un fallo de
// rendimiento, es la app borrando algo que alguien escribio — y no se ve, porque
// lo que desaparece es justo lo que no estas mirando.

const mockDesde = jest.fn();
const mockRpc = jest.fn();
const mockCanal = jest.fn();
const mockQuitarCanal = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]) => mockDesde(...a),
    rpc: (...a: unknown[]) => mockRpc(...a),
    channel: (...a: unknown[]) => mockCanal(...a),
    removeChannel: (...a: unknown[]) => mockQuitarCanal(...a),
  },
}));

import {
  abrirConversacion,
  cursorDe,
  enviarMensaje,
  listarConversaciones,
  listarMensajes,
  marcarConversacionComoLeida,
  suscribirseAConversacion,
  suscribirseAMisChats,
} from '../mensajes.service';
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
  mockCanal.mockReset();
  mockQuitarCanal.mockReset();
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


// ── La suscripcion de Realtime ────────────────────────────────────────────────
//
// Esto no se probaba, y es la clase de fallo que no se ve: un canal que no se
// cierra al desmontar no rompe nada visible, solo deja un websocket abierto por
// cada vez que se entro a la pestaña. Con la app abierta media hora son una
// docena de canales recibiendo el mismo evento, y el unico sintoma es que la
// bateria baja mas rapido — nadie lo atribuye nunca a esto.

/**
 * Doble del canal de Supabase: `.on()` se encadena, `.subscribe()` cierra.
 *
 * El tipo va declarado y no inferido porque `on` devuelve el propio canal y eso
 * es una referencia circular: sin la interfaz, tsc falla con TS7022 («'canal'
 * implicitly has type any porque se referencia en su propio inicializador»).
 */
type Escucha = { evento: Record<string, unknown>; cb: () => void };
interface CanalFalso {
  escuchas: Escucha[];
  on: jest.Mock<CanalFalso, [string, Record<string, unknown>, () => void]>;
  subscribe: jest.Mock<CanalFalso, []>;
}

function canalFalso(): CanalFalso {
  const escuchas: Escucha[] = [];
  const canal: CanalFalso = {
    escuchas,
    on: jest.fn((_tipo: string, evento: Record<string, unknown>, cb: () => void) => {
      escuchas.push({ evento, cb });
      return canal;
    }),
    subscribe: jest.fn(() => canal),
  };
  return canal;
}

test('el limpiador que devuelve cierra EL canal que abrio', () => {
  const canal = canalFalso();
  mockCanal.mockReturnValue(canal);

  const desuscribir = suscribirseAMisChats(jest.fn());
  expect(mockQuitarCanal).not.toHaveBeenCalled();

  desuscribir();
  // Con el canal concreto, no con cualquiera: si se cerrara otro, el suyo
  // seguiria abierto y este mismo aserto pasaria con un `toHaveBeenCalled()`.
  expect(mockQuitarCanal).toHaveBeenCalledWith(canal);
});

// Dos eventos y no uno. El INSERT en `mensajes` es el mensaje nuevo; el UPDATE
// en `conversaciones` es el contador de no leidos al marcar como leido. Si
// faltara el segundo, la insignia se quedaria puesta despues de leer el hilo en
// otro dispositivo.
test('escucha el mensaje nuevo Y el cambio de la conversacion', () => {
  const canal = canalFalso();
  mockCanal.mockReturnValue(canal);
  const alCambiar = jest.fn();

  suscribirseAMisChats(alCambiar);

  const tablas = canal.escuchas.map((e: Escucha) => `${e.evento.event}:${e.evento.table}`);
  expect(tablas).toEqual(['INSERT:mensajes', 'UPDATE:conversaciones']);

  // Y las dos avisan al mismo callback: es lo que hace que la lista se
  // invalide venga el cambio por donde venga.
  for (const e of canal.escuchas) e.cb();
  expect(alCambiar).toHaveBeenCalledTimes(2);
});

test('se suscribe de verdad, no solo registra las escuchas', () => {
  const canal = canalFalso();
  mockCanal.mockReturnValue(canal);
  suscribirseAMisChats(jest.fn());
  // Sin `.subscribe()` el canal existe y no recibe nada: fallo mudo perfecto.
  expect(canal.subscribe).toHaveBeenCalled();
});


// ── Errores que se propagan (nunca se vuelven «no hay mensajes») ─────────────────────────────────────────────────────────
// Invariante 2: un fallo de lectura no se pinta como contenido borrado. Si estas funciones tragaran el error, un chat con la red caída se vería vacío.
test('abrir conversación: un error se propaga, no se devuelve un id inventado', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { message: 'no se puede' } });
  await expect(abrirConversacion('otro')).rejects.toMatchObject({ message: 'no se puede' });
});

test('listar mensajes: un error se propaga (un chat con la red caída NO se pinta vacío)', async () => {
  mockDesde.mockReturnValue(cadena({ data: null, error: { message: 'sin red' } }));
  await expect(listarMensajes('c1')).rejects.toMatchObject({ message: 'sin red' });
});

test('marcar como leído: un error se propaga', async () => {
  mockDesde.mockReturnValue(cadena({ data: null, error: { message: 'sin red' } }));
  await expect(marcarConversacionComoLeida('c1', 'yo')).rejects.toMatchObject({ message: 'sin red' });
});

// ── La lista de chats ─────────────────────────────────────────────────────────────────────────────────────────────────
const fila = (extra: Record<string, unknown> = {}) => ({
  conversacion_id: 'c1', otro_usuario_id: 'u2', ultimo_contenido: 'hola', ultimo_creado_en: '2026-10-18T10:00:00Z',
  ultimo_remitente_id: 'u2', ultimo_leido: false, no_leidos: 3, ...extra,
});

describe('listarConversaciones', () => {
  it('pide el resumen por la RPC con el límite, no trae todos los mensajes', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    await listarConversaciones('yo', 12);
    expect(mockRpc).toHaveBeenCalledWith('resumen_conversaciones', { p_limite: 12 });
  });

  it('sin conversaciones no consulta perfiles y devuelve vacío', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    expect(await listarConversaciones('yo')).toEqual([]);
    expect(mockDesde).not.toHaveBeenCalled();
  });

  it('un error de la RPC se propaga', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'sin red' } });
    await expect(listarConversaciones('yo')).rejects.toMatchObject({ message: 'sin red' });
  });

  it('une cada hilo con el perfil PÚBLICO de la otra persona (la vista decide qué columnas)', async () => {
    mockRpc.mockResolvedValue({ data: [fila()], error: null });
    const c = cadena({ data: [{ id: 'u2', nombre_completo: 'Ana Ruiz', foto_url: 'perfiles/u2.jpg' }], error: null });
    mockDesde.mockReturnValue(c);
    const r = await listarConversaciones('yo');
    expect(mockDesde).toHaveBeenCalledWith('perfiles_publicos');
    expect(c.select).toHaveBeenCalledWith('id, nombre_completo, foto_url');
    expect(c.in).toHaveBeenCalledWith('id', ['u2']);
    expect(r).toEqual([{
      conversacionId: 'c1',
      otroUsuario: { id: 'u2', nombre_completo: 'Ana Ruiz', foto_url: 'perfiles/u2.jpg' },
      ultimoMensaje: expect.objectContaining({ contenido: 'hola', remitente_id: 'u2', leido: false, conversacion_id: 'c1' }),
      noLeidos: 3,
    }]);
  });

  it('si la otra persona eliminó su cuenta, lo dice en vez de enseñar una tarjeta en blanco', async () => {
    mockRpc.mockResolvedValue({ data: [fila()], error: null });
    mockDesde.mockReturnValue(cadena({ data: [], error: null }));
    const r = await listarConversaciones('yo');
    expect(r[0].otroUsuario).toEqual({ id: 'u2', nombre_completo: 'Usuario no disponible', foto_url: null });
  });

  it('un hilo sin mensajes tiene ultimoMensaje null (no un mensaje inventado)', async () => {
    mockRpc.mockResolvedValue({ data: [fila({ ultimo_creado_en: null, ultimo_contenido: null, ultimo_remitente_id: null, no_leidos: 0 })], error: null });
    mockDesde.mockReturnValue(cadena({ data: [{ id: 'u2', nombre_completo: 'Ana', foto_url: null }], error: null }));
    const r = await listarConversaciones('yo');
    expect(r[0].ultimoMensaje).toBeNull();
    expect(r[0].noLeidos).toBe(0);
  });

  it('«leído» nulo se lee como no leído', async () => {
    mockRpc.mockResolvedValue({ data: [fila({ ultimo_leido: null })], error: null });
    mockDesde.mockReturnValue(cadena({ data: [{ id: 'u2', nombre_completo: 'Ana', foto_url: null }], error: null }));
    expect((await listarConversaciones('yo'))[0].ultimoMensaje?.leido).toBe(false);
  });

  it('con dos hilos conserva el orden que devolvió la base', async () => {
    mockRpc.mockResolvedValue({ data: [fila({ conversacion_id: 'c9', otro_usuario_id: 'u9' }), fila({ conversacion_id: 'c1', otro_usuario_id: 'u2' })], error: null });
    mockDesde.mockReturnValue(cadena({ data: [{ id: 'u2', nombre_completo: 'Ana', foto_url: null }, { id: 'u9', nombre_completo: 'Beto', foto_url: null }], error: null }));
    const r = await listarConversaciones('yo');
    expect(r.map((x) => x.conversacionId)).toEqual(['c9', 'c1']);
    expect(r.map((x) => x.otroUsuario.nombre_completo)).toEqual(['Beto', 'Ana']);
  });
});

// ── La suscripción a UNA conversación ───────────────────────────────────────────────────────────────────────────────────
describe('suscribirseAConversacion', () => {
  it('abre un canal con nombre propio de ESA conversación y filtra en el servidor', () => {
    const canal = canalFalso();
    mockCanal.mockReturnValue(canal);
    suscribirseAConversacion('c7', jest.fn());
    expect(mockCanal).toHaveBeenCalledWith('conv:c7');
    expect(canal.escuchas.map((e) => `${e.evento.event}:${e.evento.table}:${e.evento.filter}`)).toEqual([
      'INSERT:mensajes:conversacion_id=eq.c7',
      'UPDATE:mensajes:conversacion_id=eq.c7',
    ]);
    expect(canal.subscribe).toHaveBeenCalled();
  });

  it('un INSERT y un UPDATE avisan con el mensaje NUEVO y su tipo (sin el UPDATE el ✓✓ se congela)', () => {
    const canal = canalFalso();
    mockCanal.mockReturnValue(canal);
    const alCambiar = jest.fn();
    suscribirseAConversacion('c7', alCambiar);
    const m = mensaje('m1', '2026-10-18T10:00:00Z');
    (canal.escuchas[0].cb as unknown as (p: unknown) => void)({ new: m });
    (canal.escuchas[1].cb as unknown as (p: unknown) => void)({ new: { ...m, leido: true } });
    expect(alCambiar).toHaveBeenNthCalledWith(1, m, 'INSERT');
    expect(alCambiar).toHaveBeenNthCalledWith(2, { ...m, leido: true }, 'UPDATE');
  });

  it('el limpiador cierra EL canal que abrió', () => {
    const canal = canalFalso();
    mockCanal.mockReturnValue(canal);
    const desuscribir = suscribirseAConversacion('c7', jest.fn());
    expect(mockQuitarCanal).not.toHaveBeenCalled();
    desuscribir();
    expect(mockQuitarCanal).toHaveBeenCalledWith(canal);
  });
});
