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
  listarMensajes,
  marcarConversacionComoLeida,
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
