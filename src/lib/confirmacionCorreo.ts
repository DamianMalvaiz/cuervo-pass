import { supabase } from '@/lib/supabase';

/**
 * Reenvía el correo de confirmación. Devuelve `false` si no salió (límite de envíos, sin red): quien llama lo
 * dice en pantalla en vez de fingir que se mandó.
 */
export async function reenviarConfirmacion(email: string): Promise<boolean> {
  try {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    return !error;
  } catch {
    return false;
  }
}
