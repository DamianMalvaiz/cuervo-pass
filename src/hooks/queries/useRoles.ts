// Roles de usuario · Cuervo 360
//
// Misma forma que `useMiRoomie`: la clave lleva el id de la cuenta, y al cerrar sesión la caché
// entera se vacía (`useLimpiarCacheAlCerrarSesion`), así que una cuenta nunca ve los roles de la
// anterior en el mismo teléfono.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { agregarFuncion, obtenerMisRoles } from '@/services/roles.service';

const clave = (usuarioId: string | undefined) => ['misRoles', usuarioId ?? ''] as const;

export function useMisRoles(usuarioId: string | undefined) {
  const q = useQuery({
    queryKey: clave(usuarioId),
    queryFn: () => obtenerMisRoles(usuarioId as string),
    enabled: Boolean(usuarioId),
  });
  // Tres estados y no dos (END-11): cargando, falló, y lista (que puede ser vacía).
  return {
    roles: q.data ?? [],
    cargando: q.isPending,
    fallo: q.isError,
    reintentar: () => void q.refetch(),
  };
}

export function useAgregarFuncion(usuarioId: string | undefined) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (rol: 'comerciante' | 'arrendador') => agregarFuncion(rol),
    // Se vuelve a pedir en vez de escribir la caché a mano: la fila (estado y origen) la decide
    // el servidor, y no hay por qué adivinarla.
    onSuccess: () => cliente.invalidateQueries({ queryKey: clave(usuarioId) }),
  });
}
