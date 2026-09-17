import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { AppColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formateadorHora } from '@/lib/formatoHora';
import type { Mensaje } from '@/types/database.types';
import { ThemedText } from './themed-text';

interface Props {
  mensaje: Mensaje;
  esPropio: boolean;
}

export function BurbujaMensaje({ mensaje, esPropio }: Props) {
  const theme = useTheme();
  const hora = formateadorHora.format(new Date(mensaje.creado_en));
  const estadoLeido = esPropio ? (mensaje.leido ? ', leído' : ', enviado') : '';

  return (
    <View
      style={[styles.fila, esPropio ? styles.filaPropia : styles.filaAjena]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${esPropio ? 'Tú' : 'Contacto'}: ${mensaje.contenido}, ${hora}${estadoLeido}`}
    >
      <View
        style={[
          styles.burbuja,
          esPropio ? { backgroundColor: AppColors.primary } : { backgroundColor: theme.backgroundElement },
        ]}
      >
        <ThemedText style={esPropio ? styles.textoPropio : undefined}>{mensaje.contenido}</ThemedText>
        <View style={styles.pie}>
          <ThemedText
            type="small"
            style={[styles.hora, esPropio ? styles.textoPropioSecundario : { color: theme.textSecondary }]}
          >
            {hora}
          </ThemedText>
          {esPropio && (
            <Ionicons
              name={mensaje.leido ? 'checkmark-done' : 'checkmark'}
              size={14}
              color={mensaje.leido ? '#fff' : 'rgba(255,255,255,0.7)'}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', marginVertical: Spacing.half },
  filaPropia: { justifyContent: 'flex-end' },
  filaAjena: { justifyContent: 'flex-start' },
  burbuja: { maxWidth: '80%', borderRadius: Spacing.two, padding: Spacing.two },
  textoPropio: { color: '#fff' },
  pie: { flexDirection: 'row', alignItems: 'center', gap: Spacing.half, marginTop: Spacing.half, alignSelf: 'flex-end' },
  hora: { fontSize: 11, lineHeight: 14 },
  textoPropioSecundario: { color: 'rgba(255,255,255,0.7)' },
});
