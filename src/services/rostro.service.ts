// Verificación de rostro · fase 6. Una sola llamada a la Edge Function `verificar-rostro`.
//
// El id de la persona NO viaja en el cuerpo: la función lo toma de la sesión. La selfie va en base64 y no se guarda en ningún sitio.

import { interpretarRespuestaRostro, type ResultadoRostro } from '@/lib/rostro';
import { supabase } from '@/lib/supabase';
import type { RolVendedor } from '@/lib/verificacion';

/** Nunca lanza: todo desenlace (incluida la red caída) es un `ResultadoRostro` que la pantalla sabe decir. */
export async function enviarSelfie(rol: RolVendedor, selfieBase64: string, versionAviso: string): Promise<ResultadoRostro> {
  try {
    const { data, error } = await supabase.functions.invoke('verificar-rostro', {
      body: { rol, selfie: selfieBase64, consentimiento: true, version_aviso: versionAviso },
    });
    if (error) {
      const status = (error as { context?: { status?: number } }).context?.status;
      return typeof status === 'number' ? interpretarRespuestaRostro(status, null) : { tipo: 'error' };
    }
    return interpretarRespuestaRostro(200, data);
  } catch {
    return { tipo: 'error' };
  }
}
