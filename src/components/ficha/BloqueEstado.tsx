import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Filete, Radios, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Un estado con forma de campo vacío del documento, no un párrafo suelto.
 *
 * Una lista vacía con una frase flotando en la esquina se lee como que la app se
 * quedó a medias. Un recuadro con su versalita se lee como una casilla del
 * formulario que todavía no se llenó — que es exactamente lo que pasa. La
 * diferencia entre "esto falló" y "esto aún no tiene datos" la da la forma,
 * antes que el texto.
 */
export function BloqueEstado({
  etiqueta,
  mensaje,
  icono,
  tono = 'neutro',
}: {
  etiqueta: string;
  mensaje: string;
  icono: keyof typeof Ionicons.glyphMap;
  /** `alerta` para un fallo; `neutro` para un vacío legítimo. */
  tono?: 'neutro' | 'alerta';
}) {
  const theme = useTheme();
  const color = tono === 'alerta' ? theme.error : theme.textSecondary;

  return (
    <View
      style={[
        estilos.bloque,
        { borderColor: tono === 'alerta' ? theme.error : theme.border, backgroundColor: theme.backgroundElement },
      ]}
      accessibilityLiveRegion="polite"
    >
      <Ionicons name={icono} size={22} color={color} />
      <ThemedText type="etiqueta" style={{ color }}>
        {etiqueta}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={estilos.mensaje}>
        {mensaje}
      </ThemedText>
    </View>
  );
}

const estilos = StyleSheet.create({
  bloque: {
    borderWidth: Filete.fino,
    borderRadius: Radios.hoja,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  mensaje: { textAlign: 'center', lineHeight: 20 },
});
