// Espejo en JS de la función SQL distancia_km() (sección 7) — misma fórmula
// de Haversine, para calcular distancia en el cliente sin ida y vuelta al servidor.
export function calcularDistanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // radio de la Tierra en km
  const radianes = (grados: number) => (grados * Math.PI) / 180;
  const dLat = radianes(lat2 - lat1);
  const dLon = radianes(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(radianes(lat1)) * Math.cos(radianes(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
