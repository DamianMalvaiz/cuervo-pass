// Planes y pagos · Cuervo 360
//
// Lecturas (catálogo, mi suscripción, mis pagos) con tres estados cada una (END-11) y la contratación con pago de
// demostración. Contratar cambia lo que se ve en varios sitios —el plan, los pagos, los negocios propios y la oferta
// pública de Servicios—, así que al terminar se vuelve a pedir todo eso en vez de escribirlo a mano.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { claveMisRoles } from '@/hooks/queries/useRoles';
import { listarMisPagos, listarPlanes, obtenerMiSuscripcion, simularPago } from '@/services/planes.service';

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

export function useContratarPlan(usuarioId: string | undefined) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ({ planId }: { planId: string; rol: Rol }) => simularPago(planId),
    onSuccess: (_hasta, { rol }) => {
      void cliente.invalidateQueries({ queryKey: ['miSuscripcion', usuarioId ?? '', rol] });
      void cliente.invalidateQueries({ queryKey: ['misPagos', usuarioId ?? ''] });
      void cliente.invalidateQueries({ queryKey: ['misNegocios', usuarioId ?? ''] });
      void cliente.invalidateQueries({ queryKey: claveMisRoles(usuarioId) });
      // Lo que se ve en Servicios depende del plan (cuántos negocios salen y cuáles van destacados).
      void cliente.invalidateQueries({ queryKey: ['negocios'] });
      void cliente.invalidateQueries({ queryKey: ['negocio'] });
    },
  });
}
