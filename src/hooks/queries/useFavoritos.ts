// Favoritos · Cuervo 360
//
// Dos consultas con propósitos distintos: los IDS (barato, lo piden todos los corazones de una pantalla)
// y la LISTA (publicaciones completas, solo la pestaña). Alternar un corazón toca los ids al instante y
// reconsulta la lista después. Las claves llevan el id de la cuenta y, al cerrar sesión, la caché entera
// se vacía: una cuenta nunca ve los favoritos de la anterior en el mismo teléfono.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  contarFavoritos,
  guardarFavorito,
  listarMisFavoritos,
  listarMisFavoritosIds,
  quitarFavorito,
} from '@/services/favoritos.service';

const claveIds = (usuarioId: string | undefined) => ['favoritosIds', usuarioId ?? ''] as const;
const claveLista = (usuarioId: string | undefined) => ['favoritos', usuarioId ?? ''] as const;

export function useMisFavoritosIds(usuarioId: string | undefined) {
  const q = useQuery({
    queryKey: claveIds(usuarioId),
    queryFn: () => listarMisFavoritosIds(usuarioId as string),
    enabled: Boolean(usuarioId),
  });
  // Tres estados y no dos (END-11): `cargando` no es «no hay favoritos».
  return { ids: new Set(q.data ?? []), cargando: q.isPending, fallo: q.isError };
}

export function useMisFavoritos(usuarioId: string | undefined) {
  const q = useQuery({
    queryKey: claveLista(usuarioId),
    queryFn: () => listarMisFavoritos(usuarioId as string),
    enabled: Boolean(usuarioId),
  });
  return {
    publicaciones: q.data?.publicaciones ?? [],
    noDisponibles: q.data?.noDisponibles ?? 0,
    cargando: q.isPending,
    fallo: q.isError,
    refrescando: q.isRefetching,
    reintentar: () => void q.refetch(),
  };
}

/**
 * Cuántas personas guardaron cada publicación de `ids`. Es una señal secundaria: mientras carga o si
 * falla, el mapa viene VACÍO y quien lo usa no pinta nada, en vez de afirmar un cero.
 */
export function useConteoFavoritos(ids: string[]) {
  const q = useQuery({
    queryKey: ['conteoFavoritos', [...ids].sort().join(',')] as const,
    queryFn: () => contarFavoritos(ids),
    enabled: ids.length > 0,
  });
  return { conteos: q.data ?? new Map<string, number>(), cargando: q.isPending && ids.length > 0, fallo: q.isError };
}

export function useAlternarFavorito(usuarioId: string | undefined) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ({ publicacionId, guardar }: { publicacionId: string; guardar: boolean }) =>
      guardar
        ? guardarFavorito(usuarioId as string, publicacionId)
        : quitarFavorito(usuarioId as string, publicacionId),

    // Actualización optimista: el corazón responde al instante y, si el servidor falla, VUELVE. La
    // lista que había se guarda para poder restaurarla exactamente.
    onMutate: async ({ publicacionId, guardar }) => {
      await cliente.cancelQueries({ queryKey: claveIds(usuarioId) });
      const anterior = cliente.getQueryData<string[]>(claveIds(usuarioId));
      const base = (anterior ?? []).filter((id) => id !== publicacionId);
      cliente.setQueryData(claveIds(usuarioId), guardar ? [publicacionId, ...base] : base);
      return { anterior };
    },
    onError: (_error, _vars, contexto) => {
      cliente.setQueryData(claveIds(usuarioId), contexto?.anterior);
    },
    // Pase lo que pase, se vuelve a pedir lo que dice el servidor: es la única verdad.
    onSettled: () => {
      void cliente.invalidateQueries({ queryKey: claveIds(usuarioId) });
      void cliente.invalidateQueries({ queryKey: claveLista(usuarioId) });
      // El número de personas que la guardaron cambia con cada corazón.
      void cliente.invalidateQueries({ queryKey: ['conteoFavoritos'] });
    },
  });
}
