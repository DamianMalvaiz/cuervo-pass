import { Ionicons } from '@expo/vector-icons';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { AppColors, Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

interface Props {
  latitud: number;
  longitud: number;
  titulo: string;
  direccion: string;
  /** Solo para pruebas: por defecto sale de la plataforma y de la clave. */
  mapaIntegrado?: boolean;
}

// END-10 · iOS dibuja Apple Maps sin clave. Android dibuja Google Maps, y sin
// clave el MapView pinta un rectángulo gris sin decir por qué. Que no haya mapa
// integrado no es motivo para dejar la ficha sin ubicación: se dice dónde está y
// se delega en la app de mapas del teléfono, que no necesita nuestra clave.
//
// `EXPO_PUBLIC_*` se sustituye al empaquetar, igual que la clave que lee
// `app.config.js`: las dos ven el mismo `.env` en la misma compilación.
export function hayMapaIntegrado(os: string, claveGoogle: string | undefined): boolean {
  return os !== 'android' || Boolean(claveGoogle?.trim());
}

const MAPA_INTEGRADO = hayMapaIntegrado(Platform.OS, process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY);

export function MapaUbicacion({
  latitud,
  longitud,
  titulo,
  direccion,
  mapaIntegrado = MAPA_INTEGRADO,
}: Props) {
  const theme = useTheme();

  if (mapaIntegrado) {
    return (
      <View style={[estilos.marco, { borderColor: theme.border }]}>
        <MapView
          style={estilos.mapa}
          initialRegion={{
            latitude: latitud,
            longitude: longitud,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          zoomEnabled
          scrollEnabled
          rotateEnabled
          zoomControlEnabled
        >
          <Marker coordinate={{ latitude: latitud, longitude: longitud }} title={titulo} />
        </MapView>
      </View>
    );
  }

  const abrir = async () => {
    try {
      await Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${latitud},${longitud}`
      );
    } catch {
      // Sin navegador ni app de mapas no hay nada más que intentar; la dirección
      // sigue a la vista, que es lo que importa.
    }
  };

  return (
    <View style={[estilos.marco, estilos.sustituto, { borderColor: theme.border }]}>
      <Ionicons name="location-outline" size={24} color={AppColors.sello} />
      <ThemedText style={estilos.direccion}>{direccion}</ThemedText>
      <Pressable
        style={estilos.boton}
        onPress={abrir}
        accessibilityRole="button"
        accessibilityLabel="Abrir en Maps"
        accessibilityHint="Abre la ubicación de esta publicación en la app de mapas"
      >
        <ThemedText style={estilos.textoBoton}>Abrir en Maps</ThemedText>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  marco: { borderWidth: Filete.fino, borderRadius: Radios.hoja, overflow: 'hidden' },
  mapa: { height: 220 },
  sustituto: { padding: Spacing.three, gap: Spacing.two, alignItems: 'flex-start' },
  direccion: { ...Texto.cuerpo },
  boton: {
    backgroundColor: AppColors.sello,
    borderRadius: Radios.control,
    paddingHorizontal: Spacing.four,
    minHeight: 44,
    justifyContent: 'center',
  },
  textoBoton: { color: AppColors.selloTexto, ...Texto.pesoFuerte },
});
