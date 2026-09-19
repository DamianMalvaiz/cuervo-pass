import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Filete, Radios, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formateadorHora } from '@/lib/formatoHora';
import type { MensajeLocal } from '@/store/useChatStore';
import { ThemedText } from './themed-text';

interface Props {
  mensaje: MensajeLocal;
  esPropio: boolean;
  /** Reintentar un envío fallido. Sin esto la burbuja sería un callejón. */
  onReintentar?: (mensaje: MensajeLocal) => void;
}

export function BurbujaMensaje({ mensaje, esPropio, onReintentar }: Props) {
  const theme = useTheme();
  const hora = formateadorHora.format(new Date(mensaje.creado_en));
  // END-20 · Tres estados propios, no dos. «En vuelo» y «falló» no son lo
  // mismo que «enviado», y presentarlos igual es lo que obligaba a devolver el
  // texto al campo — que se lee como que el mensaje se borró.
  const enVuelo = mensaje.envio === 'enviando';
  const fallido = mensaje.envio === 'fallido';
  const estadoLeido = esPropio
    ? fallido
      ? ', no se envió, toca para reintentar'
      : enVuelo
        ? ', enviando'
        : mensaje.leido
          ? ', leído'
          : ', enviado'
    : '';

  return (
    <Pressable
      style={[styles.fila, esPropio ? styles.filaPropia : styles.filaAjena]}
      onPress={fallido ? () => onReintentar?.(mensaje) : undefined}
      disabled={!fallido}
      accessible
      accessibilityRole={fallido ? 'button' : 'text'}
      accessibilityLabel={`${esPropio ? 'Tú' : 'Contacto'}: ${mensaje.contenido}, ${hora}${estadoLeido}`}
    >
      <View
        style={[
          styles.burbuja,
          esPropio ? { backgroundColor: theme.text } : { backgroundColor: theme.backgroundElement },
          enVuelo && styles.enVuelo,
          fallido && { borderWidth: Filete.fino, borderColor: theme.error },
        ]}
      >
        <ThemedText themeColor={esPropio ? 'background' : 'text'}>{mensaje.contenido}</ThemedText>
        <View style={styles.pie}>
          <ThemedText
            type="small"
            themeColor={esPropio ? 'background' : 'textSecondary'}
            style={[styles.hora, esPropio && styles.horaPropia]}
          >
            {hora}
          </ThemedText>
          {esPropio && (
            <Ionicons
              name={fallido ? 'alert-circle' : enVuelo ? 'time-outline' : mensaje.leido ? 'checkmark-done' : 'checkmark'}
              size={14}
              color={fallido ? theme.error : mensaje.leido ? theme.background : theme.textSecondary}
            />
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', marginVertical: Spacing.half },
  filaPropia: { justifyContent: 'flex-end' },
  filaAjena: { justifyContent: 'flex-start' },
  burbuja: { maxWidth: '80%', borderRadius: Radios.control, padding: Spacing.two },
  horaPropia: { opacity: 0.75 },
  // Atenuada mientras viaja: dice «todavía no está» sin ocupar una línea.
  enVuelo: { opacity: 0.6 },
  pie: { flexDirection: 'row', alignItems: 'center', gap: Spacing.half, marginTop: Spacing.half, alignSelf: 'flex-end' },
  hora: { fontSize: 11, lineHeight: 14 },
  textoPropioSecundario: { color: 'rgba(18,16,14,0.55)' },
});
