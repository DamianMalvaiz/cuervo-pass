import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
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
  const theme = useTheme();
  const precioTexto = `$${formateadorPrecio.format(precio)}/mes`;
  const distanciaTexto = distanciaKm !== undefined ? `, a ${distanciaKm.toFixed(1)} km de la universidad` : '';

  return (
    <Pressable
      style={styles.tarjeta}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${precioTexto}, ${direccion}${distanciaTexto}`}
    >
      {fotoUrl ? (
        <Image source={{ uri: fotoUrl }} style={styles.foto} contentFit="cover" />
      ) : (
        <View style={[styles.foto, { backgroundColor: theme.backgroundSelected }]} />
      )}
      <View style={styles.info}>
        <ThemedText type="smallBold">{precioTexto}</ThemedText>
        <ThemedText type="small">{direccion}</ThemedText>
        {distanciaKm !== undefined && <ThemedText type="small">{distanciaKm.toFixed(1)} km de la universidad</ThemedText>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tarjeta: { flexDirection: 'row', gap: Spacing.three, padding: Spacing.two, borderRadius: Spacing.two },
  foto: { width: 88, height: 88, borderRadius: Spacing.two },
  info: { flex: 1, justifyContent: 'center', gap: Spacing.half },
});
