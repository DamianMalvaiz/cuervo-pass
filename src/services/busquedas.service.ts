// Búsquedas guardadas · migración 0093.
//
// Una búsqueda guardada es PRIVADA: la tabla solo deja leer, crear y borrar las filas propias (y tope de 20). `filtros` es lo que viaja por la URL de `/departamentos` (zona, presupuesto, tipo y los tres sí/no), como texto.
// Lo que vuelve de la base se trata como texto de afuera: aquí solo se comprueba la forma (un objeto de textos); el contenido lo valida `deParametros` al aplicarla.

import { supabase } from '@/lib/supabase';

export interface BusquedaGuardada {
  id: string;
  nombre: string;
  filtros: Record<string, string>;
  creado_en: string;
}

/** Solo las entradas que son texto: una clave con otro tipo no es de las que escribe la app. */
function soloTextos(crudo: unknown): Record<string, string> {
  if (typeof crudo !== 'object' || crudo === null || Array.isArray(crudo)) return {};
  return Object.fromEntries(Object.entries(crudo).filter((e): e is [string, string] => typeof e[1] === 'string'));
}

/** Las búsquedas de esta cuenta, las más recientes primero. LANZA si falla (END-11): «no se pudo leer» no es «no guardaste ninguna». */
export async function listarBusquedasGuardadas(): Promise<BusquedaGuardada[]> {
  const { data, error } = await supabase.from('busquedas_guardadas').select('id, nombre, filtros, creado_en').order('creado_en', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((f) => ({ id: f.id as string, nombre: f.nombre as string, filtros: soloTextos(f.filtros), creado_en: f.creado_en as string }));
}

export async function guardarBusqueda(usuarioId: string, nombre: string, filtros: Record<string, string>): Promise<void> {
  const { error } = await supabase.from('busquedas_guardadas').insert({ usuario_id: usuarioId, nombre, filtros });
  if (error) throw error;
}

export async function borrarBusqueda(id: string): Promise<void> {
  const { error } = await supabase.from('busquedas_guardadas').delete().eq('id', id);
  if (error) throw error;
}
