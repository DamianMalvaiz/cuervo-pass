// Reseñas · Cuervo 360
//
// Lecturas de las reseñas visibles y de la MÍA (tres estados cada una, END-11) y las escrituras: guardar, borrar, responder y
// reportar. Al escribir se vuelve a pedir lo que cambia —las reseñas, la mía, y las fichas de Servicios y de viviendas, donde se
// ve el promedio— en lugar de escribirlo a mano: la calificación la calcula la base.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Objetivo } from '@/lib/resenas';
import {
  borrarMiResena, guardarResena, listarResenas, obtenerCalificacionPublicacion, obtenerMiResena, reportarResena, responderResena,
} from '@/services/resenas.service';

const idDe = (o: Objetivo) => o.negocioId ?? o.publicacionId;
const claveLista = (o: Objetivo) => ['resenas', idDe(o)] as const;
const claveMia = (usuarioId: string | undefined, o: Objetivo) => ['miResena', usuarioId ?? '', idDe(o)] as const;

export function useResenas(objetivo: Objetivo) {
  const q = useQuery({ queryKey: claveLista(objetivo), queryFn: () => listarResenas(objetivo) });
  return { resenas: q.data ?? [], cargando: q.isPending, fallo: q.isError, reintentar: () => void q.refetch() };
}

export function useMiResena(usuarioId: string | undefined, objetivo: Objetivo) {
  const q = useQuery({
    queryKey: claveMia(usuarioId, objetivo),
    queryFn: () => obtenerMiResena(usuarioId as string, objetivo),
    enabled: Boolean(usuarioId),
  });
  // `miResena: null` con `fallo: false` es «todavía no has reseñado».
  return {
    miResena: q.data ?? null,
    cargando: q.isPending && Boolean(usuarioId),
    fallo: q.isError,
    reintentar: () => void q.refetch(),
  };
}

/** Vuelve a pedir lo que depende de las reseñas de un objetivo. */
function useRefrescar(usuarioId: string | undefined, objetivo: Objetivo) {
  const cliente = useQueryClient();
  return () => {
    void cliente.invalidateQueries({ queryKey: claveLista(objetivo) });
    void cliente.invalidateQueries({ queryKey: claveMia(usuarioId, objetivo) });
    // El promedio vive en las fichas: el de un negocio, en su vista pública; el de una vivienda, en su calificación.
    void cliente.invalidateQueries({ queryKey: ['negocios'] });
    void cliente.invalidateQueries({ queryKey: ['negocio'] });
    void cliente.invalidateQueries({ queryKey: ['calificacionPublicacion'] });
  };
}

export function useGuardarResena(usuarioId: string | undefined, objetivo: Objetivo) {
  const refrescar = useRefrescar(usuarioId, objetivo);
  return useMutation({
    mutationFn: (d: { id?: string; estrellas: number; texto: string }) => {
      if (!usuarioId) throw new Error('sin sesión');
      return guardarResena(usuarioId, objetivo, d);
    },
    onSuccess: refrescar,
  });
}

export function useBorrarResena(usuarioId: string | undefined, objetivo: Objetivo) {
  const refrescar = useRefrescar(usuarioId, objetivo);
  return useMutation({ mutationFn: (id: string) => borrarMiResena(id), onSuccess: refrescar });
}

export function useResponderResena(usuarioId: string | undefined, objetivo: Objetivo) {
  const refrescar = useRefrescar(usuarioId, objetivo);
  return useMutation({ mutationFn: (d: { id: string; texto: string }) => responderResena(d.id, d.texto), onSuccess: refrescar });
}

export function useReportarResena(usuarioId: string | undefined, objetivo: Objetivo) {
  const refrescar = useRefrescar(usuarioId, objetivo);
  return useMutation({ mutationFn: (d: { id: string; motivo: string }) => reportarResena(d.id, d.motivo), onSuccess: refrescar });
}

/** La calificación calculada de una vivienda. `null` con `fallo: false` es «todavía sin reseñas». */
export function useCalificacionPublicacion(publicacionId: string | undefined) {
  const q = useQuery({
    queryKey: ['calificacionPublicacion', publicacionId ?? ''],
    queryFn: () => obtenerCalificacionPublicacion(publicacionId as string),
    enabled: Boolean(publicacionId),
  });
  return {
    calificacion: q.data?.calificacion ?? null,
    numResenas: q.data?.num_resenas ?? 0,
    cargando: q.isPending && Boolean(publicacionId),
    fallo: q.isError,
  };
}
