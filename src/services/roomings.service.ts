import { supabase } from '@/lib/supabase';
import type { Rooming, Usuario } from '@/types/database.types';

export interface RoomingConUsuario extends Rooming {
  usuarios: Pick<Usuario, 'id' | 'nombre_completo' | 'foto_url' | 'universidad'> | null;
}

// Roomings activos de OTROS usuarios, más reciente primero — el orden por
// afinidad real (Semana 10, embeddings) se aplica después, en el cliente, vía
// ordenarRoomingsPorSimilitud sobre este mismo conjunto.
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

// Semana 10, sección 15 extendida: aquí no hay "Nivel 1" de filtros duros
// como presupuesto/distancia — el orden por afinidad es directamente
// similitud de coseno entre el perfil de quien busca y el de cada candidato.
// Nunca bloquea ni rompe la lista si falla (sección 17): el llamador cae de
// vuelta al orden por fecha si esto regresa null.
export async function ordenarRoomingsPorSimilitud(vectorPerfil: string, idsCandidatos: string[]): Promise<string[] | null> {
  if (idsCandidatos.length === 0) return [];
  const { data, error } = await supabase.rpc('ordenar_roomings_por_similitud', {
    vector_perfil: vectorPerfil,
    ids_candidatos: idsCandidatos,
  });
  if (error) {
    console.warn('ordenarRoomingsPorSimilitud falló:', error);
    return null;
  }
  return data.map((fila) => fila.id);
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
