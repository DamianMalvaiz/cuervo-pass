import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radios, Spacing, Texto } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const D = Colors.dark;

/**
 * El botón en forma de píldora de la web pública.
 *
 *  · `lima`          relleno lima con texto carbón (el primario, sirve sobre cualquier fondo).
 *  · `contornoClaro` contorno y texto claros: para sobre el carbón del hero, que NO cambia con el modo claro u oscuro.
 *  · `carbon`        relleno carbón con texto lima: para superficies claras.
 *  · `contorno`      contorno y texto del tema: para superficies que sí siguen al modo.
 *
 * Cada variante toma su color del fondo que de verdad tiene detrás (el contraste del lima sobre carbón es 10.4:1; el del lima sobre blanco, 1.68:1, por eso el lima solo es relleno).
 */
export function BotonWeb({
  children,
  onPress,
  variante = 'lima',
  icono,
  accessibilityLabel,
  grande = false,
  compacto = false,
}: {
  children: string;
  onPress?: () => void;
  variante?: 'lima' | 'contornoClaro' | 'carbon' | 'contorno';
  icono?: keyof typeof Ionicons.glyphMap;
  accessibilityLabel?: string;
  grande?: boolean;
  /** Menos relleno a los lados, para barras en pantallas angostas (sigue midiendo 44 de alto). */
  compacto?: boolean;
}) {
  const theme = useTheme();
  const estilo = {
    lima: { fondo: D.lima, texto: D.limaTexto, borde: D.lima },
    contornoClaro: { fondo: 'transparent', texto: D.text, borde: D.text },
    carbon: { fondo: D.background, texto: D.lima, borde: D.background },
    contorno: { fondo: 'transparent', texto: theme.text, borde: theme.text },
  }[variante];

  return (
    <Pulsable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? children}
      style={[estilos.base, grande && estilos.grande, compacto && estilos.compacto, { backgroundColor: estilo.fondo, borderColor: estilo.borde }]}
    >
      <View style={estilos.contenido}>
        {icono ? <Ionicons name={icono} size={grande ? 22 : 18} color={estilo.texto} /> : null}
        <ThemedText style={[Texto.sello, { color: estilo.texto }]}>{children}</ThemedText>
      </View>
    </Pulsable>
  );
}

const estilos = StyleSheet.create({
  base: { minHeight: 48, paddingHorizontal: Spacing.four, borderRadius: Radios.full, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  grande: { minHeight: 56, paddingHorizontal: Spacing.five },
  compacto: { minHeight: 44, paddingHorizontal: Spacing.three },
  contenido: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
