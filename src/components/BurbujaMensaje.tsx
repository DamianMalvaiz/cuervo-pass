import { StyleSheet, View } from 'react-native';

import { AppColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from './themed-text';

interface Props {
  contenido: string;
  esMio: boolean;
}

export function BurbujaMensaje({ contenido, esMio }: Props) {
  const theme = useTheme();
  return (
    <View
      style={[styles.burbuja, esMio ? styles.mia : { backgroundColor: theme.backgroundSelected, alignSelf: 'flex-start' }]}
      accessibilityRole="text"
      accessibilityLabel={`${esMio ? 'Tú' : 'Contacto'}: ${contenido}`}
    >
      <ThemedText style={esMio ? styles.textoMio : undefined}>{contenido}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  burbuja: {
    maxWidth: '80%',
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    marginVertical: Spacing.half,
  },
  mia: { alignSelf: 'flex-end', backgroundColor: AppColors.primary },
  textoMio: { color: '#fff' },
});
