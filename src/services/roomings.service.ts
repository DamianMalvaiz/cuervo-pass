import { supabase } from '@/lib/supabase';
import type { Rooming } from '@/types/database.types';

export async function listarRoomingsActivos() {
  const { data, error } = await supabase
    .from('roomings')
    .select('*')
    .eq('estado', 'activo')
    .order('creado_en', { ascending: false });
  if (error) throw error;
  return data as Rooming[];
}

// TODO (Semana 6): crear/editar la publicación de "busco roomie".
export async function crearRooming(_rooming: Partial<Rooming>) {
  throw new Error('crearRooming no implementado todavía — Semana 6');
}
