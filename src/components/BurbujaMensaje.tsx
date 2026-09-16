import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { ThemedText } from './themed-text';

interface Props {
  contenido: string;
  esMio: boolean;
}

export function BurbujaMensaje({ contenido, esMio }: Props) {
  return (
    <View style={[styles.burbuja, esMio ? styles.mia : styles.ajena]}>
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
  mia: { alignSelf: 'flex-end', backgroundColor: '#208AEF' },
  ajena: { alignSelf: 'flex-start', backgroundColor: '#E0E1E6' },
  textoMio: { color: '#fff' },
});
