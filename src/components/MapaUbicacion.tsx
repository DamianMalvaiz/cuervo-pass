import Ionicons from '@expo/vector-icons/Ionicons';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { Sello } from '@/components/ficha/Sello';
import { useTheme } from '@/hooks/use-theme';
import { MapaNativo } from './MapaNativo';
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
  // La web no tiene mapa nativo: ahí siempre se muestra la dirección con el enlace a Maps.
  if (os === 'web') return false;
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
        <MapaNativo latitud={latitud} longitud={longitud} titulo={titulo} />
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
      <Ionicons name="location-outline" size={24} color={theme.bosque} />
      <ThemedText style={estilos.direccion}>{direccion}</ThemedText>
      <Sello onPress={abrir} icono="map-outline" accessibilityLabel="Abrir en Maps">
        Abrir en Maps
      </Sello>
    </View>
  );
}

const estilos = StyleSheet.create({
  marco: { borderWidth: Filete.fino, borderRadius: Radios.hoja, overflow: 'hidden' },
  sustituto: { padding: Spacing.three, gap: Spacing.two, alignItems: 'flex-start' },
  direccion: { ...Texto.cuerpo },
});
