// Hallazgo 3 · Vacía la caché de consultas cuando la sesión termina.
//
// Varias claves —['sugerencias', tipo, orden], ['roomies'], ['afinidad', id]— no
// llevan el id de usuario, así que la caché no distingue de quién son los datos:
// quien iniciaba sesión después en el mismo teléfono veía un instante lo de la
// persona anterior. Vaciarla al salir es más simple y más seguro que intentar
// meter el id en cada clave y que alguna se quede sin él.

import type { QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { alCerrarSesion } from '@/store/useAuthStore';

export function useLimpiarCacheAlCerrarSesion(cliente: QueryClient) {
  useEffect(() => alCerrarSesion(() => cliente.clear()), [cliente]);
}
