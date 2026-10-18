// Centro de notificaciones · migración 0072.
//
// El cliente solo LEE sus avisos y los marca como leídos (la base le quita todo lo demás). Los avisos de mensaje no se piden: viven en Chats, y
// el filtro va al SERVIDOR (invariante 5) para que 50 mensajes no empujen fuera de la página lo que sí importa. Toda lectura que falla LANZA.

import { supabase } from '@/lib/supabase';
import type { Notificacion } from '@/types/database.types';

export type AvisoDelCentro = Pick<Notificacion, 'id' | 'tipo' | 'contenido' | 'leida' | 'creado_en' | 'destino'>;

export const LIMITE_AVISOS = 50;

export async function listarAvisos(): Promise<AvisoDelCentro[]> {
  const { data, error } = await supabase
    .from('notificaciones')
    .select('id, tipo, contenido, leida, creado_en, destino')
    .neq('tipo', 'nuevo_mensaje')
    .order('creado_en', { ascending: false })
    .limit(LIMITE_AVISOS);
  if (error) throw error;
  return (data ?? []) as AvisoDelCentro[];
}

export async function contarAvisosNoLeidos(): Promise<number> {
  const { count, error } = await supabase
    .from('notificaciones')
    .select('id', { count: 'exact', head: true })
    .eq('leida', false)
    .neq('tipo', 'nuevo_mensaje');
  if (error) throw error;
  return count ?? 0;
}

export async function marcarAvisoLeido(id: string): Promise<void> {
  const { error } = await supabase.from('notificaciones').update({ leida: true }).eq('id', id);
  if (error) throw error;
}

export async function marcarTodosLeidos(): Promise<void> {
  const { error } = await supabase.from('notificaciones').update({ leida: true }).eq('leida', false).neq('tipo', 'nuevo_mensaje');
  if (error) throw error;
}
