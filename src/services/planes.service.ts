// Planes y pagos · Cuervo 360 · migración 0053.
//
// El cliente LEE el catálogo de planes, su suscripción y sus pagos; nada de esto se escribe desde aquí. Contratar pasa por
// `simular_pago`, que decide en el servidor (y solo funciona con el modo demostración activo). Toda lectura que falla LANZA
// (END-11): «falló» no es «no tienes pagos».

import type { MiSuscripcion } from '@/lib/planes';
import { supabase } from '@/lib/supabase';
import type { PagoRegistrado, PlanDePago } from '@/types/database.types';

type Rol = 'comerciante' | 'arrendador';

const COLUMNAS_PLAN = 'id, rol, nombre, precio_centavos, limite_principal, max_fotos, max_productos, destaca, es_prueba, orden';

/** Los planes DE PAGO de una función (el gratuito no se contrata), del más barato al más caro. */
export async function listarPlanes(rol: Rol): Promise<PlanDePago[]> {
  const { data, error } = await supabase
    .from('planes')
    .select(COLUMNAS_PLAN)
    .eq('rol', rol)
    .gt('precio_centavos', 0)
    .order('orden', { ascending: true });
  if (error) throw error;
  return (data ?? []) as PlanDePago[];
}

/** El plan efectivo de ESTA cuenta, o `null` si no tiene esa función (no es un fallo). */
export async function obtenerMiSuscripcion(rol: Rol): Promise<MiSuscripcion | null> {
  const { data, error } = await supabase.rpc('mi_suscripcion', { p_rol: rol });
  if (error) throw error;
  return (data ?? [])[0] ?? null;
}

/** Los pagos de esta cuenta, los más recientes primero. */
export async function listarMisPagos(usuarioId: string): Promise<PagoRegistrado[]> {
  const { data, error } = await supabase
    .from('pagos')
    .select('id, usuario_id, rol, plan_id, monto_centavos, origen, periodo_inicio, periodo_fin, creado_en')
    .eq('usuario_id', usuarioId)
    .order('creado_en', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as PagoRegistrado[];
}

/**
 * Contrata un plan con un pago de DEMOSTRACIÓN y devuelve hasta cuándo queda vigente. El error conserva su `code`: CP010 si
 * el modo demostración está apagado, CP011 si el plan no aplica a esta cuenta.
 */
export async function simularPago(planId: string): Promise<string> {
  const { data, error } = await supabase.rpc('simular_pago', { p_plan: planId });
  if (error) throw error;
  return data as string;
}
