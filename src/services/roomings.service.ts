import { supabase } from '@/lib/supabase';
import type { Rooming, Usuario } from '@/types/database.types';

export interface RoomingConUsuario extends Rooming {
  usuarios: Pick<Usuario, 'id' | 'nombre_completo' | 'foto_url' | 'universidad'> | null;
}

// Roomings activos de OTROS usuarios (sección 9: "lista de busco roomie
// ordenados por afinidad" — el orden por afinidad real llega en la Semana 10
// con embeddings; por ahora, más reciente primero).
export async function listarRoomingsActivos(excluirUsuarioId: string): Promise<RoomingConUsuario[]> {
  const { data, error } = await supabase
    .from('roomings')
    .select('*, usuarios(id, nombre_completo, foto_url, universidad)')
    .eq('estado', 'activo')
    .neq('usuario_id', excluirUsuarioId)
    .order('creado_en', { ascending: false });
  if (error) throw error;
  return data as unknown as RoomingConUsuario[];
}

export async function obtenerMiRooming(usuarioId: string): Promise<Rooming | null> {
  const { data, error } = await supabase.from('roomings').select('*').eq('usuario_id', usuarioId).maybeSingle();
  if (error) throw error;
  return data as Rooming | null;
}

// Upsert por usuario_id (constraint única, migración 0004) — un usuario tiene
// a lo más un rooming propio; togglear "busco roomie" solo cambia su estado.
export async function guardarMiRooming(
  usuarioId: string,
  datos: { descripcionBusqueda: string; estado: Rooming['estado'] }
): Promise<Rooming> {
  const { data, error } = await supabase
    .from('roomings')
    .upsert(
      { usuario_id: usuarioId, descripcion_busqueda: datos.descripcionBusqueda, estado: datos.estado },
      { onConflict: 'usuario_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return data as Rooming;
}
