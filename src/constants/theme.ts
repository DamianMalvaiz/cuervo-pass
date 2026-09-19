import type { TextStyle } from 'react-native';

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
 * Los contrastes de este archivo se MIDEN con `npm run verificar:contraste`,
 * que corre en CI. Los números de abajo son la salida de ese comando, no una
 * anotación a mano.
 *
 * Una versión anterior de este encabezado afirmaba que «todos los contrastes
 * están medidos, no supuestos». Era verdad a medias, y la mitad que faltaba era
 * la que fallaba: se midieron doce pares de TEXTO sobre fondo, y ninguna
 * superficie contra superficie. `tintedSurface` contra el papel daba **1.00**.
 * Una afirmación sin su comando es una promesa; el comando es lo que la vuelve
 * comprobable.
 *
 * Contrastes declarados:
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
    /**
     * Lavado del sello, para el bloque que la hoja quiere destacar.
     *
     * END-29 · El #FBF0DC anterior daba **1.00** contra el papel: exactamente
     * la misma luminancia, un cambio de matiz con cero cambio de valor. El
     * bloque destacado no destacaba bajo el sol, con reflejo, en escala de
     * grises, ni para alguien con daltonismo. Medido ahora: 1.36.
     */
    tintedSurface: '#F1CC88',
    /** Delinea el lavado. 3.21 contra el papel: es un borde, le aplica el 3:1. */
    tintedBorder: '#A58133',
    error: '#A81E12',
    /** Texto sobre un relleno de `error`. Blanco da 7.3:1 sobre este rojo. */
    errorTexto: '#FFFFFF',
    /** Confirmación. Medido: 4.8:1 sobre papel. El #1a9d5c anterior daba 3.10. */
    exito: '#146B3E',
  },
  /** La lámpara. */
  dark: {
    text: '#F5F1EA',
    background: '#12100E',
    backgroundElement: '#1C1916',
    backgroundSelected: '#302A1F',
    textSecondary: '#A39A8C',
    border: '#726960',
    filete: '#322D27',
    acento: '#E8A33D',
    /** Mismo defecto que en claro: 1.12 contra el fondo. Ahora 1.37. */
    tintedSurface: '#382A17',
    /** 3.21 contra el fondo oscuro. */
    tintedBorder: '#8A6529',
    error: '#F08074',
    // En oscuro el rojo es CLARO, así que el blanco daría 2.6:1 y reprobaría.
    // La tinta sobre él da 7.3:1. Mismo patrón que el sello: el relleno trae
    // su propio color de texto en vez de asumir que siempre es blanco.
    errorTexto: '#12100E',
    /** En oscuro el verde tiene que aclararse para separarse de la tinta. */
    exito: '#4FBF85',
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
  /** Prestado de WhatsApp porque el destino literalmente es WhatsApp. Es un
   *  RELLENO con `selloTexto` encima: como texto no se usa nunca. */
  whatsappGreen: '#25D366',
} as const;

// `successGreen` y `destructiveRed` se retiraron por la misma razón que
// `primary`: eran literales que nunca se midieron y se usaban como TEXTO.
// #d92d20 da 4.29:1 sobre papel y 3.93:1 sobre tinta — reprueba AA en los dos
// modos. #1a9d5c da 3.10:1 sobre papel. El tema ya trae `error`/`errorTexto`
// medidos por modo (6.5:1 y 7.3:1) y le faltaba su verde; al borrar estos dos,
// TypeScript señala cada sitio que hay que repuntar en vez de dejarlo pasar.

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

/**
 * La escala tipográfica · END-31
 *
 * Vivía dentro de `themed-text.tsx`, y por eso ese archivo tenía que ser una
 * excepción del invariante 7: era la única fuente de la escala y no podía salir
 * del tema porque el tema no la tenía.
 *
 * Moverla aquí resuelve dos cosas a la vez. `themed-text` deja de ser excepción
 * —ahora consume tokens como todo lo demás— y, sobre todo, los estilos de
 * `TextInput` pueden usarla: a un TextInput no se le puede aplicar ThemedText,
 * así que antes no le quedaba más remedio que escribir `fontFamily` y
 * `fontSize` a mano. Eran la mayoría de las violaciones del invariante, y no
 * por descuido: no había alternativa.
 *
 * Se declaran con `satisfies TextStyle` para que un valor mal escrito falle al
 * compilar aquí y no al pintar en el dispositivo.
 */
export const Texto = {
  cuerpo: { fontFamily: Tipografia.regular, fontSize: 16, lineHeight: 24 },
  titulo: { fontFamily: Tipografia.bold, fontSize: 26, lineHeight: 30, letterSpacing: -0.4 },
  subtitulo: { fontFamily: Tipografia.semibold, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  pequeno: { fontFamily: Tipografia.regular, fontSize: 14, lineHeight: 20 },
  pequenoFuerte: { fontFamily: Tipografia.semibold, fontSize: 14, lineHeight: 20 },
  enlace: { fontFamily: Tipografia.medium, fontSize: 14, lineHeight: 20 },
  enlaceFuerte: { fontFamily: Tipografia.semibold, fontSize: 14, lineHeight: 20 },
  codigo: { fontFamily: 'monospace', fontSize: 12, lineHeight: 16 },
  // El espaciado va en puntos, no en em: a 11px, 0.08em son ~0.9pt.
  etiqueta: { fontFamily: Tipografia.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.9 },
  // `tabular-nums` es lo que hace que las cifras de fichas distintas caigan en
  // la misma columna al recorrer la lista. Sin esto, "1" y "8" ocupan anchos
  // distintos y la columna se tambalea — que es precisamente lo que un
  // documento impreso nunca hace.
  cifra: { fontFamily: Tipografia.bold, fontSize: 17, lineHeight: 22, fontVariant: ['tabular-nums'] },
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
  /** Cifra grande de lista: la calificación en una ficha de la lista. */
  cifraLista: { fontFamily: Tipografia.black, fontSize: 40, lineHeight: 44, letterSpacing: -1.2, fontVariant: ['tabular-nums'] },
  /** Cifra compacta: la calificación en el carrusel. */
  cifraCompacta: { fontFamily: Tipografia.black, fontSize: 18, lineHeight: 24, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  /** Título de portada de una hoja. Más grande que `titulo`, para membretes. */
  tituloHoja: { fontFamily: Tipografia.bold, fontSize: 32, lineHeight: 36, letterSpacing: -0.6 },
  /** Título de pantalla intermedia, entre `titulo` y `subtitulo`. */
  tituloMedio: { fontFamily: Tipografia.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.3 },
  /** Título de sección dentro de un documento largo, como el aviso. */
  tituloSeccion: { fontFamily: Tipografia.semibold, fontSize: 22, lineHeight: 28 },
  /** El texto de un sello: versalita ancha sobre un botón. */
  sello: { fontFamily: Tipografia.bold, fontSize: 15, letterSpacing: 0.4 },
  /** La marca de hora de un mensaje. El tamaño más pequeño que se usa. */
  micro: { fontFamily: Tipografia.regular, fontSize: 11, lineHeight: 14 },

  // ── Modificadores de PESO ──
  //
  // Cambian el peso sin tocar el tamaño: «el mismo texto, más fuerte». Se
  // usaban escribiendo `fontFamily: Tipografia.semibold` suelto en un estilo,
  // que es lo que el invariante 7 prohíbe. Son tokens, no excepciones.
  pesoMedio: { fontFamily: Tipografia.medium },
  pesoFuerte: { fontFamily: Tipografia.semibold },
  pesoNegrita: { fontFamily: Tipografia.bold },
  // `satisfies` y no `as const`: con `as const`, `fontVariant` queda como
  // `readonly ['tabular-nums']` y React Native espera un arreglo mutable de
  // FontVariant. Con `satisfies` se comprueba cada entrada contra TextStyle
  // —un valor mal escrito falla al compilar, no al pintar— y se conservan los
  // nombres de las claves, que es lo que se quería del `as const`.
} satisfies Record<string, TextStyle>;

/**
 * Escala un token conservando su proporción.
 *
 * Existe para que una pantalla que necesita un título más grande en tabletas no
 * tenga que escribir `fontSize: 34 * factor` a mano — que es un valor a mano
 * aunque esté multiplicado, y además pierde la relación con la escala.
 */
export function escalarTexto(token: TextStyle, factor: number): TextStyle {
  return {
    ...token,
    fontSize: (token.fontSize ?? 16) * factor,
    lineHeight: (token.lineHeight ?? 24) * factor,
  };
}

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
