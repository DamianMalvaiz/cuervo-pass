// Planes y pagos · Cuervo 360
//
// Lecturas (catálogo, mi suscripción, mis pagos) con tres estados cada una (END-11) y la contratación con pago de
// demostración. Contratar cambia lo que se ve en varios sitios —el plan, los pagos, los negocios propios y la oferta
// pública de Servicios—, así que al terminar se vuelve a pedir todo eso en vez de escribirlo a mano.

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { claveMisRoles } from '@/hooks/queries/useRoles';
import { sondearOrden } from '@/lib/pagoMp';
import {
  crearPago,
  listarMisPagos,
  listarPlanes,
  obtenerMiSuscripcion,
  obtenerMiUltimaOrden,
  simularPago,
} from '@/services/planes.service';

type Rol = 'comerciante' | 'arrendador';

export function usePlanes(rol: Rol) {
  const q = useQuery({ queryKey: ['planes', rol], queryFn: () => listarPlanes(rol) });
  return { planes: q.data ?? [], cargando: q.isPending, fallo: q.isError, reintentar: () => void q.refetch() };
}

export function useMiSuscripcion(usuarioId: string | undefined, rol: Rol) {
  const q = useQuery({
    queryKey: ['miSuscripcion', usuarioId ?? '', rol],
    queryFn: () => obtenerMiSuscripcion(rol),
    enabled: Boolean(usuarioId),
  });
  // `suscripcion: null` con `fallo: false` es «no tienes esa función».
  return {
    suscripcion: q.data ?? null,
    cargando: q.isPending && Boolean(usuarioId),
    fallo: q.isError,
    reintentar: () => void q.refetch(),
  };
}

export function useMisPagos(usuarioId: string | undefined) {
  const q = useQuery({
    queryKey: ['misPagos', usuarioId ?? ''],
    queryFn: () => listarMisPagos(usuarioId as string),
    enabled: Boolean(usuarioId),
  });
  return {
    pagos: q.data ?? [],
    cargando: q.isPending && Boolean(usuarioId),
    fallo: q.isError,
    reintentar: () => void q.refetch(),
  };
}

/** Todo lo que cambia cuando un plan se activa, por el pago simulado o por el de Mercado Pago. */
function invalidarTrasPago(cliente: QueryClient, usuarioId: string | undefined, rol: Rol) {
  void cliente.invalidateQueries({ queryKey: ['miSuscripcion', usuarioId ?? '', rol] });
  void cliente.invalidateQueries({ queryKey: ['misPagos', usuarioId ?? ''] });
  void cliente.invalidateQueries({ queryKey: ['miUltimaOrden', usuarioId ?? '', rol] });
  void cliente.invalidateQueries({ queryKey: ['misNegocios', usuarioId ?? ''] });
  void cliente.invalidateQueries({ queryKey: claveMisRoles(usuarioId) });
  // Lo que se ve en Servicios depende del plan (cuántos negocios salen y cuáles van destacados).
  void cliente.invalidateQueries({ queryKey: ['negocios'] });
  void cliente.invalidateQueries({ queryKey: ['negocio'] });
}

export function useContratarPlan(usuarioId: string | undefined) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ({ planId }: { planId: string; rol: Rol }) => simularPago(planId),
    onSuccess: (_hasta, { rol }) => invalidarTrasPago(cliente, usuarioId, rol),
  });
}

/**
 * Pide la orden y la URL de Mercado Pago. No invalida nada al terminar: crear la orden no cambia el plan; lo cambia el aviso del pago, que llega
 * después y fuera de la app (por eso `useRefrescarTrasPago` y el sondeo de la orden).
 */
export function useCrearPago() {
  return useMutation({ mutationFn: ({ planId }: { planId: string }) => crearPago(planId) });
}

/**
 * La última orden de pago de esta cuenta y esta función. `orden: null` con `fallo: false` es «no tienes ninguna». Mientras está `creada` (esperando el
 * aviso de Mercado Pago) se vuelve a preguntar cada 5 s; con cualquier otro estado, no.
 */
export function useMiUltimaOrden(usuarioId: string | undefined, rol: Rol) {
  const q = useQuery({
    queryKey: ['miUltimaOrden', usuarioId ?? '', rol],
    queryFn: () => obtenerMiUltimaOrden(usuarioId as string, rol),
    enabled: Boolean(usuarioId),
    refetchInterval: (consulta) => sondearOrden(consulta.state.data?.estado),
  });
  return {
    orden: q.data ?? null,
    cargando: q.isPending && Boolean(usuarioId),
    fallo: q.isError,
    refrescar: () => void q.refetch(),
  };
}

/** Vuelve a pedir todo lo que depende del pago. La MISMA función entre renders: la pantalla la usa como dependencia de un efecto. */
export function useRefrescarTrasPago(usuarioId: string | undefined, rol: Rol) {
  const cliente = useQueryClient();
  return useCallback(() => invalidarTrasPago(cliente, usuarioId, rol), [cliente, usuarioId, rol]);
}
