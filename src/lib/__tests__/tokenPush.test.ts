// Hallazgo 3 · quitar el token push al cerrar sesión (migración 0040).
//
// Si el token se queda ligado a la cuenta que salió, `crear_notificacion_mensaje`
// sigue mandando sus mensajes —con los primeros 100 caracteres— a un teléfono
// que ya usa otra persona.
//
// La regla que importa aquí es la misma que en `registrarTokenPush`: NUNCA
// propaga. Se llama en medio de «Cerrar sesión», y que falle la red no puede
// dejar a la persona sin poder salir.

const mockDesde = jest.fn();
const mockBorrar = jest.fn();
const mockEq = jest.fn();
const mockAviso = jest.fn();

jest.mock('@/lib/supabase', () => ({ supabase: { from: (...a: unknown[]) => mockDesde(...a) } }));
jest.mock('@/lib/registro', () => ({ aviso: (...a: unknown[]) => mockAviso(...a) }));

import { borrarTokenPush } from '@/lib/tokenPush';

beforeEach(() => {
  jest.clearAllMocks();
  mockEq.mockResolvedValue({ error: null });
  mockBorrar.mockReturnValue({ eq: (...a: unknown[]) => mockEq(...a) });
  mockDesde.mockReturnValue({ delete: () => mockBorrar() });
});

test('borra la fila de push_tokens del usuario que sale', async () => {
  await borrarTokenPush('u1');

  expect(mockDesde).toHaveBeenCalledWith('push_tokens');
  expect(mockEq).toHaveBeenCalledWith('usuario_id', 'u1');
});

test('un error de la base se avisa y no se propaga', async () => {
  mockEq.mockResolvedValue({ error: { message: 'sin red' } });

  await expect(borrarTokenPush('u1')).resolves.toBeUndefined();
  expect(mockAviso).toHaveBeenCalledTimes(1);
});

test('una excepción tampoco se propaga', async () => {
  mockEq.mockRejectedValue(new Error('se cayó la red'));

  await expect(borrarTokenPush('u1')).resolves.toBeUndefined();
  expect(mockAviso).toHaveBeenCalledTimes(1);
});
