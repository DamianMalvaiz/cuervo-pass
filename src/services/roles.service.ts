// Roles de usuario · Cuervo 360 · migración 0043.
//
// El cliente solo LEE sus roles (RLS acota las filas a las propias) y agregarse una función pasa
// por la RPC `agregar_funcion`, que decide en el servidor. Nada aquí escribe la tabla: no tiene
// `insert`, `update` ni `delete` para `authenticated`.

import { supabase } from '@/lib/supabase';
import type { RolUsuario } from '@/types/database.types';

/**
 * Las funciones que ESTA cuenta ha agregado. «Estudiante» no aparece: es implícito.
 *
 * LANZA si la lectura falla. Una lista vacía es el caso normal de casi todas las cuentas, y
 * devolverla ante un error diría «no tienes ninguna función» cuando lo cierto es «no pudimos
 * mirar» (END-11).
 */
export async function obtenerMisRoles(usuarioId: string): Promise<RolUsuario[]> {
  const { data, error } = await supabase
    .from('roles_usuario')
    .select('*')
    .eq('usuario_id', usuarioId)
    .order('desde', { ascending: true });
  if (error) throw error;
  return (data ?? []) as RolUsuario[];
}

/**
 * Pide una función. Nace `sin_verificar`: pedirla NO da acceso a publicar. El error conserva su
 * `code` (CP003 si el rol no se puede pedir) para que la pantalla lo lea por código (END-27).
 */
export async function agregarFuncion(rol: 'comerciante' | 'arrendador'): Promise<void> {
  const { error } = await supabase.rpc('agregar_funcion', { p_rol: rol });
  if (error) throw error;
}
