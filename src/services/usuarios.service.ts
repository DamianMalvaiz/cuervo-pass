// Documento maestro v5 · §13 (vistas públicas) y §29 (derechos ARCO).

import { supabase } from '@/lib/supabase';
import type { PerfilPublico } from '@/types/database.types';
import type { PerfilActivo } from '@/lib/perfilActivo';

/**
 * Perfil de OTRO usuario.
 *
 * Sale de la vista `perfiles_publicos`, no de la tabla. v3 hacía
 * `from('usuarios').select('*')` confiando en que RLS lo protegía, y eso era el
 * error central del documento: RLS filtra FILAS, no COLUMNAS. Con la policy de
 * v3 (`activo = true`) ese select bajaba el presupuesto, la universidad y el
 * vector de perfil de todo el padrón.
 *
 * Contra la tabla, esta consulta ahora devolvería null para cualquiera que no
 * sea uno mismo. La vista es el único camino, y su lista de columnas es la
 * lista blanca.
 */
export async function obtenerPerfilPublico(usuarioId: string): Promise<PerfilPublico | null> {
  const { data, error } = await supabase
    .from('perfiles_publicos')
    .select('*')
    .eq('id', usuarioId)
    .maybeSingle();
  if (error) throw error;
  return data as PerfilPublico | null;
}

/** ¿Esta cuenta está restringida (0082)? Un fallo de lectura LANZA: «no pude saberlo» no es «no está restringida». */
export async function obtenerCuentaRestringida(usuarioId: string): Promise<boolean> {
  const { data, error } = await supabase.from('usuarios').select('cuenta_restringida').eq('id', usuarioId).maybeSingle();
  if (error) throw error;
  return data?.cuenta_restringida === true;
}

/** El perfil que usa la cuenta (0083). Un fallo de lectura LANZA: «no pude saberlo» no es «es estudiante». */
export async function obtenerPerfilActivo(usuarioId: string): Promise<PerfilActivo> {
  const { data, error } = await supabase.from('usuarios').select('perfil_activo').eq('id', usuarioId).maybeSingle();
  if (error) throw error;
  return data?.perfil_activo === 'vendedor' ? 'vendedor' : 'estudiante';
}

/** La única forma de cambiarlo: 'vendedor' exige alguna función de vendedor (CP017 si no). */
export async function cambiarPerfilActivo(perfil: PerfilActivo): Promise<void> {
  const { error } = await supabase.rpc('cambiar_perfil_activo', { p_perfil: perfil });
  if (error) throw error;
}

export async function obtenerPerfilesPublicos(usuarioIds: string[]): Promise<PerfilPublico[]> {
  if (usuarioIds.length === 0) return [];
  const { data, error } = await supabase.from('perfiles_publicos').select('*').in('id', usuarioIds);
  if (error) throw error;
  return (data ?? []) as PerfilPublico[];
}

/**
 * La afinidad con ESTA persona · el mismo número que ordenó la lista.
 *
 * `sugerencias_roomies` ordena por afinidad semántica y la tarjeta la enseña;
 * al abrir el perfil, el número desaparecía. La pantalla donde de verdad se
 * decide si escribirle a alguien era la única sin el dato por el que esa
 * persona salió en la lista — el mismo defecto que END-21 cerró para
 * publicaciones.
 *
 * `similitud` es null cuando la otra persona no tiene ficha de roomie activa, o
 * cuando alguno de los dos no consintió el análisis. Null y no cero: cero sería
 * una afinidad MEDIDA, y esto es su ausencia (END-08).
 */
export async function obtenerAfinidadRoomie(
  usuarioId: string
): Promise<{ similitud: number | null; nivel: 1 | 2 } | null> {
  const { data, error } = await supabase.rpc('afinidad_roomie_de', { p_usuario_id: usuarioId });
  if (error) throw error;
  const fila = (data ?? [])[0];
  return fila ? { similitud: fila.similitud, nivel: fila.nivel } : null;
}

export async function reportarUsuario(reportadoPor: string, usuarioReportadoId: string, motivo: string) {
  const { error } = await supabase
    .from('reportes')
    .insert({ reportado_por: reportadoPor, usuario_reportado_id: usuarioReportadoId, motivo });
  if (error) throw error;
}

// ═══════════════════ Derechos ARCO · §29 ═══════════════════
// Prometerlos en el aviso de privacidad y no implementarlos es peor que no
// prometerlos. Son dos botones en Mi perfil.

/** ACCESO: todo lo que la app guarda sobre ti, en un JSON. */
export async function exportarMisDatos(): Promise<unknown> {
  const { data, error } = await supabase.rpc('exportar_mis_datos');
  if (error) throw error;
  return data;
}

/**
 * CANCELACIÓN: borra la cuenta de Auth, y con ella —por `on delete cascade`—
 * todo lo demás, incluidas las fotos del bucket (trigger de la migración 0016).
 * Vive en una Edge Function porque requiere service_role.
 */
export async function eliminarMiCuenta(): Promise<void> {
  const { error } = await supabase.functions.invoke('eliminar-cuenta', { body: {} });
  if (error) throw error;
  await supabase.auth.signOut();
}
