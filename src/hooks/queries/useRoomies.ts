// Consultas de roomies · END-18
//
// Dos consultas que la pantalla pedía en un `Promise.all` dentro de un
// `useFocusEffect`: la lista de sugeridos y la ficha propia. Separarlas tiene
// una consecuencia concreta y buena — guardar la ficha propia invalida solo la
// ficha propia, y la lista de sugeridos, que es la cara, no se vuelve a pedir.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { claves } from '@/lib/consultas';
import { guardarMiRoomie, listarRoomiesSugeridos, obtenerMiRoomie } from '@/services/roomies.service';

export function useRoomiesSugeridos(habilitado: boolean) {
  const q = useQuery({
    queryKey: claves.roomies(),
    queryFn: () => listarRoomiesSugeridos(),
    enabled: habilitado,
  });
  return {
    roomies: q.data ?? [],
    cargando: q.isPending,
    fallo: q.isError ? 'No pudimos cargar los roomies.' : null,
  };
}

export function useMiRoomie(usuarioId: string | undefined) {
  const q = useQuery({
    queryKey: ['miRoomie', usuarioId ?? ''] as const,
    queryFn: () => obtenerMiRoomie(usuarioId as string),
    enabled: Boolean(usuarioId),
  });
  return { miRoomie: q.data ?? null, cargando: q.isPending };
}

export function useGuardarMiRoomie(usuarioId: string | undefined) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (datos: { descripcionBusqueda: string; estado: 'activo' | 'cerrado' }) =>
      guardarMiRoomie(usuarioId as string, datos),
    onSuccess: (actualizado) => {
      // Se escribe el resultado en la caché en vez de invalidar: la respuesta ya
      // ES la fila actualizada, así que volver a pedirla sería un viaje de ida y
      // vuelta para obtener lo que ya está en la mano.
      cliente.setQueryData(['miRoomie', usuarioId ?? ''], actualizado);
      // La lista de sugeridos sí cambia: activar la búsqueda propia cambia quién
      // aparece para los demás, y el orden depende del vector recién guardado.
      void cliente.invalidateQueries({ queryKey: claves.roomies() });
    },
  });
}
