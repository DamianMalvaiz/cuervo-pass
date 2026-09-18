import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

interface Props {
  nombreUsuario: string;
  descripcionBusqueda?: string;
  /** URL ya FIRMADA: el bucket es privado (§14). */
  fotoUrl?: string | null;
  /** Similitud de coseno 0–1 que devuelve sugerencias_roomies. */
  afinidad?: number | null;
  onPress?: () => void;
}

// La afinidad se muestra como etiqueta, no como número crudo: "0.8137" no le
// dice nada a nadie, y presumir un decimal invita a la pregunta "¿y por qué
// 0.81 y no 0.79?", que no tiene buena respuesta.
function etiquetaAfinidad(afinidad: number): string {
  if (afinidad >= 0.75) return 'Afinidad alta';
  if (afinidad >= 0.55) return 'Afinidad media';
  return 'Afinidad baja';
}

export function TarjetaRoomie({ nombreUsuario, descripcionBusqueda, fotoUrl, afinidad, onPress }: Props) {
  const theme = useTheme();
  const textoAfinidad = afinidad != null ? etiquetaAfinidad(afinidad) : null;

  return (
    <Pressable
      style={styles.tarjeta}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={[nombreUsuario, descripcionBusqueda, textoAfinidad].filter(Boolean).join(', ')}
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
        {textoAfinidad && (
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {textoAfinidad}
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
