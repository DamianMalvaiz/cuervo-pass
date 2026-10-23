// Planes y pagos · Cuervo 360 · migración 0053.
//
// El cliente LEE el catálogo de planes, su suscripción y sus pagos; nada de esto se escribe desde aquí. Contratar pasa por
// `simular_pago`, que decide en el servidor (y solo funciona con el modo demostración activo). Toda lectura que falla LANZA
// (END-11): «falló» no es «no tienes pagos».

import { ErrorPago, esUrlDePago, tipoDeErrorPago } from '@/lib/pagoMp';
import type { MiSuscripcion } from '@/lib/planes';
import { supabase } from '@/lib/supabase';
import type { OrdenPago, PagoRegistrado, PlanDePago } from '@/types/database.types';

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

/**
 * Pide a la Edge Function `crear-pago` una ORDEN y la URL de Mercado Pago a la que mandar a pagar. Solo manda el plan: el monto lo fija el servidor.
 * Todo desenlace que no sea un 2xx con la forma esperada LANZA un `ErrorPago` con su motivo, y una URL que no sea de Mercado Pago nunca sale de aquí.
 */
export async function crearPago(planId: string): Promise<{ ordenId: string; url: string }> {
  let respuesta;
  try {
    respuesta = await supabase.functions.invoke('crear-pago', { body: { plan_id: planId } });
  } catch {
    throw new ErrorPago('red');
  }
  const { data, error } = respuesta;
  if (error) {
    const contexto = (error as { context?: { status?: number; json?: () => Promise<unknown> } }).context;
    let codigo: string | undefined;
    try {
      const cuerpo = (await contexto?.json?.()) as { error?: string } | undefined;
      codigo = cuerpo?.error;
    } catch {
      codigo = undefined;
    }
    throw new ErrorPago(tipoDeErrorPago(contexto?.status, codigo));
  }
  if (!data || typeof data !== 'object') throw new ErrorPago('desconocido');
  const { orden_id: ordenId, url } = data as Record<string, unknown>;
  if (typeof ordenId !== 'string' || !esUrlDePago(url)) throw new ErrorPago('desconocido');
  return { ordenId, url: url as string };
}

export type MiOrden = Pick<OrdenPago, 'id' | 'estado' | 'plan_id' | 'creada_en'>;

/** La última orden de pago de esta cuenta y esta función, o `null` si no tiene ninguna (no es un fallo). Las lee la dueña por RLS. */
export async function obtenerMiUltimaOrden(usuarioId: string, rol: Rol): Promise<MiOrden | null> {
  const { data, error } = await supabase
    .from('ordenes_pago')
    .select('id, estado, plan_id, creada_en')
    .eq('usuario_id', usuarioId)
    .eq('rol', rol)
    .order('creada_en', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as MiOrden | null;
}
