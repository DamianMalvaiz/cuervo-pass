import { act, renderHook } from '@testing-library/react-native';

// `pushNotifications.ts` estaba al 0 % — el único módulo del proyecto que pide
// un permiso del sistema, escribe en la base y encima navega, sin una sola
// prueba. Se descubrió al ir a cubrir `(tabs)/_layout.tsx`, que es quien lo
// llama: el layout parecía «casi sin lógica» y detrás tenía esto.
//
// Las tres cosas que se fijan aquí, en orden de lo que cuesta si se rompen:
//
//  1. `registrarTokenPush` NUNCA propaga. Se llama desde un `useEffect` sin
//     `.catch()`, así que una excepción sería un rechazo no atendido que en
//     React Native tumba la pestaña entera al montar. El módulo lo atrapa todo
//     por dentro y el comentario del archivo lo promete («nunca bloquea,
//     sección 17»); esto lo convierte en algo comprobable.
//  2. Sin permiso NO se guarda token. Guardar uno igual dejaría una fila en
//     `push_tokens` para alguien que no puede recibir nada: el servidor le
//     manda notificaciones al vacío para siempre.
//  3. El deep link va a `chat/<conversacion_id>`. Con `remitente_id` —que es lo
//     que hacía antes de v5 §26— abría una ruta que ya no existe, y un deep link
//     roto no truena: deja a la persona en una pantalla vacía justo después de
//     haber tocado la notificación. La peor forma de fallar.

const mockCanal = jest.fn();
const mockObtenerPermisos = jest.fn();
const mockPedirPermisos = jest.fn();
const mockObtenerToken = jest.fn();
const mockEscuchar = jest.fn();
const mockQuitar = jest.fn();
const mockDesde = jest.fn();
const mockPush = jest.fn();
const mockAviso = jest.fn();
const mockConstantes: { expoConfig: unknown } = { expoConfig: { extra: { eas: { projectId: 'proj-1' } } } };

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: (...a: unknown[]) => mockCanal(...a),
  getPermissionsAsync: (...a: unknown[]) => mockObtenerPermisos(...a),
  requestPermissionsAsync: (...a: unknown[]) => mockPedirPermisos(...a),
  getExpoPushTokenAsync: (...a: unknown[]) => mockObtenerToken(...a),
  addNotificationResponseReceivedListener: (...a: unknown[]) => mockEscuchar(...a),
  AndroidImportance: { DEFAULT: 3 },
}));
// `__esModule: true` no es adorno: el módulo hace `import Constants from
// 'expo-constants'`, y sin esa marca el interop de Babel le entrega el objeto
// del módulo entero en vez del default. Entonces `Constants.expoConfig` sale
// undefined y `registrarTokenPush` se sale por la rama del projectId que falta
// — con lo que la prueba de «sin projectId avisa» pasaba POR EL MOTIVO
// EQUIVOCADO y la del camino feliz no llegaba nunca a la base.
jest.mock('expo-constants', () => ({
  __esModule: true,
  get default() {
    return mockConstantes;
  },
}));
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/lib/supabase', () => ({ supabase: { from: (...a: unknown[]) => mockDesde(...a) } }));
jest.mock('@/lib/registro', () => ({ aviso: (...a: unknown[]) => mockAviso(...a), fallo: jest.fn() }));

import { registrarTokenPush, useAbrirChatDesdeNotificacion } from '@/lib/pushNotifications';

/** Doble de la cadena de PostgREST: solo hace falta `.upsert()`. */
const tabla = (resultado: { error: unknown } = { error: null }) => {
  const c = { upsert: jest.fn().mockResolvedValue(resultado) };
  return c;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockConstantes.expoConfig = { extra: { eas: { projectId: 'proj-1' } } };
  mockObtenerPermisos.mockResolvedValue({ status: 'granted' });
  mockPedirPermisos.mockResolvedValue({ status: 'granted' });
  mockObtenerToken.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
  mockCanal.mockResolvedValue(undefined);
  mockEscuchar.mockReturnValue({ remove: mockQuitar });
});

// ── registrarTokenPush ───────────────────────────────────────────────────────

test('con permiso, guarda el token bajo el usuario', async () => {
  const t = tabla();
  mockDesde.mockReturnValue(t);

  await registrarTokenPush('u1');

  expect(mockDesde).toHaveBeenCalledWith('push_tokens');
  const [fila, opciones] = t.upsert.mock.calls[0];
  expect(fila).toMatchObject({ usuario_id: 'u1', token: 'ExponentPushToken[abc]' });
  // `onConflict` por usuario: sin él, cambiar de teléfono acumularía filas y el
  // servidor mandaría la misma notificación a un token que ya no existe.
  expect(opciones).toEqual({ onConflict: 'usuario_id' });
});

// Si no lo tiene, lo pide. Este es el orden que importa: pedir permiso sin
// haber consultado antes saca un diálogo del sistema en cada arranque.
test('solo pide permiso si no lo tiene ya', async () => {
  mockDesde.mockReturnValue(tabla());
  await registrarTokenPush('u1');
  expect(mockPedirPermisos).not.toHaveBeenCalled();

  mockObtenerPermisos.mockResolvedValue({ status: 'undetermined' });
  await registrarTokenPush('u1');
  expect(mockPedirPermisos).toHaveBeenCalledTimes(1);
});

// LA prueba del bloque. Una fila en `push_tokens` de alguien que no dio permiso
// es un destino al que el servidor manda notificaciones para siempre sin que
// lleguen nunca.
test('sin permiso NO guarda token y no pide el de Expo', async () => {
  mockObtenerPermisos.mockResolvedValue({ status: 'denied' });
  mockPedirPermisos.mockResolvedValue({ status: 'denied' });
  mockDesde.mockReturnValue(tabla());

  await registrarTokenPush('u1');

  expect(mockObtenerToken).not.toHaveBeenCalled();
  expect(mockDesde).not.toHaveBeenCalled();
});

// Sin `projectId` no hay token posible, y eso se AVISA en vez de fallar mudo:
// es un error de configuración de `app.json`, no del dispositivo, y sin el aviso
// nadie sabría por qué las notificaciones no llegan nunca.
test('sin projectId de EAS avisa y no pide token', async () => {
  mockConstantes.expoConfig = { extra: {} };
  mockDesde.mockReturnValue(tabla());

  await registrarTokenPush('u1');

  expect(mockObtenerToken).not.toHaveBeenCalled();
  expect(mockAviso).toHaveBeenCalledWith(expect.stringContaining('projectId'));
});

// Un error de la base no se traga: se avisa. No se lanza, porque esto no debe
// impedir usar la app — pero sin el aviso nadie sabría que el token no se guardó.
test('un error al guardar se avisa sin lanzar', async () => {
  mockDesde.mockReturnValue(tabla({ error: { message: 'rls lo bloqueó' } }));

  await expect(registrarTokenPush('u1')).resolves.toBeUndefined();
  expect(mockAviso).toHaveBeenCalledWith('No se pudo guardar el token push', undefined, { message: 'rls lo bloqueó' });
});

// LA prueba del archivo. Se llama sin `.catch()` desde un `useEffect`: si
// propagara, sería un rechazo no atendido y en React Native eso tumba la
// pestaña al montar. En Expo Go esto pasa SIEMPRE, no es un caso raro.
test('nunca propaga, aunque todo revolucione', async () => {
  mockObtenerPermisos.mockRejectedValue(new Error('expo go no soporta push'));

  await expect(registrarTokenPush('u1')).resolves.toBeUndefined();
  expect(mockAviso).toHaveBeenCalledWith(
    expect.stringContaining('nunca bloquea'),
    undefined,
    expect.any(Error)
  );
});

test('tampoco propaga si el que revienta es el propio token de Expo', async () => {
  mockObtenerToken.mockRejectedValue(new Error('sin red'));
  await expect(registrarTokenPush('u1')).resolves.toBeUndefined();
});

// ── useAbrirChatDesdeNotificacion ────────────────────────────────────────────

/** Monta el hook y devuelve el callback que registró en el listener. */
const montarEscucha = async () => {
  const vista = await renderHook(() => useAbrirChatDesdeNotificacion());
  const cb = mockEscuchar.mock.calls[0][0] as (r: unknown) => void;
  const notificar = (data: unknown) => cb({ notification: { request: { content: { data } } } });
  return { vista, notificar };
};

test('al tocar una notificación de mensaje abre ESA conversación', async () => {
  const { notificar } = await montarEscucha();
  notificar({ tipo: 'nuevo_mensaje', conversacion_id: 'conv-9' });
  // La ruta es la de la conversación, no la del remitente: con `remitente_id`
  // esto abría una ruta que ya no existe desde v5 §26.
  expect(mockPush).toHaveBeenCalledWith('/chat/conv-9');
});

test('otro tipo de notificación no navega', async () => {
  const { notificar } = await montarEscucha();
  notificar({ tipo: 'otra_cosa', conversacion_id: 'conv-9' });
  expect(mockPush).not.toHaveBeenCalled();
});

// El tipo correcto sin id abriría `/chat/undefined`: una pantalla vacía justo
// después de tocar la notificación.
test('sin conversacion_id no navega a ninguna parte', async () => {
  const { notificar } = await montarEscucha();
  notificar({ tipo: 'nuevo_mensaje' });
  expect(mockPush).not.toHaveBeenCalled();
});

// Verificación de vendedor (0064): al aprobar o rechazar, el servidor manda un aviso; tocarlo lleva a la pantalla de verificación de ESE rol.
test('al tocar el aviso de verificación abre la pantalla de ese rol', async () => {
  const { notificar } = await montarEscucha();
  notificar({ tipo: 'verificacion', rol: 'comerciante' });
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/verificacion/[rol]', params: { rol: 'comerciante' } });
});

test('el aviso de verificación con un rol que no existe no navega (una ruta rota deja la pantalla vacía)', async () => {
  const { notificar } = await montarEscucha();
  notificar({ tipo: 'verificacion', rol: 'admin' });
  notificar({ tipo: 'verificacion' });
  notificar({ tipo: 'verificacion', rol: '../x' });
  expect(mockPush).not.toHaveBeenCalled();
});

test('una notificación sin datos no revienta', async () => {
  const { notificar } = await montarEscucha();
  expect(() => notificar(undefined)).not.toThrow();
  expect(mockPush).not.toHaveBeenCalled();
});

// El mismo limpiador que el del chat, y el mismo riesgo: un listener que no se
// quita deja un `router.push` por cada montaje, así que tocar una notificación
// navegaría varias veces.
test('al desmontar quita el listener', async () => {
  const { vista } = await montarEscucha();
  expect(mockQuitar).not.toHaveBeenCalled();

  await act(async () => {
    vista.unmount();
  });
  expect(mockQuitar).toHaveBeenCalledTimes(1);
});
