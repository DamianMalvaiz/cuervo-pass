// Explorar sin cuenta · Cuervo 360
//
// Lecturas públicas de la web (migración 0090). Las claves no llevan id de cuenta: no hay cuenta. Todas distinguen cargando, falló y vacío (END-11).

import { useQuery } from '@tanstack/react-query';

import { INTERVALO_REFIRMA_MS } from '@/hooks/use-fotos-firmadas';
import {
  fotosPublicas,
  listarCategoriasPublicas,
  listarHorarioPublico,
  listarNegociosPublicos,
  listarProductosPublicos,
  listarPublicacionesPublicas,
  obtenerNegocioPublico,
  obtenerPublicacionPublica,
  type FiltroPublicaciones,
} from '@/services/explorar.service';

export function usePublicacionesPublicas(filtro: FiltroPublicaciones) {
  const q = useQuery({
    queryKey: ['explorarPublicaciones', filtro],
    queryFn: () => listarPublicacionesPublicas(filtro),
    placeholderData: (previa) => previa,
  });
  return { publicaciones: q.data ?? [], cargando: q.isPending, fallo: q.isError, reintentar: () => void q.refetch() };
}

export function usePublicacionPublica(id: string | undefined) {
  const q = useQuery({ queryKey: ['explorarPublicacion', id ?? ''], queryFn: () => obtenerPublicacionPublica(id as string), enabled: Boolean(id) });
  return { publicacion: q.data ?? null, cargando: q.isPending && Boolean(id), fallo: q.isError, reintentar: () => void q.refetch() };
}

export function useNegociosPublicos({ limite }: { limite: number }) {
  const q = useQuery({ queryKey: ['explorarNegocios', limite], queryFn: () => listarNegociosPublicos({ limite }), placeholderData: (previa) => previa });
  return { negocios: q.data ?? [], cargando: q.isPending, fallo: q.isError, reintentar: () => void q.refetch() };
}

export function useNegocioPublico(id: string | undefined) {
  const q = useQuery({ queryKey: ['explorarNegocio', id ?? ''], queryFn: () => obtenerNegocioPublico(id as string), enabled: Boolean(id) });
  return { negocio: q.data ?? null, cargando: q.isPending && Boolean(id), fallo: q.isError, reintentar: () => void q.refetch() };
}

export function useProductosPublicos(negocioId: string | undefined) {
  const q = useQuery({ queryKey: ['explorarProductos', negocioId ?? ''], queryFn: () => listarProductosPublicos(negocioId as string), enabled: Boolean(negocioId) });
  return { productos: q.data ?? [], cargando: q.isPending && Boolean(negocioId), fallo: q.isError, reintentar: () => void q.refetch() };
}

export function useHorarioPublico(negocioId: string | undefined) {
  const q = useQuery({ queryKey: ['explorarHorario', negocioId ?? ''], queryFn: () => listarHorarioPublico(negocioId as string), enabled: Boolean(negocioId) });
  return { horario: q.data ?? [], cargando: q.isPending && Boolean(negocioId), fallo: q.isError, reintentar: () => void q.refetch() };
}

export function useCategoriasPublicas() {
  const q = useQuery({ queryKey: ['explorarCategorias'], queryFn: listarCategoriasPublicas });
  return { categorias: q.data ?? [], cargando: q.isPending, fallo: q.isError, reintentar: () => void q.refetch() };
}

/**
 * Las fotos de algo visible. `numFotos` viene de la vista: si dice 0 no se molesta a la función. Las URL duran una hora; se vuelven a pedir antes (END-24).
 */
export function useFotosPublicas(tipo: 'publicacion' | 'negocio' | 'producto', id: string | undefined, numFotos: number) {
  const activo = Boolean(id) && numFotos > 0;
  const q = useQuery({
    queryKey: ['explorarFotos', tipo, id ?? ''],
    queryFn: () => fotosPublicas(tipo, id as string),
    enabled: activo,
    staleTime: INTERVALO_REFIRMA_MS,
    refetchInterval: INTERVALO_REFIRMA_MS,
  });
  return { fotos: q.data ?? [], cargando: q.isPending && activo, fallo: q.isError };
}
