// Consultas del chat · END-18
//
// Lo que esta capa quita de la pantalla, además de la caché:
//
//   · El guardia de respuestas fuera de orden hecho a mano (un `useRef` con un
//     contador de carga). react-query descarta por sí solo la respuesta de una
//     consulta que ya fue reemplazada.
//   · La distinción entre «recarga con spinner» y «recarga silenciosa por
//     Realtime». Invalidar deja `isRefetching` en true y `data` intacta, así que
//     la lista no parpadea ni pierde el scroll — que es justo lo que aquel
//     `mostrarSpinner` intentaba conseguir a mano.

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { claves } from '@/lib/consultas';
import { listarConversaciones, suscribirseAMisChats } from '@/services/mensajes.service';

export function useConversaciones(usuarioId: string | undefined) {
  const cliente = useQueryClient();

  const q = useQuery({
    queryKey: claves.conversaciones(usuarioId ?? ''),
    queryFn: () => listarConversaciones(usuarioId as string),
    enabled: Boolean(usuarioId),
  });

  // Realtime no trae el dato: avisa de que el que hay dejó de valer. Invalidar
  // y dejar que react-query decida cuándo refrescar es más barato que recargar
  // la lista entera por cada mensaje entrante, y no pierde el scroll.
  useEffect(() => {
    if (!usuarioId) return;
    return suscribirseAMisChats(() => {
      void cliente.invalidateQueries({ queryKey: claves.conversaciones(usuarioId) });
    });
  }, [usuarioId, cliente]);

  return {
    conversaciones: q.data ?? [],
    cargando: q.isPending,
    fallo: q.isError ? 'No pudimos cargar tus conversaciones.' : null,
  };
}
