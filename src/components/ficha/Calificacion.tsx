import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Filete, Radios, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * La casilla de la calificación.
 *
 * Es la pieza que define el mundo. Un kardex mexicano pone la calificación en
 * una casilla enmarcada con su etiqueta encima, y cualquiera que haya pasado por
 * una universidad pública lee "9.4" sin que nadie se lo explique. El motor de
 * sugerencias produce un score en [0,1]; aquí se presenta en la escala que este
 * público ya sabe interpretar.
 *
 * Vive DENTRO de un recuadro con su etiqueta, alineada con las demás fichas de
 * la lista. Esa es la diferencia entre un documento y el widget de tablero de
 * "número grande, etiqueta chica" que cualquier app entrega: la cifra no flota,
 * ocupa una casilla, y la casilla forma columna al recorrer la lista.
 */
export function Calificacion({
  score,
  tamano = 'lista',
  etiqueta = 'AFINIDAD',
}: {
  /** El score del motor, en [0,1]. Se presenta como calificación sobre 10. */
  score: number | null | undefined;
  tamano?: 'lista' | 'ficha';
  etiqueta?: string;
}) {
  const theme = useTheme();
  const esFicha = tamano === 'ficha';

  // Sin score no se inventa un número: la casilla se muestra vacía, como un
  // campo del formulario que nadie llenó. Es información, no un hueco.
  const hay = typeof score === 'number' && Number.isFinite(score);
  const valor = hay ? Math.min(10, Math.max(0, score * 10)) : null;

  return (
    <View
      style={[
        estilos.casilla,
        { borderColor: theme.border, backgroundColor: theme.tintedSurface },
        esFicha && estilos.casillaFicha,
      ]}
      accessibilityLabel={hay ? `${etiqueta.toLowerCase()} ${valor!.toFixed(1)} de 10` : `sin ${etiqueta.toLowerCase()}`}
    >
      <ThemedText type="etiqueta" themeColor="textSecondary">
        {etiqueta}
      </ThemedText>
      <ThemedText
        type={esFicha ? 'calificacion' : 'cifra'}
        themeColor={hay ? 'text' : 'textSecondary'}
        style={esFicha ? undefined : estilos.cifraLista}
      >
        {valor != null ? valor.toFixed(1) : '—'}
      </ThemedText>
    </View>
  );
}

const estilos = StyleSheet.create({
  casilla: {
    borderWidth: Filete.fino,
    borderRadius: Radios.casilla,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    alignItems: 'flex-start',
    // Ancho fijo para que la casilla caiga en la misma columna en cada ficha de
    // la lista. Un documento impreso nunca tambalea sus columnas.
    minWidth: 76,
  },
  casillaFicha: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minWidth: 128,
  },
  cifraLista: { fontSize: 28, lineHeight: 32, letterSpacing: -0.8 },
});
