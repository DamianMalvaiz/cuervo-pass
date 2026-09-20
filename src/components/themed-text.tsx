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

/**
 * Cuánto puede crecer cada tipo con el ajuste de tamaño del sistema · END-34
 *
 * `PRODUCT.md` compromete «respecting the system's font-size scaling» y no
 * había un solo uso de `maxFontSizeMultiplier` en la app. La promesa no estaba
 * mal ajustada: no existía.
 *
 * Lo que rompe al 200 % no es el texto corrido —ése crece y ya— sino las CIFRAS
 * EN CASILLAS DE ANCHO FIJO. `cifraLista` mide 40/44 px con `numberOfLines={1}`
 * y `adjustsFontSizeToFit`: al escalar no cabe, y `adjustsFontSizeToFit` la
 * ENCOGE hasta caber. La calificación —el elemento que este sistema declara
 * como el más importante— acaba más pequeña que el texto de al lado. **La
 * jerarquía se invierte justo para quien subió el tamaño porque le costaba
 * leer**, que es exactamente a quien la función pretendía ayudar.
 *
 * Por eso el reparto no es un número global:
 *
 *   1.4  texto corrido — crece de verdad, que es el punto
 *   1.2  títulos — crecen menos: un título al 140 % se come la pantalla y
 *        empuja el contenido fuera de la primera vista
 *   1.0  cifras y etiquetas de casilla — no escalan, porque su contenedor es
 *        de ancho fijo por diseño y escalarlas las encogería
 *
 * Nada lleva `allowFontScaling={false}`: apagar el escalado es romper la
 * promesa, no cumplirla a medias. Lo que se acota es CUÁNTO crece.
 */
const TOPE_ESCALADO: Record<NonNullable<ThemedTextProps['type']>, number> = {
  default: 1.4,
  small: 1.4,
  smallBold: 1.4,
  link: 1.4,
  linkPrimary: 1.4,
  code: 1.4,
  title: 1.2,
  subtitle: 1.2,
  etiqueta: 1,
  cifra: 1,
  calificacion: 1,
  folio: 1,
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  // `link` y `linkPrimary` llevaban el azul quemado en la hoja de estilos. El
  // ámbar no puede hacer lo mismo: necesita un valor distinto por modo para
  // seguir siendo legible, así que sale del tema y no de un literal.
  const colorBase = type === 'link' || type === 'linkPrimary' ? theme.acento : theme[themeColor ?? 'text'];

  return (
    <Text
      // Antes de `{...rest}` a propósito: quien usa el componente puede bajar el
      // tope en un sitio concreto —una fila de altura fija, por ejemplo— y el
      // tipo no tiene forma de saberlo. Lo que no puede es subirlo por
      // descuido, porque tendría que escribirlo.
      maxFontSizeMultiplier={TOPE_ESCALADO[type]}
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
