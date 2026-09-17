import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

interface Props {
  nombreUsuario: string;
  descripcionBusqueda?: string;
  fotoUrl?: string;
  onPress?: () => void;
}

export function TarjetaRooming({ nombreUsuario, descripcionBusqueda, fotoUrl, onPress }: Props) {
  const theme = useTheme();
  return (
    <Pressable
      style={styles.tarjeta}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${nombreUsuario}${descripcionBusqueda ? `, ${descripcionBusqueda}` : ''}`}
    >
      {fotoUrl ? (
        <Image source={{ uri: fotoUrl }} style={styles.avatar} contentFit="cover" />
      ) : (
        <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]} />
      )}
      <View style={styles.info}>
        <ThemedText type="smallBold">{nombreUsuario}</ThemedText>
        {descripcionBusqueda && (
          <ThemedText type="small" numberOfLines={2}>
            {descripcionBusqueda}
          </ThemedText>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tarjeta: { flexDirection: 'row', gap: Spacing.three, padding: Spacing.two, alignItems: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  info: { flex: 1, gap: Spacing.half },
});
