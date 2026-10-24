import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';

// Código de 6 dígitos por correo · confirmar cuenta y recuperar contraseña.
//
// Lo que esta función tiene que hacer bien no es llamar a `verifyOtp`: es no
// MEZCLAR cuatro estados que la pantalla pinta distinto:
//
//   · `invalido`: el código está mal o venció. Supabase responde lo MISMO para
//     un código equivocado, uno vencido y una cuenta que no existe, y eso es
//     lo correcto: distinguirlos le diría a un atacante qué correos tienen
//     cuenta. La pantalla tampoco debe distinguirlos.
//   · `limite`: demasiados intentos. Hay que esperar, y es información del
//     servicio, no de la cuenta.
//   · `fallo`: no hubo respuesta útil (red, servidor). Un fallo NUNCA se pinta
//     como «código incorrecto»: el usuario volvería a teclear un código bueno.
//   · `ok`: verificado Y con sesión. Sin sesión no es éxito: se falla cerrado.

const mockVerificar = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { verifyOtp: (...a: unknown[]) => mockVerificar(...a) } },
}));

const mockFallo = jest.fn();
jest.mock('@/lib/registro', () => ({ fallo: (...a: unknown[]) => mockFallo(...a) }));

import { LONGITUD_CODIGO, verificarCodigo } from '../codigoCorreo';

const sesion = { access_token: 'a', user: { id: 'u1' } };

beforeEach(() => {
  mockFallo.mockReset();
  mockVerificar.mockReset();
  mockVerificar.mockResolvedValue({ data: { session: sesion, user: sesion.user }, error: null });
});

test('el código tiene seis dígitos, igual que el de Supabase', () => {
  expect(LONGITUD_CODIGO).toBe(6);
});

describe('camino feliz', () => {
  test('confirmar cuenta: llama a verifyOtp con tipo signup y devuelve la sesión', async () => {
    const r = await verificarCodigo('ana@utvtol.edu.mx', '123456', 'signup');
    expect(mockVerificar).toHaveBeenCalledWith({ email: 'ana@utvtol.edu.mx', token: '123456', type: 'signup' });
    expect(r).toEqual({ estado: 'ok', session: sesion });
  });

  test('recuperar contraseña: el tipo recovery llega tal cual', async () => {
    await verificarCodigo('ana@utvtol.edu.mx', '654321', 'recovery');
    expect(mockVerificar).toHaveBeenCalledWith({ email: 'ana@utvtol.edu.mx', token: '654321', type: 'recovery' });
  });

  test('los espacios del correo y del código se ignoran (copiar y pegar los trae)', async () => {
    await verificarCodigo('  ana@utvtol.edu.mx ', ' 123 456 ', 'signup');
    expect(mockVerificar).toHaveBeenCalledWith({ email: 'ana@utvtol.edu.mx', token: '123456', type: 'signup' });
  });
});

describe('un código con forma inválida ni sale del teléfono', () => {
  test.each(['', '12345', '1234567', 'abcdef', '12 34', '12-3456'])('«%s»', async (codigo) => {
    const r = await verificarCodigo('ana@utvtol.edu.mx', codigo, 'signup');
    expect(r).toEqual({ estado: 'invalido' });
    expect(mockVerificar).not.toHaveBeenCalled();
  });
});

describe('cada fallo cae en su estado', () => {
  test('código incorrecto o vencido → invalido', async () => {
    mockVerificar.mockResolvedValue({
      data: { session: null, user: null },
      error: new AuthApiError('Token has expired or is invalid', 403, 'otp_expired'),
    });
    expect(await verificarCodigo('ana@utvtol.edu.mx', '123456', 'signup')).toEqual({ estado: 'invalido' });
  });

  test('una cuenta que no existe da EXACTAMENTE el mismo estado que un código malo', async () => {
    // Supabase responde igual en los dos casos; lo que se fija es que esta
    // función no introduzca por su cuenta una diferencia.
    mockVerificar.mockResolvedValue({
      data: { session: null, user: null },
      error: new AuthApiError('Token has expired or is invalid', 403, 'otp_expired'),
    });
    const conCuenta = await verificarCodigo('ana@utvtol.edu.mx', '123456', 'recovery');
    const sinCuenta = await verificarCodigo('noexiste@utvtol.edu.mx', '123456', 'recovery');
    expect(sinCuenta).toEqual(conCuenta);
  });

  test('demasiados intentos → limite', async () => {
    mockVerificar.mockResolvedValue({
      data: { session: null, user: null },
      error: new AuthApiError('rate limit', 429, 'over_request_rate_limit'),
    });
    expect(await verificarCodigo('ana@utvtol.edu.mx', '123456', 'signup')).toEqual({ estado: 'limite' });
  });

  test('un 429 SIN código (límite del gateway) → limite, no «código incorrecto»', async () => {
    mockVerificar.mockResolvedValue({
      data: { session: null, user: null },
      error: new AuthApiError('Too many requests', 429, undefined),
    });
    expect(await verificarCodigo('ana@utvtol.edu.mx', '123456', 'signup')).toEqual({ estado: 'limite' });
  });

  test.each([
    [403, 'otp_disabled'],
    [422, 'validation_failed'],
    [400, 'email_provider_disabled'],
    [403, undefined],
  ])('un 4xx que no es «código vencido» (%s, %s) → fallo, NUNCA invalido', async (status, code) => {
    // Un ajuste mal puesto del proyecto no es culpa del usuario: decirle «código
    // incorrecto» lo deja reteclando un código bueno sin salida.
    mockVerificar.mockResolvedValue({
      data: { session: null, user: null },
      error: new AuthApiError('otro error', status, code),
    });
    expect(await verificarCodigo('ana@utvtol.edu.mx', '123456', 'signup')).toEqual({ estado: 'fallo' });
  });

  test('sin red (error reintentable de Supabase) → fallo, NUNCA invalido', async () => {
    mockVerificar.mockResolvedValue({
      data: { session: null, user: null },
      error: new AuthRetryableFetchError('Network request failed', 0),
    });
    expect(await verificarCodigo('ana@utvtol.edu.mx', '123456', 'signup')).toEqual({ estado: 'fallo' });
  });

  test('una excepción lanzada → fallo', async () => {
    mockVerificar.mockRejectedValue(new TypeError('Network request failed'));
    expect(await verificarCodigo('ana@utvtol.edu.mx', '123456', 'signup')).toEqual({ estado: 'fallo' });
  });

  test('un 500 del servidor → fallo, no invalido', async () => {
    mockVerificar.mockResolvedValue({
      data: { session: null, user: null },
      error: new AuthApiError('Internal error', 500, 'unexpected_failure'),
    });
    expect(await verificarCodigo('ana@utvtol.edu.mx', '123456', 'signup')).toEqual({ estado: 'fallo' });
  });

  test('verificado pero SIN sesión no es éxito: falla cerrado', async () => {
    mockVerificar.mockResolvedValue({ data: { session: null, user: { id: 'u1' } }, error: null });
    expect(await verificarCodigo('ana@utvtol.edu.mx', '123456', 'signup')).toEqual({ estado: 'fallo' });
  });
});

// Un `fallo` que no deja rastro es indistinguible de una caída de red: si el proyecto de Supabase tiene el OTP
// apagado, la pantalla diría «no pudimos verificar» y nadie sabría por qué hasta el día de la demo.
describe('cada fallo deja rastro en el registro', () => {
  const casos: [string, () => void][] = [
    ['sin red', () => mockVerificar.mockResolvedValue({
      data: { session: null, user: null }, error: new AuthRetryableFetchError('Network request failed', 0),
    })],
    ['un 4xx de configuración', () => mockVerificar.mockResolvedValue({
      data: { session: null, user: null }, error: new AuthApiError('OTP disabled', 403, 'otp_disabled'),
    })],
    ['un 500', () => mockVerificar.mockResolvedValue({
      data: { session: null, user: null }, error: new AuthApiError('Internal error', 500, 'unexpected_failure'),
    })],
    ['una excepción', () => mockVerificar.mockRejectedValue(new TypeError('Network request failed'))],
    ['verificado sin sesión', () => mockVerificar.mockResolvedValue({ data: { session: null, user: { id: 'u1' } }, error: null })],
  ];

  test.each(casos)('%s', async (_nombre, preparar) => {
    preparar();
    expect(await verificarCodigo('ana@utvtol.edu.mx', '123456', 'signup')).toEqual({ estado: 'fallo' });
    expect(mockFallo).toHaveBeenCalledTimes(1);
  });

  test('el 4xx de configuración deja el estado y el código de error para diagnosticar', async () => {
    mockVerificar.mockResolvedValue({
      data: { session: null, user: null }, error: new AuthApiError('OTP disabled', 403, 'otp_disabled'),
    });
    await verificarCodigo('ana@utvtol.edu.mx', '123456', 'signup');
    expect(mockFallo).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ estado: 403, codigo: 'otp_disabled' }),
      expect.anything()
    );
  });

  test('NUNCA registra el código tecleado ni el correo: `registro.ts` no los limpia por clave', async () => {
    mockVerificar.mockRejectedValue(new TypeError('Network request failed'));
    await verificarCodigo('ana@utvtol.edu.mx', '123456', 'signup');
    const volcado = JSON.stringify(mockFallo.mock.calls, (_clave, valor) => (valor instanceof Error ? valor.message : valor));
    expect(volcado).not.toContain('123456');
    expect(volcado).not.toContain('ana@utvtol.edu.mx');
  });

  test.each([
    ['código incorrecto', new AuthApiError('Token has expired or is invalid', 403, 'otp_expired')],
    ['límite de intentos', new AuthApiError('rate limit', 429, 'over_request_rate_limit')],
  ])('%s es culpa de quien teclea, no del sistema: no se registra', async (_nombre, error) => {
    mockVerificar.mockResolvedValue({ data: { session: null, user: null }, error });
    await verificarCodigo('ana@utvtol.edu.mx', '123456', 'signup');
    expect(mockFallo).not.toHaveBeenCalled();
  });
});
