// Verificación de vendedor · Cuervo 360 · migración 0049.
//
// La tabla `verificaciones_vendedor` solo se LEE desde el cliente (la dueña, su propia fila); enviar pasa por la RPC
// `enviar_verificacion`, que decide en el servidor. El estado (pendiente, aprobado, rechazado) NO vive aquí sino en
// `roles_usuario.estado`: esta lectura solo trae el rastro de la revisión (cuándo se envió, el motivo de un rechazo).

import { supabase } from '@/lib/supabase';
import type { RolVendedor } from '@/lib/verificacion';

export interface MiVerificacion {
  nombre_legal: string;
  direccion: string;
  enviada_en: string;
  revisada_en: string | null;
  motivo_rechazo: string | null;
}

/**
 * La verificación de ESTA cuenta para un rol, o `null` si nunca envió una. LANZA si la lectura falla: «no pudimos
 * mirar» no es «nunca enviaste nada» (END-11). Las columnas van enumeradas y SIN las rutas de la INE: la pantalla no
 * las necesita.
 */
export async function obtenerMiVerificacion(usuarioId: string, rol: RolVendedor): Promise<MiVerificacion | null> {
  const { data, error } = await supabase
    .from('verificaciones_vendedor')
    .select('nombre_legal, direccion, enviada_en, revisada_en, motivo_rechazo')
    .eq('usuario_id', usuarioId)
    .eq('rol', rol)
    .maybeSingle();
  if (error) throw error;
  return (data as MiVerificacion | null) ?? null;
}

export interface EnvioVerificacion {
  rol: RolVendedor;
  nombreLegal: string;
  direccion: string;
  ineFrente: string;
  ineReverso: string;
  fotos: string[];
  versionAviso: string;
}

/**
 * Manda la verificación a revisión. El error conserva su `code` (CP005 si ya no se puede enviar) para que la pantalla
 * lo lea por código (END-27). El consentimiento lo sella el servidor con su hora.
 */
export async function enviarVerificacion(d: EnvioVerificacion): Promise<void> {
  const { error } = await supabase.rpc('enviar_verificacion', {
    p_rol: d.rol,
    p_nombre_legal: d.nombreLegal.trim(),
    p_direccion: d.direccion.trim(),
    p_ine_frente: d.ineFrente,
    p_ine_reverso: d.ineReverso,
    p_fotos: d.fotos,
    p_version_aviso: d.versionAviso,
  });
  if (error) throw error;
}
