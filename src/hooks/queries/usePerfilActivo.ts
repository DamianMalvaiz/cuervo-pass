// El perfil que usa la cuenta: estudiante o vendedor (0083).
//
// Decide la barra de pestañas y la primera vista. Tres estados y no dos (END-11): cargando y falló dan `perfil: null`, y quien lo consume decide qué
// enseñar (la barra de siempre, la de estudiante); lo que NO se hace es afirmar «es estudiante» sin saberlo. Cambiar de perfil va al servidor y, solo si
// acepta, se actualiza lo que se ve: no hay cambio «optimista» de algo que la base puede rechazar.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { PerfilActivo } from '@/lib/perfilActivo';
import { cambiarPerfilActivo, obtenerPerfilActivo } from '@/services/usuarios.service';

export const clavePerfilActivo = (usuarioId: string | undefined) => ['perfilActivo', usuarioId ?? ''] as const;

export function usePerfilActivo(usuarioId: string | undefined) {
  const cliente = useQueryClient();
  const q = useQuery({
    queryKey: clavePerfilActivo(usuarioId),
    queryFn: () => obtenerPerfilActivo(usuarioId as string),
    enabled: Boolean(usuarioId),
    // Lo cambia solo esta pantalla (o el alta); no hace falta volver a pedirlo en cada foco.
    staleTime: Infinity,
  });
  const cambiar = useMutation({
    mutationFn: (perfil: PerfilActivo) => cambiarPerfilActivo(perfil),
    onSuccess: (_, perfil) => cliente.setQueryData(clavePerfilActivo(usuarioId), perfil),
  });
  return {
    perfil: (q.data ?? null) as PerfilActivo | null,
    cargando: q.isPending && Boolean(usuarioId),
    fallo: q.isError,
    cambiar: cambiar.mutateAsync,
    cambiando: cambiar.isPending,
  };
}
