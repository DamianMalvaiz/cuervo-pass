// El cableado del registro remoto. Lo que se fija: no envía nada en desarrollo, se inicia una sola vez, manda por la RPC con los nombres correctos, y un
// error del envío no se propaga.

const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }));
let mockSesion: unknown = { user: { id: 'u' } };
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: { getState: () => ({ session: mockSesion }) } }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '9.9.9' } } }));
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));

const cargar = () => {
  jest.resetModules();
  jest.doMock('@/lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }));
  jest.doMock('@/store/useAuthStore', () => ({ useAuthStore: { getState: () => ({ session: mockSesion }) } }));
  const registro = require('@/lib/registro');
  const remoto = require('@/lib/registroRemoto');
  return { ...registro, ...remoto };
};

const conDev = (valor: boolean) => { (globalThis as { __DEV__?: boolean }).__DEV__ = valor; };

beforeEach(() => { mockRpc.mockReset(); mockRpc.mockResolvedValue({ error: null }); mockSesion = { user: { id: 'u' } }; });
afterEach(() => conDev(true));

test('en desarrollo no enchufa nada', () => {
  conDev(true);
  const { iniciarRegistroRemoto, fallo } = cargar();
  iniciarRegistroRemoto();
  fallo('algo falló');
  expect(mockRpc).not.toHaveBeenCalled();
});

test('en producción un error llega a registrar_error_app con versión y plataforma', async () => {
  conDev(false);
  const { iniciarRegistroRemoto, fallo } = cargar();
  iniciarRegistroRemoto();
  fallo('No se pudo cargar', { codigo: 'X' }, new Error('sin red'));
  await Promise.resolve();
  expect(mockRpc).toHaveBeenCalledWith('registrar_error_app', {
    p_nivel: 'error', p_mensaje: 'No se pudo cargar', p_detalle: 'sin red | {"codigo":"X"}', p_version: '9.9.9', p_plataforma: 'android',
  });
});

test('se inicia una sola vez (dos llamadas no duplican los envíos)', async () => {
  conDev(false);
  const { iniciarRegistroRemoto, fallo } = cargar();
  iniciarRegistroRemoto();
  iniciarRegistroRemoto();
  fallo('uno');
  await Promise.resolve();
  expect(mockRpc).toHaveBeenCalledTimes(1);
});

test('sin sesión no envía', async () => {
  conDev(false);
  mockSesion = null;
  const { iniciarRegistroRemoto, fallo } = cargar();
  iniciarRegistroRemoto();
  fallo('antes de entrar');
  await Promise.resolve();
  expect(mockRpc).not.toHaveBeenCalled();
});

test('si la RPC falla no se propaga ni vuelve a registrarse', async () => {
  conDev(false);
  mockRpc.mockResolvedValue({ error: { message: 'cuota' } });
  const { iniciarRegistroRemoto, fallo } = cargar();
  iniciarRegistroRemoto();
  expect(() => fallo('x')).not.toThrow();
  await new Promise((r) => setTimeout(r, 0));
  expect(mockRpc).toHaveBeenCalledTimes(1);
});
