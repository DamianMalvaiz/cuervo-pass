import { supabase } from '@/lib/supabase';
import type { Usuario } from '@/types/database.types';

// Perfil público de otro usuario (roomie candidato, contraparte de un chat) —
// RLS ya limita esto a perfiles activos (migración 0001), así que no hace
// falta filtrar activo=true aquí de nuevo.
export async function obtenerUsuarioPublico(usuarioId: string) {
  const { data, error } = await supabase.from('usuarios').select('*').eq('id', usuarioId).single();
  if (error) throw error;
  return data as Usuario;
}

export async function obtenerUsuariosPublicos(usuarioIds: string[]): Promise<Usuario[]> {
  if (usuarioIds.length === 0) return [];
  const { data, error } = await supabase.from('usuarios').select('*').in('id', usuarioIds);
  if (error) throw error;
  return data as Usuario[];
}

export async function reportarUsuario(reportadoPor: string, usuarioReportadoId: string, motivo: string) {
  const { error } = await supabase
    .from('reportes')
    .insert({ reportado_por: reportadoPor, usuario_reportado_id: usuarioReportadoId, motivo });
  if (error) throw error;
}
