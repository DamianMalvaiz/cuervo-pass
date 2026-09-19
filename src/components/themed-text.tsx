import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { type ThemeColor, Texto } from '@/constants/theme';
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

// Los estilos SALEN del tema, no se definen aquí. Este archivo era la única
// excepción del invariante 7 porque era la fuente de la escala; ahora la fuente
// es `Texto` en theme.ts y este componente es un consumidor más.
const styles = StyleSheet.create<Record<string, TextStyle>>({
  default: { ...Texto.cuerpo },
  title: { ...Texto.titulo },
  subtitle: { ...Texto.subtitulo },
  small: { ...Texto.pequeno },
  smallBold: { ...Texto.pequenoFuerte },
  link: { ...Texto.enlace },
  linkPrimary: { ...Texto.enlaceFuerte },
  code: { ...Texto.codigo },
  etiqueta: { ...Texto.etiqueta },
  cifra: { ...Texto.cifra },
  calificacion: { ...Texto.calificacion },
  folio: { ...Texto.folio },
});
