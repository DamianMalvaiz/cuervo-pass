import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { Radios, Spacing, Texto } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * El botón PRIMARIO de la app (guardar, entrar, crear cuenta, reintentar).
 *
 * Cuervo 360: relleno lima con texto carbón (10.4:1 en los dos modos). El nombre
 * viene del sistema anterior, donde este botón era el sello ámbar; EL sello
 * —la única acción que compromete algo— ahora es otra cosa, con su propio token
 * (`theme.sello`), y no se parece a este a propósito: si lo hiciera dejaría de
 * señalar «esto compromete». Ver `BotonVerContacto`.
 *
 * El lima solo sirve de RELLENO: sobre blanco da 1.68:1 y no vale para texto ni
 * para iconos. La variante de contorno no tiene relleno debajo: su fondo es el
 * de la app, y ahí el texto va en el acento del tema, medido en cada modo. Cada
 * variante toma su color del fondo que de verdad tiene detrás.
 */
export function Sello({
  children,
  onPress,
  icono,
  cargando = false,
  deshabilitado = false,
  variante = 'sello',
  accessibilityLabel,
}: {
  children: string;
  onPress?: () => void;
  icono?: keyof typeof Ionicons.glyphMap;
  cargando?: boolean;
  deshabilitado?: boolean;
  /** `contorno` para la acción secundaria: mismo peso, sin gastar la tinta. */
  variante?: 'sello' | 'contorno';
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const inactivo = deshabilitado || cargando;
  const esSello = variante === 'sello';
  // Relleno lima → carbón encima (10.4:1). Contorno → el acento del tema, que ya
  // está medido contra el fondo de cada modo (7.0:1 claro, 10.4:1 oscuro).
  const colorTexto = esSello ? theme.limaTexto : theme.acento;

  return (
    <Pulsable
      onPress={inactivo ? undefined : onPress}
      disabled={inactivo}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? children}
      accessibilityState={{ disabled: inactivo, busy: cargando }}
      // Sin sombras: Android ignora `shadowColor` y este mundo separa con filete. La respuesta al toque la da `Pulsable` (escala y opacidad, y respeta
      // «reducir movimiento»), igual que el resto de la app; antes solo bajaba la opacidad y se sentía distinto.
      style={[
        estilos.base,
        esSello ? [estilos.relleno, { backgroundColor: theme.lima }] : [estilos.contorno, { borderColor: theme.acento }],
        inactivo && estilos.inactivo,
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={colorTexto} />
      ) : (
        <View style={estilos.contenido}>
          {icono && <Ionicons name={icono} size={18} color={colorTexto} />}
          <ThemedText style={[estilos.texto, { color: colorTexto }]}>{children}</ThemedText>
        </View>
      )}
    </Pulsable>
  );
}

const estilos = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: Radios.control,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  relleno: {},
  contorno: { backgroundColor: 'transparent', borderWidth: 2 },
  inactivo: { opacity: 0.45 },
  contenido: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  texto: Texto.sello,
});
