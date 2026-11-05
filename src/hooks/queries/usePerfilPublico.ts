// El perfil público de una persona (la vista `perfiles_publicos`) y la afinidad con quien lo mira. Cada lectura distingue cargando, FALLÓ y «no existe» (END-11), y van por separado:
// que falle el cálculo de afinidad no tumba el perfil (el dato accesorio no tira al principal). La caché entera se vacía al cerrar sesión.

import { useQuery } from '@tanstack/react-query';

import { obtenerAfinidadRoomie, obtenerPerfilPublico } from '@/services/usuarios.service';

export function usePerfilPublico(usuarioId: string | undefined) {
  const q = useQuery({ queryKey: ['perfilPublico', usuarioId ?? ''], queryFn: () => obtenerPerfilPublico(usuarioId as string), enabled: Boolean(usuarioId) });
  return { perfil: q.data ?? null, cargando: q.isPending && Boolean(usuarioId), fallo: q.isError, reintentar: () => void q.refetch() };
}

export function useAfinidadRoomie(usuarioId: string | undefined) {
  const q = useQuery({ queryKey: ['afinidadRoomie', usuarioId ?? ''], queryFn: () => obtenerAfinidadRoomie(usuarioId as string), enabled: Boolean(usuarioId) });
  return { afinidad: q.data ?? null, cargando: q.isPending && Boolean(usuarioId), fallo: q.isError };
}
