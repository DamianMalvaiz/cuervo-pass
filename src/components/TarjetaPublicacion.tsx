import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { ThemedText } from './themed-text';

interface Props {
  precio: number;
  direccion: string;
  fotoUrl?: string;
  distanciaKm?: number;
  onPress?: () => void;
}

const formateadorPrecio = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

export function TarjetaPublicacion({ precio, direccion, fotoUrl, distanciaKm, onPress }: Props) {
  return (
    <Pressable style={styles.tarjeta} onPress={onPress}>
      {fotoUrl ? (
        <Image source={{ uri: fotoUrl }} style={styles.foto} contentFit="cover" />
      ) : (
        <View style={[styles.foto, styles.fotoVacia]} />
      )}
      <View style={styles.info}>
        <ThemedText type="smallBold">{`$${formateadorPrecio.format(precio)}/mes`}</ThemedText>
        <ThemedText type="small">{direccion}</ThemedText>
        {distanciaKm !== undefined && <ThemedText type="small">{distanciaKm.toFixed(1)} km de la universidad</ThemedText>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tarjeta: { flexDirection: 'row', gap: Spacing.three, padding: Spacing.two, borderRadius: Spacing.two },
  foto: { width: 88, height: 88, borderRadius: Spacing.two },
  fotoVacia: { backgroundColor: '#E0E1E6' },
  info: { flex: 1, justifyContent: 'center', gap: Spacing.half },
});
