// Coordenadas verificadas a mano (no geocoding en vivo) — nombres de universidad
// como "UTVT" fallan al geocodificarse como texto libre (Mapbox los confunde con
// lugares no relacionados). Mejor una lista curada, extensible con el tiempo.
export interface Universidad {
  id: string;
  nombre: string;
  lat: number;
  lng: number;
}

export const UNIVERSIDADES: Universidad[] = [
  {
    id: 'utvt',
    // Carretera del Departamento del D.F. km 7.5, Santa María Atarasquillo, Lerma, Edo. Méx.
    nombre: 'Universidad Tecnológica del Valle de Toluca (UTVT)',
    lat: 19.32568,
    lng: -99.458244,
  },
];

export const OPCION_OTRA_UNIVERSIDAD = 'otra';
