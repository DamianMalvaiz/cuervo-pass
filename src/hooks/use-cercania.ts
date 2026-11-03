import { usePublicacionesEnCaja } from '@/hooks/queries/useExplorar';
import { cajaDe, ordenarPorCercania } from '@/lib/cerca';
import { UNIVERSIDADES } from '@/lib/universidades';
import { usePerfilStore } from '@/store/usePerfilStore';

// Tantos como caben en la caja; si la consulta llega a este tope puede haber más y se dice.
export const LIMITE_CERCANIA = 150;

/**
 * Los lugares cerca de una universidad, del más cercano al más lejano (los comparten `/cerca` y la franja de «Para ti»). El punto es la universidad de la cuenta, si la tiene con coordenadas; si no, la primera de la lista de Cuervo 360, y
 * `punto.nombre` dice cuál es (nunca se inventa un punto). El filtro por zona va en el servidor; el círculo exacto y el orden se calculan sobre lo que la caja trajo. Cargando, FALLÓ y «nada en ese radio» son estados distintos.
 */
export function useCercania(radioKm: number) {
  const perfil = usePerfilStore((s) => s.perfil);
  const propio = perfil?.latitud_universidad != null && perfil?.longitud_universidad != null;
  const base = UNIVERSIDADES[0];
  const punto = propio
    ? { nombre: perfil.universidad?.trim() || 'tu universidad', lat: perfil.latitud_universidad as number, lng: perfil.longitud_universidad as number }
    : { nombre: base.nombre, lat: base.lat, lng: base.lng };
  const { publicaciones, cargando, fallo, reintentar } = usePublicacionesEnCaja(cajaDe(punto.lat, punto.lng, radioKm), LIMITE_CERCANIA);
  const lista = ordenarPorCercania(publicaciones, punto.lat, punto.lng, radioKm);
  return { punto, lista, cargando, fallo, reintentar, posiblementeMas: publicaciones.length >= LIMITE_CERCANIA };
}
