import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { useChatStore } from '@/store/useChatStore';

// V.4 · La pantalla de chat estaba al 0 % de cobertura.
//
// Los arreglos de END-16, END-19 y END-20 se probaron en `services` y en
// `store`, que es donde vive la lógica pura. Pero lo más frágil del chat no
// está en ninguno de los dos: está en la COSTURA entre la pantalla y el store
// —envío optimista, confirmación, fallo con reintento, dedupe contra el eco de
// Realtime y limpieza al desmontar— y esa costura no tenía una sola prueba.
//
// Cada caso de abajo es un fallo que ya ocurrió o que el código previene a
// propósito. El store va SIN mockear: probar la pantalla contra un store falso
// verificaría que la pantalla llama a funciones, no que el chat funciona.

const mockListarMensajes = jest.fn();
const mockEnviarMensaje = jest.fn();
let alCambiarRealtime: ((m: unknown, e: 'INSERT' | 'UPDATE') => void) | null = null;
const mockDesuscribir = jest.fn();

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ conversacionId: 'c1' }),
}));

jest.mock('@/services/mensajes.service', () => ({
  PAGINA_MENSAJES: 40,
  listarMensajes: (...a: unknown[]) => mockListarMensajes(...a),
  enviarMensaje: (...a: unknown[]) => mockEnviarMensaje(...a),
  marcarConversacionComoLeida: jest.fn().mockResolvedValue(undefined),
  cursorDe: () => ({ creado_en: '2026-09-01T00:00:00Z', id: 'm1' }),
  suscribirseAConversacion: (_id: string, cb: (m: unknown, e: 'INSERT' | 'UPDATE') => void) => {
    alCambiarRealtime = cb;
    return mockDesuscribir;
  },
}));

jest.mock('@/services/usuarios.service', () => ({
  obtenerPerfilPublico: jest.fn().mockResolvedValue({ nombre_completo: 'Beto Prueba' }),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 'c1', usuario_a: 'yo', usuario_b: 'otro' } }) }),
      }),
    }),
  },
}));

jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'yo' } } }),
}));

jest.mock('@/lib/tacto', () => ({ toque: jest.fn(), sello: jest.fn() }));
jest.mock('@/lib/registro', () => ({ aviso: jest.fn(), fallo: jest.fn() }));

import ConversacionScreen from '../[conversacionId]';

const mensajeReal = (id: string, contenido: string, remitente = 'yo') => ({
  id,
  conversacion_id: 'c1',
  remitente_id: remitente,
  contenido,
  leido: false,
  creado_en: '2026-09-20T10:00:00Z',
});

beforeEach(() => {
  jest.clearAllMocks();
  alCambiarRealtime = null;
  useChatStore.setState({ mensajesPorConversacion: {}, ordenDeUso: [] });
  mockListarMensajes.mockResolvedValue([]);
});

// Con este RNTL sobre React 19, `fireEvent` fuera de `act()` NO vacía la cola de
// estado: el `changeText` no llega a `setTexto`, el botón sigue `disabled` y el
// press se descarta en silencio. Costó cuatro pruebas en rojo que parecían
// defectos de la pantalla y eran del arnés. Se envuelve SIEMPRE.
const interactuar = async (fn: () => void) => { await act(async () => { fn(); }); };

/** Monta y espera a que termine la carga inicial. */
async function montar() {
  const utilidades = render(<ConversacionScreen />);
  await waitFor(() => expect(screen.queryByText('CONSULTANDO EL HILO')).toBeNull());
  return utilidades;
}

describe('envío optimista · END-20', () => {
  it('pinta la burbuja ANTES de que el servidor conteste, y vacía el campo', async () => {
    // La promesa se deja colgando a propósito: así se observa el estado
    // intermedio, que es justo lo que el envío optimista existe para pintar.
    let resolver: (m: unknown) => void = () => {};
    mockEnviarMensaje.mockReturnValue(new Promise((r) => { resolver = r; }));

    await montar();
    await interactuar(() => fireEvent.changeText(screen.getByPlaceholderText(/mensaje/i), 'hola'));
    await interactuar(() => fireEvent.press(screen.getByLabelText(/enviar/i)));

    // Sin esperar nada: el mensaje ya está en pantalla.
    expect(screen.getByText('hola')).toBeTruthy();
    expect(screen.getByPlaceholderText(/mensaje/i).props.value).toBe('');

    await act(async () => { resolver(mensajeReal('real1', 'hola')); });
  });

  it('al fallar deja la burbuja marcada y NO devuelve el texto al campo', async () => {
    mockEnviarMensaje.mockRejectedValue(new Error('sin red'));

    await montar();
    await interactuar(() => fireEvent.changeText(screen.getByPlaceholderText(/mensaje/i), 'se cae'));
    await interactuar(() => fireEvent.press(screen.getByLabelText(/enviar/i)));

    // La burbuja se queda en su sitio: devolver el texto al campo se lee como
    // que el mensaje se borró, y la persona ya lo había «mandado».
    expect(screen.getByText('se cae')).toBeTruthy();
    expect(screen.getByPlaceholderText(/mensaje/i).props.value).toBe('');

    const guardados = useChatStore.getState().mensajesPorConversacion.c1;
    expect(guardados).toHaveLength(1);
    expect(guardados[0].envio).toBe('fallido');
  });
});

describe('eco de Realtime · END-19', () => {
  it('no duplica un mensaje propio que ya se confirmó', async () => {
    mockEnviarMensaje.mockResolvedValue(mensajeReal('real1', 'una vez'));

    await montar();
    await interactuar(() => fireEvent.changeText(screen.getByPlaceholderText(/mensaje/i), 'una vez'));
    await interactuar(() => fireEvent.press(screen.getByLabelText(/enviar/i)));

    // El insert propio vuelve por el websocket con el id real.
    await act(async () => { alCambiarRealtime?.(mensajeReal('real1', 'una vez'), 'INSERT'); });

    expect(useChatStore.getState().mensajesPorConversacion.c1).toHaveLength(1);
    expect(screen.getAllByText('una vez')).toHaveLength(1);
  });
});

describe('historial anterior · END-20', () => {
  it('dice que falló en vez de callar, que se leía como «no hay más»', async () => {
    // Página llena para que el botón de «anteriores» exista.
    mockListarMensajes.mockResolvedValueOnce(
      Array.from({ length: 40 }, (_, i) => mensajeReal(`m${i}`, `viejo ${i}`, 'otro'))
    );
    await montar();

    mockListarMensajes.mockRejectedValueOnce(new Error('sin red'));
    await interactuar(() => fireEvent.press(screen.getByLabelText('Cargar mensajes anteriores')));

    expect(screen.getByText(/No pudimos cargar los mensajes anteriores/i)).toBeTruthy();
  });
});

describe('limpieza al desmontar · END-19', () => {
  it('suelta el historial y cancela la suscripción', async () => {
    mockListarMensajes.mockResolvedValueOnce([mensajeReal('m1', 'hola', 'otro')]);
    const { unmount } = await montar();

    expect(useChatStore.getState().mensajesPorConversacion.c1).toBeDefined();

    // También el desmontaje va en `act()`: la limpieza vive en el `return` de un
    // efecto, y sin envolverlo el `delete` del store no se aplica.
    await act(async () => { unmount(); });

    // El store nunca desalojaba nada: veinte chats abiertos dejaban veinte
    // historiales en memoria hasta matar la app.
    expect(useChatStore.getState().mensajesPorConversacion.c1).toBeUndefined();
    expect(mockDesuscribir).toHaveBeenCalled();
  });
});
