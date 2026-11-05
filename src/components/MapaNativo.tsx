import { StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

// El único archivo que importa `react-native-maps`, un módulo NATIVO. En web lo reemplaza `MapaNativo.web.tsx`: importarlo ahí rompe el export
// (`codegenNativeComponent is not a function`).
export function MapaNativo({ latitud, longitud, titulo }: { latitud: number; longitud: number; titulo: string }) {
  return (
    <MapView
      style={estilos.mapa}
      initialRegion={{ latitude: latitud, longitude: longitud, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
      zoomEnabled
      scrollEnabled
      rotateEnabled
      zoomControlEnabled
    >
      <Marker coordinate={{ latitude: latitud, longitude: longitud }} title={titulo} />
    </MapView>
  );
}

const estilos = StyleSheet.create({
  mapa: { height: 220 },
});
