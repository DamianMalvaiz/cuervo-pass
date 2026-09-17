// Mapbox Geocoding API v6 (sección 4/25 del doc maestro). 100k requests gratis/mes.

const TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;

export interface Coordenadas {
  lat: number;
  lng: number;
}

// Nunca truena el flujo de publicar/registrarse si Mapbox falla (sección 17):
// una publicación sin coordenadas sigue siendo válida, solo no muestra distancia.
export async function geocodificarDireccion(direccion: string): Promise<Coordenadas | null> {
  if (!TOKEN) {
    console.warn('EXPO_PUBLIC_MAPBOX_TOKEN no configurado — se omite el geocoding');
    return null;
  }
  try {
    const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(
      direccion
    )}&access_token=${TOKEN}&limit=1&language=es`;
    const respuesta = await fetch(url);
    if (!respuesta.ok) return null;
    const datos = await respuesta.json();
    const feature = datos.features?.[0];
    if (!feature) return null;
    const [lng, lat] = feature.geometry.coordinates;
    return { lat, lng };
  } catch (e) {
    console.warn('Geocoding falló:', e);
    return null;
  }
}
