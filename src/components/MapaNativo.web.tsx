// En web no hay mapa nativo. `hayMapaIntegrado` ya devuelve false para 'web', así que `MapaUbicacion` muestra la dirección y el enlace a Maps; este
// componente solo existe para que el bundle web no importe `react-native-maps`.
export function MapaNativo(_props: { latitud: number; longitud: number; titulo: string }) {
  return null;
}
