// TODO (Semana 4): Mapbox Geocoding API v6 (ver sección 4/25 del doc maestro).
// 100k requests gratis/mes. Token en EXPO_PUBLIC_MAPBOX_TOKEN (.env.example).

export interface Coordenadas {
  lat: number;
  lng: number;
}

export async function geocodificarDireccion(_direccion: string): Promise<Coordenadas | null> {
  throw new Error('geocodificarDireccion no implementado todavía — Semana 4');
}
