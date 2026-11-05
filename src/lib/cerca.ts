// «Cerca de aquí»: los lugares publicados cerca de un punto (la universidad), del más cercano al más lejano.
//
// La vista pública solo da coordenadas REDONDEADAS (~1 km, `latitud_aprox`): la distancia es aproximada y se dice así. El filtro por zona se aplica en el SERVIDOR (una caja de latitud y longitud, invariante 5);
// el círculo exacto y el orden se calculan aquí sobre lo que la caja ya trajo. Los tiempos son estimaciones en LÍNEA RECTA (sin calles ni tráfico) y se rotulan así.

import { calcularDistanciaKm } from '@/lib/distancia';

export const RADIOS_KM = [1, 3, 5] as const;
const KM_POR_GRADO = 111.32;
// Velocidades de la pantalla de «Cómo llegar»: a pie, en bici.
const KMH_A_PIE = 5;
const KMH_EN_BICI = 15;

export interface Caja {
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
}

/** El rectángulo que contiene al círculo de `radioKm` alrededor del punto. El círculo cabe dentro: nada que esté a ese radio queda fuera. */
export function cajaDe(lat: number, lng: number, radioKm: number): Caja {
  const dLat = radioKm / KM_POR_GRADO;
  const dLng = radioKm / (KM_POR_GRADO * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  return { latMin: lat - dLat, latMax: lat + dLat, lngMin: lng - dLng, lngMax: lng + dLng };
}

export interface ConDistancia<T> {
  item: T;
  km: number;
}

/** Deja los que están dentro del radio (los que no traen coordenadas no se pueden ubicar y se omiten) y los ordena del más cercano al más lejano. */
export function ordenarPorCercania<T extends { latitud_aprox: number | null; longitud_aprox: number | null }>(items: T[], lat: number, lng: number, radioKm: number): ConDistancia<T>[] {
  const fuera = (v: number | null): v is number => v !== null;
  return items
    .flatMap((item) => (fuera(item.latitud_aprox) && fuera(item.longitud_aprox) ? [{ item, km: calcularDistanciaKm(lat, lng, item.latitud_aprox, item.longitud_aprox) }] : []))
    .filter((x) => x.km <= radioKm)
    .sort((a, b) => a.km - b.km);
}

const minutos = (km: number, kmh: number) => Math.max(1, Math.round((km / kmh) * 60));

/**
 * «a menos de 1 km · ~6 min a pie»: las ubicaciones públicas se redondean a ~1 km, así que decir «0.5 km» sería una precisión que no existe (y varios lugares del mismo barrio saldrían con la misma cifra «exacta»).
 * Por eso la distancia va en kilómetros enteros («menos de 1», «~2»); el tiempo se calcula de ella. Más de 3 km ya no se ofrece a pie.
 */
export function textoDeCercania(km: number): string {
  const dist = km < 1 ? 'a menos de 1 km' : `a ~${Math.round(km)} km`;
  return km <= 3 ? `${dist} · ~${minutos(km, KMH_A_PIE)} min a pie` : `${dist} · ~${minutos(km, KMH_EN_BICI)} min en bici`;
}
