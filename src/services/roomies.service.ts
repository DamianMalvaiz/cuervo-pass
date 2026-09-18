// Documento maestro v5 · §11 (la tabla pasó de `roomings` a `roomies`) y §18.
//
// El orden por afinidad ya no se arma en dos pasos desde el cliente (traer la
// lista, mandar los ids a una función de similitud, reordenar en JavaScript):
// `sugerencias_roomies` (migración 0014) devuelve la lista ya ordenada, con los
// datos públicos del dueño unidos en la misma consulta.

import { generarEmbedding } from '@/lib/aiService';
import { supabase } from '@/lib/supabase';
import type { Roomie, RoomieSugerido } from '@/types/database.types';

/**
 * Roomies activos de otros usuarios, ordenados por similitud de coseno.
 *
 * Aquí no hay un "Nivel 1" de filtros duros como en publicaciones: ambos lados
 * ya buscan cerca de la misma universidad, así que el orden es directamente la
 * afinidad semántica. Quien todavía no tiene vector aparece al final, no
 * desaparece (`nulls last` en la función).
 */
export async function listarRoomiesSugeridos(limite = 30): Promise<RoomieSugerido[]> {
  const { data, error } = await supabase.rpc('sugerencias_roomies', { p_limite: limite });
  if (error) throw error;
  return (data ?? []) as RoomieSugerido[];
}

export async function obtenerMiRoomie(usuarioId: string): Promise<Roomie | null> {
  const { data, error } = await supabase.from('roomies').select('*').eq('usuario_id', usuarioId).maybeSingle();
  if (error) throw error;
  return data as Roomie | null;
}

// El vector se calcula sobre lo que la persona escribió que busca, no sobre su
// perfil: es lo que la otra parte va a comparar contra el suyo. Si el
// microservicio falla, se guarda sin vector y el rooming aparece al final de la
// lista en vez de no aparecer (§27).
async function vectorDeBusquedaSeguro(descripcion: string): Promise<number[] | null> {
  try {
    return await generarEmbedding(descripcion);
  } catch (e) {
    console.warn('generarEmbedding (roomie) falló:', e);
    return null;
  }
}

// Upsert por usuario_id (restricción única, migración 0004) — un usuario tiene
// a lo más un roomie propio; togglear "busco roomie" solo cambia su estado.
export async function guardarMiRoomie(
  usuarioId: string,
  datos: { descripcionBusqueda: string; estado: Roomie['estado']; presupuestoAportacion?: number | null }
): Promise<Roomie> {
  const vector = await vectorDeBusquedaSeguro(datos.descripcionBusqueda);

  const { data, error } = await supabase
    .from('roomies')
    .upsert(
      {
        usuario_id: usuarioId,
        descripcion_busqueda: datos.descripcionBusqueda,
        presupuesto_aportacion: datos.presupuestoAportacion ?? null,
        estado: datos.estado,
        ...(vector ? { vector_busqueda: vector } : {}),
      },
      { onConflict: 'usuario_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return data as Roomie;
}
