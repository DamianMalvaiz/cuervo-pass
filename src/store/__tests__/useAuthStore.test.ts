// Hallazgo 3 (revisión del 15/10/2026) · Al cerrar sesión no se limpiaba nada.
//
// `cerrarSesion` solo llamaba a `signOut`. La caché de TanStack Query y los
// stores de Zustand viven en memoria del proceso, así que quien iniciaba sesión
// después en el mismo teléfono veía un instante los datos personalizados del
// anterior —sugerencias, roomies, su perfil—. Las claves de varias consultas
// ni siquiera llevan el id de usuario.
//
// Estas pruebas fijan lo que SÍ debe pasar: salir deja la memoria como si la app
// acabara de abrirse.

const mockSignOut = jest.fn();
const mockOnAuthStateChange = jest.fn();
const mockBorrarToken = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: () => mockSignOut(),
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: (cb: unknown) => mockOnAuthStateChange(cb),
    },
  },
}));

jest.mock('@/lib/tokenPush', () => ({
  borrarTokenPush: (...a: unknown[]) => mockBorrarToken(...a),
}));

import { useChatStore } from '../useChatStore';
import { useAuthStore, alCerrarSesion } from '../useAuthStore';
import { usePerfilStore } from '../usePerfilStore';

const PERFIL = { id: 'u1', nombre_usuario: 'ana', presupuesto_max: 4000 } as never;

function sembrarDatosDeAna() {
  useAuthStore.setState({ session: { user: { id: 'u1' } } as never, cargando: false });
  usePerfilStore.setState({ perfil: PERFIL, error: 'x', cargando: false });
  useChatStore.setState({
    mensajesPorConversacion: { c1: [{ id: 'm1' } as never] },
    ordenDeUso: ['c1'],
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSignOut.mockResolvedValue({ error: null });
  mockBorrarToken.mockResolvedValue(undefined);
  mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
  useAuthStore.getState().detenerEscuchaSesion();
});

test('cerrar sesión borra el perfil del usuario anterior', async () => {
  sembrarDatosDeAna();
  await useAuthStore.getState().cerrarSesion();

  expect(usePerfilStore.getState().perfil).toBeNull();
  expect(usePerfilStore.getState().error).toBeNull();
  expect(useAuthStore.getState().session).toBeNull();
});

test('cerrar sesión borra los mensajes en memoria', async () => {
  sembrarDatosDeAna();
  await useAuthStore.getState().cerrarSesion();

  expect(useChatStore.getState().mensajesPorConversacion).toEqual({});
  expect(useChatStore.getState().ordenDeUso).toEqual([]);
});

test('cerrar sesión avisa a quien guarda caché para que la vacíe', async () => {
  const vaciarCache = jest.fn();
  const quitar = alCerrarSesion(vaciarCache);

  await useAuthStore.getState().cerrarSesion();
  expect(vaciarCache).toHaveBeenCalledTimes(1);

  quitar();
  await useAuthStore.getState().cerrarSesion();
  expect(vaciarCache).toHaveBeenCalledTimes(1);
});

test('si signOut falla, la memoria se limpia igual', async () => {
  sembrarDatosDeAna();
  mockSignOut.mockRejectedValue(new Error('sin red'));

  await expect(useAuthStore.getState().cerrarSesion()).rejects.toThrow('sin red');

  expect(usePerfilStore.getState().perfil).toBeNull();
  expect(useChatStore.getState().mensajesPorConversacion).toEqual({});
});

// La sesión puede terminar sin que la persona toque «Cerrar sesión»: el token se
// revoca desde otro dispositivo o caduca sin refresco. Ese camino pasa por el
// listener, no por `cerrarSesion`, y dejaba la misma memoria sucia.
test('si la sesión termina por el listener (SIGNED_OUT) también se limpia', async () => {
  const vaciarCache = jest.fn();
  const quitar = alCerrarSesion(vaciarCache);
  sembrarDatosDeAna();

  await useAuthStore.getState().cargarSesionInicial();
  const listener = mockOnAuthStateChange.mock.calls[0][0] as (e: string, s: unknown) => void;
  listener('SIGNED_OUT', null);

  expect(vaciarCache).toHaveBeenCalledTimes(1);
  expect(usePerfilStore.getState().perfil).toBeNull();
  expect(useAuthStore.getState().session).toBeNull();
  quitar();
});

test('un TOKEN_REFRESHED no borra nada', async () => {
  const vaciarCache = jest.fn();
  const quitar = alCerrarSesion(vaciarCache);
  sembrarDatosDeAna();

  await useAuthStore.getState().cargarSesionInicial();
  const listener = mockOnAuthStateChange.mock.calls[0][0] as (e: string, s: unknown) => void;
  listener('TOKEN_REFRESHED', { user: { id: 'u1' } });

  expect(vaciarCache).not.toHaveBeenCalled();
  expect(usePerfilStore.getState().perfil).toEqual(PERFIL);
  quitar();
});

// ── token push ─────────────────────────────────────────────────────────────
// Migración 0040. El borrado tiene que ir ANTES de `signOut`: la policy compara
// contra auth.uid() y sin sesión ya no hay dueño de la fila.
test('cerrar sesión borra el token push de quien sale, ANTES de signOut', async () => {
  const orden: string[] = [];
  mockBorrarToken.mockImplementation(async () => {
    orden.push('borrar');
  });
  mockSignOut.mockImplementation(async () => {
    orden.push('signOut');
    return { error: null };
  });
  sembrarDatosDeAna();

  await useAuthStore.getState().cerrarSesion();

  expect(mockBorrarToken).toHaveBeenCalledWith('u1');
  expect(orden).toEqual(['borrar', 'signOut']);
});

test('sin sesión no intenta borrar ningún token', async () => {
  useAuthStore.setState({ session: null, cargando: false });

  await useAuthStore.getState().cerrarSesion();

  expect(mockBorrarToken).not.toHaveBeenCalled();
  expect(mockSignOut).toHaveBeenCalledTimes(1);
});

test('si borrar el token revienta, la persona sale igual', async () => {
  mockBorrarToken.mockRejectedValue(new Error('se cayó la red'));
  sembrarDatosDeAna();

  await useAuthStore.getState().cerrarSesion();

  expect(mockSignOut).toHaveBeenCalledTimes(1);
  expect(useAuthStore.getState().session).toBeNull();
  expect(usePerfilStore.getState().perfil).toBeNull();
});

// Sin red, una petición de supabase-js puede quedarse colgada mucho tiempo. El
// botón «Cerrar sesión» no puede esperarla.
test('si borrar el token se cuelga, el cierre no espera para siempre', async () => {
  jest.useFakeTimers();
  try {
    mockBorrarToken.mockReturnValue(new Promise(() => {}));
    sembrarDatosDeAna();

    const cierre = useAuthStore.getState().cerrarSesion();
    await jest.advanceTimersByTimeAsync(10_000);
    await cierre;

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().session).toBeNull();
  } finally {
    jest.useRealTimers();
  }
});
