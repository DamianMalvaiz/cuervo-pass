// Documento maestro v5 · §13 (vistas públicas) y §29 (derechos ARCO).

import { supabase } from '@/lib/supabase';
import type { PerfilPublico } from '@/types/database.types';

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

export async function obtenerPerfilesPublicos(usuarioIds: string[]): Promise<PerfilPublico[]> {
  if (usuarioIds.length === 0) return [];
  const { data, error } = await supabase.from('perfiles_publicos').select('*').in('id', usuarioIds);
  if (error) throw error;
  return (data ?? []) as PerfilPublico[];
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
 * todo lo demás, incluidas las fotos del bucket (trigger de la migración 0015).
 * Vive en una Edge Function porque requiere service_role.
 */
export async function eliminarMiCuenta(): Promise<void> {
  const { error } = await supabase.functions.invoke('eliminar-cuenta', { body: {} });
  if (error) throw error;
  await supabase.auth.signOut();
}
