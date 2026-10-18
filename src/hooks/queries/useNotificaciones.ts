// Centro de notificaciones · 0072. Las claves llevan la cuenta y, al cerrar sesión, la caché entera se vacía (como Favoritos).
// El conteo se refresca al volver a la app y cada minuto: es una insignia, no un canal en vivo; para lo urgente está el push.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  contarAvisosNoLeidos,
  listarAvisos,
  marcarAvisoLeido,
  marcarTodosLeidos,
} from '@/services/notificaciones.service';

const claveLista = (uid: string | undefined) => ['avisos', uid ?? ''] as const;
const claveConteo = (uid: string | undefined) => ['avisosNoLeidos', uid ?? ''] as const;

export function useAvisos(uid: string | undefined) {
  const q = useQuery({ queryKey: claveLista(uid), queryFn: listarAvisos, enabled: Boolean(uid) });
  return {
    avisos: q.data ?? [],
    cargando: q.isPending && Boolean(uid),
    fallo: q.isError,
    reintentar: () => void q.refetch(),
  };
}

/** `null` = no se sabe (cargando o falló): la insignia no se pinta, que es distinto de «0 sin leer». */
export function useAvisosNoLeidos(uid: string | undefined): number | null {
  const q = useQuery({
    queryKey: claveConteo(uid),
    queryFn: contarAvisosNoLeidos,
    enabled: Boolean(uid),
    refetchInterval: 60_000,
  });
  return q.data ?? null;
}

export function useMarcarAvisos(uid: string | undefined) {
  const cliente = useQueryClient();
  const refrescar = () => {
    void cliente.invalidateQueries({ queryKey: claveLista(uid) });
    void cliente.invalidateQueries({ queryKey: claveConteo(uid) });
  };
  const uno = useMutation({ mutationFn: (id: string) => marcarAvisoLeido(id), onSettled: refrescar });
  const todos = useMutation({ mutationFn: () => marcarTodosLeidos(), onSettled: refrescar });
  return { marcarUno: uno.mutate, marcarTodos: todos.mutate, marcandoTodos: todos.isPending };
}
