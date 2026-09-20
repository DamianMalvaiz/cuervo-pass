import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppColors, Radios, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

interface Props {
  valor: boolean;
  onCambiar: (valor: boolean) => void;
  etiqueta: string;
  ayuda?: string;
  accessibilityLabel?: string;
}

// Casilla de consentimiento (§29). Nunca viene premarcada: eso es lo que separa
// un consentimiento real de una casilla decorativa, y es lo que la LFPDPPP
// exige para los datos que esta app trata.
//
// Toda el área —casilla, etiqueta y ayuda— es tocable, para cumplir el objetivo
// mínimo de 44 pt sin depender de atinarle al cuadrito.
export function Casilla({ valor, onCambiar, etiqueta, ayuda, accessibilityLabel }: Props) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => onCambiar(!valor)}
      style={styles.fila}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: valor }}
      accessibilityLabel={accessibilityLabel ?? etiqueta}
      accessibilityHint={ayuda}
      hitSlop={6}
    >
      <View
        style={[
          styles.caja,
          { borderColor: valor ? AppColors.sello : theme.border },
          valor && { backgroundColor: AppColors.sello },
        ]}
      >
        {valor && <Ionicons name="checkmark" size={16} color={AppColors.selloTexto} />}
      </View>
      <View style={styles.textos}>
        <ThemedText type="small">{etiqueta}</ThemedText>
        {ayuda && (
          <ThemedText type="small" style={[styles.ayuda, { color: theme.textSecondary }]}>
            {ayuda}
          </ThemedText>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    minHeight: 44,
  },
  caja: {
    width: 22,
    minHeight: 22,
    borderRadius: Radios.casilla,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  textos: { flex: 1, gap: Spacing.half },
  ayuda: { lineHeight: 18 },
});
