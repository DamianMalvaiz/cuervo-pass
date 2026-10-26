// Favoritos de negocios · 0073. Misma forma que `useFavoritos` (ids baratos para los corazones, lista completa para la pestaña, actualización
// optimista con reversión). Las claves llevan la cuenta; al cerrar sesión la caché entera se vacía.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  contarFavoritosDeMisNegocios,
  guardarFavoritoNegocio,
  listarMisNegociosFavoritos,
  listarMisNegociosFavoritosIds,
  quitarFavoritoNegocio,
} from '@/services/favoritos.service';

const claveIds = (uid: string | undefined) => ['favoritosNegociosIds', uid ?? ''] as const;
const claveLista = (uid: string | undefined) => ['favoritosNegocios', uid ?? ''] as const;

export function useMisNegociosFavoritosIds(uid: string | undefined) {
  const q = useQuery({
    queryKey: claveIds(uid),
    queryFn: () => listarMisNegociosFavoritosIds(uid as string),
    enabled: Boolean(uid),
  });
  return { ids: new Set(q.data ?? []), cargando: q.isPending, fallo: q.isError };
}

export function useMisNegociosFavoritos(uid: string | undefined) {
  const q = useQuery({
    queryKey: claveLista(uid),
    queryFn: () => listarMisNegociosFavoritos(uid as string),
    enabled: Boolean(uid),
  });
  return {
    negocios: q.data?.negocios ?? [],
    noDisponibles: q.data?.noDisponibles ?? 0,
    cargando: q.isPending,
    fallo: q.isError,
    reintentar: () => void q.refetch(),
  };
}

export function useAlternarFavoritoNegocio(uid: string | undefined) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ({ negocioId, guardar }: { negocioId: string; guardar: boolean }) =>
      guardar ? guardarFavoritoNegocio(uid as string, negocioId) : quitarFavoritoNegocio(uid as string, negocioId),
    onMutate: async ({ negocioId, guardar }) => {
      await cliente.cancelQueries({ queryKey: claveIds(uid) });
      const anterior = cliente.getQueryData<string[]>(claveIds(uid));
      const base = (anterior ?? []).filter((id) => id !== negocioId);
      cliente.setQueryData(claveIds(uid), guardar ? [negocioId, ...base] : base);
      return { anterior };
    },
    onError: (_e, _v, contexto) => {
      cliente.setQueryData(claveIds(uid), contexto?.anterior);
    },
    onSettled: () => {
      void cliente.invalidateQueries({ queryKey: claveIds(uid) });
      void cliente.invalidateQueries({ queryKey: claveLista(uid) });
    },
  });
}

/** Cuántas personas guardaron MIS negocios (0088). Sin ids no consulta; un fallo es `fallo`, nunca un mapa que parezca «cero». */
export function useConteoFavoritosDeMisNegocios(ids: string[]) {
  const q = useQuery({
    queryKey: ['conteoFavoritosMisNegocios', [...ids].sort().join(',')] as const,
    queryFn: () => contarFavoritosDeMisNegocios(ids),
    enabled: ids.length > 0,
  });
  return { conteos: q.data ?? new Map<string, number>(), cargando: q.isPending && ids.length > 0, fallo: q.isError };
}
