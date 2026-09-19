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

import { useQuery } from '@tanstack/react-query';

import { claves } from '@/lib/consultas';
import { textoDeError } from '@/lib/registro';
import {
  contarContactosRecibidos,
  listarMisPublicaciones,
  obtenerPublicacionPublica,
  obtenerSugerencias,
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

export function useMisPublicaciones(usuarioId: string | undefined) {
  const q = useQuery({
    queryKey: claves.misPublicaciones(usuarioId ?? ''),
    queryFn: () => listarMisPublicaciones(usuarioId as string),
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
