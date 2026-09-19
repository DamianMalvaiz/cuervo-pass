import { StyleSheet, Text, type TextProps } from 'react-native';

import { Tipografia, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * La voz de "La Ficha".
 *
 * La inversión que define este mundo: `calificacion` (56px) es MÁS GRANDE que
 * `title` (26px). En un kardex el encabezado es modesto y el dato manda —
 * exactamente al revés de lo que hace una app, donde el título de pantalla grita
 * y la información susurra. El título anterior era de 48px: en un teléfono eso
 * dejaba tres palabras y ningún dato en el primer pantallazo.
 *
 * `etiqueta` es el otro pilar: versalitas diminutas y espaciadas que nombran
 * cada casilla. Un documento oficial no tiene texto suelto; tiene pares de
 * etiqueta y valor. Ese par es la unidad de composición de toda la app.
 */
export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'subtitle'
    | 'small'
    | 'smallBold'
    | 'link'
    | 'linkPrimary'
    | 'code'
    /** Versalita que nombra una casilla. Va en MAYÚSCULAS en el llamador. */
    | 'etiqueta'
    /** Cifra alineable: renta, distancia, recámaras. */
    | 'cifra'
    /** La calificación de afinidad. Una por ficha, nunca dos. */
    | 'calificacion'
    /** Folio, fecha de emisión y demás metadatos del documento. */
    | 'folio';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  // `link` y `linkPrimary` llevaban el azul quemado en la hoja de estilos. El
  // ámbar no puede hacer lo mismo: necesita un valor distinto por modo para
  // seguir siendo legible, así que sale del tema y no de un literal.
  const colorBase = type === 'link' || type === 'linkPrimary' ? theme.acento : theme[themeColor ?? 'text'];

  return (
    <Text
      style={[
        { color: themeColor ? theme[themeColor] : colorBase },
        styles[type],
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontFamily: Tipografia.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  title: {
    fontFamily: Tipografia.bold,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontFamily: Tipografia.semibold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  small: {
    fontFamily: Tipografia.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  smallBold: {
    fontFamily: Tipografia.semibold,
    fontSize: 14,
    lineHeight: 20,
  },
  link: {
    fontFamily: Tipografia.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  linkPrimary: {
    fontFamily: Tipografia.semibold,
    fontSize: 14,
    lineHeight: 20,
  },
  code: {
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 16,
  },
  // El espaciado va en puntos, no en em: a 11px, 0.08em son ~0.9pt.
  etiqueta: {
    fontFamily: Tipografia.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.9,
  },
  // `tabular-nums` es lo que hace que las cifras de fichas distintas caigan en
  // la misma columna al recorrer la lista. Sin esto, "1" y "8" ocupan anchos
  // distintos y la columna se tambalea — que es precisamente lo que un
  // documento impreso nunca hace.
  cifra: {
    fontFamily: Tipografia.bold,
    fontSize: 17,
    lineHeight: 22,
    fontVariant: ['tabular-nums'],
  },
  calificacion: {
    fontFamily: Tipografia.black,
    fontSize: 56,
    lineHeight: 56,
    letterSpacing: -1.8,
    fontVariant: ['tabular-nums'],
  },
  folio: {
    fontFamily: Tipografia.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.6,
    fontVariant: ['tabular-nums'],
  },
});
