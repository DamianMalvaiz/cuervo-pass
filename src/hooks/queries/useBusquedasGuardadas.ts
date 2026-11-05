// Búsquedas guardadas · 0093. Las claves llevan la cuenta; al cerrar sesión la caché entera se vacía. Cargando, FALLÓ y «no hay ninguna» son estados distintos (END-11).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { borrarBusqueda, guardarBusqueda, listarBusquedasGuardadas } from '@/services/busquedas.service';

const clave = (uid: string | undefined) => ['busquedasGuardadas', uid ?? ''] as const;

export function useBusquedasGuardadas(uid: string | undefined) {
  const q = useQuery({ queryKey: clave(uid), queryFn: listarBusquedasGuardadas, enabled: Boolean(uid) });
  return { busquedas: q.data ?? [], cargando: q.isPending && Boolean(uid), fallo: q.isError, reintentar: () => void q.refetch() };
}

export function useGuardarBusqueda(uid: string | undefined) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ({ nombre, filtros }: { nombre: string; filtros: Record<string, string> }) => guardarBusqueda(uid as string, nombre, filtros),
    onSuccess: () => void cliente.invalidateQueries({ queryKey: clave(uid) }),
  });
}

export function useBorrarBusqueda(uid: string | undefined) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => borrarBusqueda(id),
    onSuccess: () => void cliente.invalidateQueries({ queryKey: clave(uid) }),
  });
}
