import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { ThemedText } from './themed-text';

interface Props {
  nombreUsuario: string;
  descripcionBusqueda?: string;
  fotoUrl?: string;
  onPress?: () => void;
}

export function TarjetaRooming({ nombreUsuario, descripcionBusqueda, fotoUrl, onPress }: Props) {
  return (
    <Pressable style={styles.tarjeta} onPress={onPress}>
      {fotoUrl ? (
        <View style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarVacio]} />
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
  avatarVacio: { backgroundColor: '#E0E1E6' },
  info: { flex: 1, gap: Spacing.half },
});
