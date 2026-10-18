import { useChatStore, type MensajeLocal } from '../useChatStore';
import type { Mensaje } from '@/types/database.types';

// END-19 y END-20 · Cuatro defectos del store, todos silenciosos:
//
//   · Nunca desalojaba conversaciones. Abrir veinte chats en una sesión deja
//     veinte historiales en memoria hasta que se mata la app.
//   · `agregarMensaje` hacía un `.sort()` COMPLETO por cada mensaje entrante.
//     El arreglo ya está ordenado: insertar en su sitio es una búsqueda binaria.
//   · No había forma de representar un mensaje en vuelo, así que el envío no
//     podía ser optimista.
//   · Un envío fallido devolvía el texto al campo, que es peor que no enviarlo:
//     la persona cree que se borró.

const m = (id: string, segundos: number, extra: Partial<Mensaje> = {}): Mensaje => ({
  id,
  conversacion_id: 'c1',
  remitente_id: 'u1',
  contenido: `mensaje ${id}`,
  leido: false,
  creado_en: new Date(Date.UTC(2026, 8, 19, 12, 0, segundos)).toISOString(),
  ...extra,
});

const estado = () => useChatStore.getState();
const mensajesDe = (c: string) => estado().mensajesPorConversacion[c] ?? [];

beforeEach(() => useChatStore.setState({ mensajesPorConversacion: {}, ordenDeUso: [] }));

test('inserta en orden cronologico aunque lleguen desordenados', () => {
  estado().agregarMensaje('c1', m('b', 20));
  estado().agregarMensaje('c1', m('a', 10));
  estado().agregarMensaje('c1', m('c', 30));
  expect(mensajesDe('c1').map((x) => x.id)).toEqual(['a', 'b', 'c']);
});

test('deduplica por id: el eco de Realtime no duplica la burbuja', () => {
  estado().agregarMensaje('c1', m('a', 10));
  estado().agregarMensaje('c1', m('a', 10));
  expect(mensajesDe('c1')).toHaveLength(1);
});

// Dos mensajes con la MISMA marca de tiempo ocurren. El orden entre ellos debe
// ser estable, no depender de en qué orden llegaron por el websocket.
test('dos mensajes con el mismo instante quedan en orden estable por id', () => {
  estado().agregarMensaje('c1', m('b', 10));
  estado().agregarMensaje('c1', m('a', 10));
  expect(mensajesDe('c1').map((x) => x.id)).toEqual(['a', 'b']);
});

test('limpiarConversacion suelta la memoria de ese hilo', () => {
  estado().agregarMensaje('c1', m('a', 10));
  estado().limpiarConversacion('c1');
  expect(estado().mensajesPorConversacion.c1).toBeUndefined();
});

// LA prueba del desalojo. Sin esto, cada chat abierto se queda para siempre.
test('retiene tres conversaciones como maximo, desalojando la mas vieja', () => {
  for (const c of ['c1', 'c2', 'c3', 'c4']) {
    estado().setMensajes(c, [{ ...m('x', 10), conversacion_id: c }]);
  }
  const abiertas = Object.keys(estado().mensajesPorConversacion);
  expect(abiertas).toHaveLength(3);
  expect(abiertas).not.toContain('c1');
  expect(abiertas).toContain('c4');
});

test('usar una conversacion la rescata del desalojo', () => {
  for (const c of ['c1', 'c2', 'c3']) estado().setMensajes(c, []);
  estado().agregarMensaje('c1', m('a', 10));   // c1 vuelve a ser la más reciente
  estado().setMensajes('c4', []);
  const abiertas = Object.keys(estado().mensajesPorConversacion);
  expect(abiertas).toContain('c1');
  expect(abiertas).not.toContain('c2');
});

describe('envío optimista', () => {
  test('un mensaje en vuelo se pinta con estado enviando', () => {
    estado().agregarOptimista('c1', { id: 'temp-1', contenido: 'hola', remitenteId: 'u1' });
    const [uno] = mensajesDe('c1') as MensajeLocal[];
    expect(uno.id).toBe('temp-1');
    expect(uno.envio).toBe('enviando');
    expect(uno.contenido).toBe('hola');
  });

  test('al confirmarse, el temporal se sustituye por el real sin duplicar', () => {
    estado().agregarOptimista('c1', { id: 'temp-1', contenido: 'hola', remitenteId: 'u1' });
    estado().confirmarOptimista('c1', 'temp-1', m('real-1', 10, { contenido: 'hola' }));
    const lista = mensajesDe('c1') as MensajeLocal[];
    expect(lista).toHaveLength(1);
    expect(lista[0].id).toBe('real-1');
    expect(lista[0].envio).toBeUndefined();
  });

  // El texto NO vuelve al campo: la burbuja se queda marcada como fallida y con
  // su reintento. Devolverlo al campo se lee como que el mensaje se borró.
  test('al fallar, la burbuja se queda marcada como fallida', () => {
    estado().agregarOptimista('c1', { id: 'temp-1', contenido: 'hola', remitenteId: 'u1' });
    estado().marcarFallido('c1', 'temp-1');
    const [uno] = mensajesDe('c1') as MensajeLocal[];
    expect(uno.envio).toBe('fallido');
    expect(uno.contenido).toBe('hola');
  });

  test('reintentar vuelve a ponerla en vuelo', () => {
    estado().agregarOptimista('c1', { id: 'temp-1', contenido: 'hola', remitenteId: 'u1' });
    estado().marcarFallido('c1', 'temp-1');
    estado().marcarEnviando('c1', 'temp-1');
    expect((mensajesDe('c1')[0] as MensajeLocal).envio).toBe('enviando');
  });
});

// ── Lo que faltaba cubrir ────────────────────────────────────────────────────────────────────────────────────────────────
// `actualizarMensaje` es el «✓✓» del otro lado: sin él marcar como leído no llega en vivo. Y el eco de Realtime puede llegar ANTES que la respuesta del insert.

describe('actualizarMensaje (UPDATE de Realtime: «leído»)', () => {
  it('reemplaza el mensaje en su sitio, sin mover los demás', () => {
    estado().agregarMensaje('c1', m('a', 10));
    estado().agregarMensaje('c1', m('b', 20));
    estado().actualizarMensaje('c1', m('b', 20, { leido: true }));
    expect(mensajesDe('c1').map((x) => [x.id, x.leido])).toEqual([['a', false], ['b', true]]);
  });

  it('un mensaje que no está cargado NO se inventa (la conversación puede no estar abierta)', () => {
    estado().agregarMensaje('c1', m('a', 10));
    estado().actualizarMensaje('c1', m('zzz', 99, { leido: true }));
    expect(mensajesDe('c1').map((x) => x.id)).toEqual(['a']);
  });

  it('en una conversación sin cargar no hace nada ni crea la entrada', () => {
    estado().actualizarMensaje('otra', m('a', 10));
    expect(estado().mensajesPorConversacion).toEqual({});
  });
});

describe('confirmarOptimista', () => {
  it('cambia el provisional por el real, en el sitio que dice el servidor', () => {
    estado().agregarOptimista('c1', { id: 'tmp', contenido: 'hola', remitenteId: 'u1' });
    estado().confirmarOptimista('c1', 'tmp', m('real', 5));
    expect(mensajesDe('c1').map((x) => x.id)).toEqual(['real']);
  });

  it('si el eco de Realtime llegó ANTES que la respuesta, no queda duplicado: se quita el provisional y se conserva uno', () => {
    estado().agregarOptimista('c1', { id: 'tmp', contenido: 'hola', remitenteId: 'u1' });
    estado().agregarMensaje('c1', m('real', 5)); // el eco
    expect(mensajesDe('c1')).toHaveLength(2);
    estado().confirmarOptimista('c1', 'tmp', m('real', 5));
    expect(mensajesDe('c1').map((x) => x.id)).toEqual(['real']);
  });
});

describe('marcarFallido / marcarEnviando', () => {
  it('un envío fallido queda marcado (la burbuja se pinta en rojo, el texto NO se devuelve al campo)', () => {
    estado().agregarOptimista('c1', { id: 'tmp', contenido: 'hola', remitenteId: 'u1' });
    estado().marcarFallido('c1', 'tmp');
    expect((mensajesDe('c1')[0] as MensajeLocal).envio).toBe('fallido');
    estado().marcarEnviando('c1', 'tmp');
    expect((mensajesDe('c1')[0] as MensajeLocal).envio).toBe('enviando');
  });

  it('marcar un provisional que ya no existe no rompe ni crea nada', () => {
    estado().agregarMensaje('c1', m('a', 10));
    estado().marcarFallido('c1', 'no-existe');
    expect(mensajesDe('c1').map((x) => x.id)).toEqual(['a']);
  });
});
