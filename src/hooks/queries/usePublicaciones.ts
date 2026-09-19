// Consultas de publicaciones · END-18
//
// Lo que estos hooks añaden sobre `useState` + `useFocusEffect`, que es lo que
// había: caché por clave, deduplicación entre consumidores, reintento con
// backoff, y un estado de error que no se confunde con una lista vacía.
//
// Devuelven una forma ESTABLE —`datos` nunca es undefined, `fallo` es string o
// null— para que las pantallas no tengan que repetir `data ?? []` ni distinguir
// `isLoading` de `isPending` en cada sitio. Lo que la pantalla necesita saber
// es: qué pinto, estoy cargando, y falló.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { claves } from '@/lib/consultas';
import { textoDeError } from '@/lib/registro';
import {
  cambiarEstadoPublicacion,
  obtenerAfinidad,
  contarContactosRecibidos,
  listarMisPublicaciones,
  obtenerPublicacionPublica,
  obtenerSugerencias,
  reintentarGeocodingPendiente,
} from '@/services/publicaciones.service';
import type { PublicacionSugerida } from '@/types/database.types';

const MENSAJE_FALLO = 'No pudimos consultar. Revisa tu conexión y desliza para reintentar.';

export function useSugerencias(tipo: string | null) {
  const q = useQuery({
    queryKey: claves.sugerencias(tipo),
    // El tipo entra en la CLAVE, no en un filtro del cliente: así cada chip
    // tiene su propia caché y volver al anterior es instantáneo. El filtrado en
    // el cliente sobre una página ya truncada es END-17, y se cierra en B.3.
    queryFn: () => obtenerSugerencias(30),
  });

  return {
    datos: (q.data?.datos ?? []) as PublicacionSugerida[],
    conAfinidad: q.data?.conAfinidad ?? 0,
    total: q.data?.total ?? 0,
    cargando: q.isPending,
    refrescando: q.isRefetching,
    fallo: q.isError ? MENSAJE_FALLO : null,
    refrescar: q.refetch,
    // Marca de emisión: la hora del dato que se está viendo, no la de ahora.
    // Con caché esas dos dejan de coincidir, y el membrete diría una hora que
    // no corresponde a lo que hay en pantalla.
    emitido: q.dataUpdatedAt ? new Date(q.dataUpdatedAt) : null,
  };
}

export function usePublicacion(id: string | undefined) {
  const q = useQuery({
    queryKey: claves.publicacion(id ?? ''),
    queryFn: () => obtenerPublicacionPublica(id as string),
    // Sin id no hay nada que pedir. Sin esto se dispararía una consulta a
    // `publicacion/undefined` en el primer render de una ruta dinámica.
    enabled: Boolean(id),
  });

  return {
    publicacion: q.data ?? null,
    cargando: q.isPending,
    // Se distingue «no existe» de «falló», que es END-11: un `null` legítimo no
    // puede presentarse igual que una caída de red.
    fallo: q.isError ? textoDeError(q.error) : null,
    reintentar: q.refetch,
  };
}

/**
 * La afinidad de una publicación, del servidor · END-21
 *
 * Consulta aparte y no parte de `usePublicacion` porque su clave es distinta:
 * la ficha es la misma para todos, la afinidad depende de QUIÉN pregunta. Con
 * una sola clave, dos cuentas en el mismo dispositivo compartirían caché y una
 * vería el ajuste de la otra.
 */
export function useAfinidad(id: string | undefined) {
  const q = useQuery({
    queryKey: ['afinidad', id ?? ''],
    queryFn: () => obtenerAfinidad(id as string),
    enabled: Boolean(id),
  });
  return q.data ?? null;
}

export function useMisPublicaciones(usuarioId: string | undefined) {
  const q = useQuery({
    queryKey: claves.misPublicaciones(usuarioId ?? ''),
    queryFn: async () => {
      const mias = await listarMisPublicaciones(usuarioId as string);
      // §27 · v3 prometía un reintento del geocoding «en segundo plano» y no
      // había nada que lo hiciera. Aquí sí: las publicaciones guardadas sin
      // coordenadas se reintentan una vez al abrir la pantalla. Vive dentro de
      // la consulta y no en un efecto aparte porque forma parte de «cargar mis
      // publicaciones»: partirlo en dos dejaría una ventana en la que la lista
      // ya está pintada con las coordenadas viejas.
      const resueltas = await reintentarGeocodingPendiente(mias);
      return resueltas > 0 ? listarMisPublicaciones(usuarioId as string) : mias;
    },
    enabled: Boolean(usuarioId),
  });

  return {
    datos: q.data ?? [],
    cargando: q.isPending,
    refrescando: q.isRefetching,
    fallo: q.isError ? MENSAJE_FALLO : null,
    refrescar: q.refetch,
  };
}

export function useContactosRecibidos(habilitado: boolean) {
  const q = useQuery({
    queryKey: claves.contactosRecibidos(),
    queryFn: () => contarContactosRecibidos(),
    enabled: habilitado,
  });
  return q.data ?? new Map<string, number>();
}

/**
 * Activar o desactivar una publicación propia.
 *
 * Invalida las tres consultas que dependen de ese estado. Sin esto, desactivar
 * una publicación la dejaría visible en la lista hasta el siguiente refresco —y
 * con `staleTime` de 30 s, «el siguiente refresco» puede tardar—, que es
 * exactamente la clase de dato viejo que una caché mal invalidada produce.
 */
export function useCambiarEstadoPublicacion(usuarioId: string | undefined) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ({ id, activa }: { id: string; activa: boolean }) =>
      cambiarEstadoPublicacion(id, activa),
    onSuccess: (_datos, { id }) => {
      void cliente.invalidateQueries({ queryKey: claves.misPublicaciones(usuarioId ?? '') });
      void cliente.invalidateQueries({ queryKey: claves.publicacion(id) });
      // Las sugerencias de TODOS los tipos: una publicación desactivada deja de
      // ser candidata en cualquiera de los chips.
      void cliente.invalidateQueries({ queryKey: ['sugerencias'] });
    },
  });
}
