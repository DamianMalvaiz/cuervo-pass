import { isAuthApiError, isAuthRetryableFetchError, type Session } from '@supabase/supabase-js';

import { fallo } from '@/lib/registro';
import { supabase } from '@/lib/supabase';

/** Longitud del código de Supabase Auth (`otp_length`, 6 por defecto). Si cambia en el panel, cambia aquí. */
export const LONGITUD_CODIGO = 6;

/** Cada estado que no es `ok` se pinta con su propio texto: un fallo de red NUNCA se dice «código incorrecto». */
export const MENSAJE_CODIGO = {
  invalido: 'Código incorrecto o vencido. Revísalo o pide uno nuevo.',
  limite: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  fallo: 'No pudimos verificar el código. Revisa tu conexión e inténtalo de nuevo.',
} as const;

export type ResultadoCodigo =
  | { estado: 'ok'; session: Session }
  /** Incorrecto o vencido. Supabase los responde igual, y igual que una cuenta inexistente: no se distinguen. */
  | { estado: 'invalido' }
  | { estado: 'limite' }
  /** Sin respuesta útil (red, servidor, o verificado sin sesión). Nunca se pinta como «código incorrecto». */
  | { estado: 'fallo' };

const CODIGOS_DE_LIMITE = new Set(['over_request_rate_limit', 'over_email_send_rate_limit']);
const FORMA_DEL_CODIGO = new RegExp(`^\\d{${LONGITUD_CODIGO}}$`);

// Un `fallo` sin rastro es indistinguible de una caída de red. Nunca se pasa el código ni el correo: `registro.ts`
// limpia por clave y no conoce `token` ni `codigo`.
function falloRegistrado(datos: Record<string, unknown>, error?: unknown): ResultadoCodigo {
  fallo('No se pudo verificar el código de correo', datos, error);
  return { estado: 'fallo' };
}

/**
 * Verifica el código que llegó por correo. `signup` confirma la cuenta; `recovery` abre la sesión con la que se
 * cambia la contraseña. Un código con forma inválida no sale del teléfono.
 */
export async function verificarCodigo(
  email: string,
  codigo: string,
  tipo: 'signup' | 'recovery'
): Promise<ResultadoCodigo> {
  const token = codigo.replace(/\s/g, '');
  if (!FORMA_DEL_CODIGO.test(token)) return { estado: 'invalido' };

  try {
    const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: tipo });
    if (error) {
      if (isAuthRetryableFetchError(error)) return falloRegistrado({ motivo: 'red' }, error);
      if (isAuthApiError(error)) {
        // Un 429 puede venir sin `code` (límite del gateway): sigue siendo un límite, no un código malo.
        if (error.status === 429 || (error.code && CODIGOS_DE_LIMITE.has(error.code))) return { estado: 'limite' };
        // Solo `otp_expired` es «código incorrecto o vencido». Cualquier otro 4xx (OTP desactivado, validación,
        // proveedor apagado) es un ajuste del proyecto, no un error de quien teclea.
        if (error.code === 'otp_expired') return { estado: 'invalido' };
        return falloRegistrado({ motivo: 'api', estado: error.status, codigo: error.code }, error);
      }
      return falloRegistrado({ motivo: 'desconocido' }, error);
    }
    // Verificado sin sesión no es éxito: quien llama necesita la sesión para seguir.
    return data.session ? { estado: 'ok', session: data.session } : falloRegistrado({ motivo: 'sin_sesion' });
  } catch (e) {
    return falloRegistrado({ motivo: 'excepcion' }, e);
  }
}
