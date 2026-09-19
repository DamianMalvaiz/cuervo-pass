/**
 * Sistema visual de Cuervo Pass — "La Ficha".
 *
 * El mundo es el kardex y el comprobante de inscripción de la universidad
 * pública mexicana: un documento oficial, ruleado, con sus campos etiquetados y
 * un sello que valida. La afinidad ocupa la casilla donde ese documento pone la
 * calificación, porque un "9.4" se lee sin que nadie lo explique.
 *
 * Claro y oscuro son AMBOS canónicos, no uno el invertido del otro: el claro es
 * el papel, y el oscuro es el mismo papel bajo la lámpara del escritorio a las
 * once de la noche — que es la hora a la que de verdad se usa esto.
 *
 * El ámbar es TINTA DE SELLO. En un documento oficial el sello es lo único con
 * color en toda la hoja; aquí igual. Solo aparece sobre lo que valida o
 * compromete, nunca como decoración.
 *
 * Todos los contrastes de este archivo están medidos, no supuestos:
 *   tinta/papel 16.9:1 · secundario/papel 6.5:1 · acento/papel 5.5:1
 *   tinta/sello 8.8:1  · borde de campo 3.4:1 (claro) y 3.5:1 (oscuro)
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  /** El papel. */
  light: {
    text: '#12100E',
    background: '#F5F1EA',
    backgroundElement: '#EAE4D9',
    backgroundSelected: '#DED6C8',
    textSecondary: '#5C554B',
    /** Borde de CAMPO. Es un componente de interfaz, así que cumple 3:1 (WCAG 1.4.11). */
    border: '#8A8177',
    /** Filete de separación entre renglones. Decorativo: no le aplica el 3:1. */
    filete: '#C9C0B0',
    /** Ámbar legible como TEXTO sobre papel. El #E8A33D del sello da 1.9:1 aquí. */
    acento: '#8A5606',
    /** Lavado del sello, para el bloque que la hoja quiere destacar. */
    tintedSurface: '#FBF0DC',
    tintedBorder: '#E3CFA4',
    error: '#A81E12',
    /** Texto sobre un relleno de `error`. Blanco da 7.3:1 sobre este rojo. */
    errorTexto: '#FFFFFF',
  },
  /** La lámpara. */
  dark: {
    text: '#F5F1EA',
    background: '#12100E',
    backgroundElement: '#1C1916',
    backgroundSelected: '#262119',
    textSecondary: '#A39A8C',
    border: '#726960',
    filete: '#322D27',
    acento: '#E8A33D',
    tintedSurface: '#241B0F',
    tintedBorder: '#4A3616',
    error: '#F08074',
    // En oscuro el rojo es CLARO, así que el blanco daría 2.6:1 y reprobaría.
    // La tinta sobre él da 7.3:1. Mismo patrón que el sello: el relleno trae
    // su propio color de texto en vez de asumir que siempre es blanco.
    errorTexto: '#12100E',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Colores que NO cambian entre claro y oscuro, porque son rellenos con su propio
 * texto encima, no texto sobre el fondo de la app.
 *
 * `primary` se retiró a propósito. Era el azul utilitario de todo el sistema
 * anterior, y dejarlo apuntando al ámbar habría migrado la app a medias: el
 * ámbar del sello sobre papel claro da 1.9:1 y no es legible como texto. Al
 * borrarlo, TypeScript señala cada lugar que hay que decidir — `sello` cuando es
 * un relleno que compromete, `theme.acento` cuando es texto.
 */
export const AppColors = {
  /** Tinta de sello. Va de RELLENO, con `selloTexto` encima. Nunca como texto. */
  sello: '#E8A33D',
  selloTexto: '#12100E',
  /** Prestado de WhatsApp porque el destino literalmente es WhatsApp. */
  whatsappGreen: '#25D366',
  successGreen: '#1a9d5c',
  destructiveRed: '#d92d20',
} as const;

/**
 * Archivo — grotesca de impresos de Omnibus-Type, fundidora latinoamericana.
 *
 * No se eligió por el nombre. Se eligió porque este mundo vive de cifras que
 * tienen que alinearse en columna (`fontVariant: ['tabular-nums']`), y porque su
 * corte Black aguanta una calificación a cuerpo enorme sin deshacerse. Una
 * tipografía del sistema como voz display de un mundo propio es un fallo, no un
 * respaldo.
 */
export const Tipografia = {
  regular: 'Archivo_400Regular',
  medium: 'Archivo_500Medium',
  semibold: 'Archivo_600SemiBold',
  bold: 'Archivo_700Bold',
  /** Solo para la calificación y las cifras que mandan en la pantalla. */
  black: 'Archivo_900Black',
} as const;

export const Fonts = Platform.select({
  ios: {
    sans: Tipografia.regular,
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: Tipografia.regular,
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: Tipografia.regular,
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/**
 * Tres radios, no uno.
 *
 * La primera versión de este sistema usó 2–3 px con el argumento de que un
 * impreso tiene esquinas vivas. Era cierto y se veía duro: para alguien de
 * dieciocho años eligiendo dónde va a vivir, duro es lo contrario de lo que
 * ayuda. Se corrigió hacia arriba.
 *
 * Lo que sostiene el mundo documento NO son las esquinas: son los filetes y los
 * pares etiqueta/valor. Eso queda intacto. Lo que se ablanda es todo lo que se
 * toca, que es donde la suavidad significa "puedes agarrarme" en vez de
 * "decoración".
 *
 * La escala crece con la superficie, como en cualquier sistema que se sostenga:
 * una casilla de 24 px con radio 16 se ve deforme, y una hoja de 360 px con
 * radio 8 se ve tacaña.
 */
export const Radios = {
  /** Casillas pequeñas: la calificación, insignias, pastillas de una línea. */
  casilla: 8,
  /** Controles que se tocan: botones, campos de texto, desplegables. */
  control: 12,
  /** Superficies grandes: la ficha, sus fotografías, bloques de estado. */
  hoja: 16,
  full: 9999,
} as const;

/**
 * Grosor de filete. `hairlineWidth` en un teléfono de 3x es ~0.33px y a esa
 * escala el filete desaparece; 1px físico es lo que imprime una laser.
 */
export const Filete = {
  fino: 1,
  grueso: 2,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
