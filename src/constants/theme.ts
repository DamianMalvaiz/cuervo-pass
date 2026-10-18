import type { TextStyle } from 'react-native';

/**
 * Sistema visual de Cuervo Pass — "La Ficha".
 *
 * El mundo es el kardex y el comprobante de inscripción de la universidad
 * pública mexicana: un documento oficial, ruleado, con sus campos etiquetados y
 * un sello que valida. La afinidad ocupa la casilla donde ese documento pone la
 * calificación, porque un "9.4" se lee sin que nadie lo explique.
 *
 * Claro y oscuro son AMBOS canónicos y son DOS SUPERFICIES DISTINTAS, no una la
 * invertida de la otra: el claro es papel y el oscuro es tinta. Aquí decía que
 * el oscuro era «el mismo papel bajo la lámpara del escritorio a las once de la
 * noche»; se retiró (D.12) porque bajo una lámpara el papel sigue siendo claro y
 * `#12100E` es un negro cálido. La frase invitaba a tratar el oscuro como una
 * versión atenuada del claro, y no lo es: cada modo trae sus propios valores
 * medidos porque los umbrales cambian cuando el fondo cambia de lado.
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
 *   tinta/papel 16.1:1 · secundario/papel 6.0:1 · acento/papel 7.0:1
 *   carbón/lima 10.4:1 · borde de campo 3.5:1 (claro) y 3.9:1 (oscuro)
 *
 * NOTA (Cuervo 360): los valores de color de este archivo son los de la paleta nueva. El
 * texto conceptual de este encabezado («La Ficha», el ámbar como tinta de sello) describe el
 * sistema anterior y se reescribe junto con DESIGN.md; las cifras de arriba sí son las vigentes.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  /** El papel. */
  light: {
    text: '#171A18',
    background: '#F4F6F2',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#DCE3D7',
    textSecondary: '#55605A',
    /** Borde de CAMPO. Es un componente de interfaz, así que cumple 3:1 (WCAG 1.4.11). */
    border: '#7A857B',
    /** Filete de separación entre renglones. Decorativo: no le aplica el 3:1. */
    filete: '#D3DACF',
    /** Verde bosque oscuro, legible como TEXTO sobre el fondo (7.0:1). */
    acento: '#2F5D3A',
    /**
     * Lavado del sello, para el bloque que la hoja quiere destacar.
     *
     * END-29 · El #FBF0DC anterior daba **1.00** contra el papel: exactamente
     * la misma luminancia, un cambio de matiz con cero cambio de valor. El
     * bloque destacado no destacaba bajo el sol, con reflejo, en escala de
     * grises, ni para alguien con daltonismo. Medido ahora: 1.13, y lo salva su borde.
     */
    tintedSurface: '#DDEFB5',
    /** Delinea el lavado. 3.58 contra el fondo: es un borde, le aplica el 3:1. */
    tintedBorder: '#6B8C1E',
    error: '#B3261E',
    /** Texto sobre un relleno de `error`. Blanco da 6.5:1 sobre este rojo. */
    errorTexto: '#FFFFFF',
    /** Confirmación. Medido: 6.0:1 sobre el fondo. El #1a9d5c anterior daba 3.10. */
    exito: '#1F6B33',
    /** Cuervo 360. Verde lima: SOLO relleno de botones y chips (sobre blanco da 1.68:1; no es texto ni icono). */
    lima: '#A5D83E',
    /** Cuervo 360. Texto sobre el relleno lima: siempre carbón. */
    limaTexto: '#171A18',
    /** Cuervo 360. Verde bosque: iconos y botón secundario (control, no texto). */
    bosque: '#477451',
    /** Cuervo 360. EL SELLO: la única acción que compromete algo (revelar un contacto, enviar un mensaje, contratar). Carbón con texto lima en claro. Nunca se parece al relleno lima del botón primario. */
    sello: '#171A18',
    /** Texto sobre el sello. */
    selloTexto: '#A5D83E',
    /** Texto o icono sobre un relleno de `bosque`. */
    bosqueTexto: '#FFFFFF',
  },
  /**
   * La tinta.
   *
   * NO es «el papel bajo una lámpara», que es como este proyecto lo describió
   * durante meses. Bajo una lámpara el papel sigue siendo claro; `#12100E` es un
   * negro cálido. La imagen era bonita y llevaba a decisiones equivocadas:
   * invita a tratar el oscuro como una versión atenuada del claro, cuando es una
   * superficie con su propia paleta medida. No atenúa nada — tiene su propio
   * `acento` (10.43 contra 7.03) y su propio `errorTexto`, porque los umbrales
   * cambian cuando el fondo cambia de lado.
   */
  dark: {
    text: '#F4F6F2',
    background: '#171A18',
    backgroundElement: '#232823',
    backgroundSelected: '#323A32',
    textSecondary: '#A3ADA4',
    border: '#6F7A70',
    filete: '#2C332C',
    acento: '#A5D83E',
    /** Mismo defecto que en claro (1.12 contra el fondo). Medido ahora: 1.43. */
    tintedSurface: '#2B3A12',
    /** 4.69 contra el fondo oscuro. */
    tintedBorder: '#6E8F25',
    error: '#F2B8B5',
    // En oscuro el rojo es CLARO, así que el blanco no alcanzaría el mínimo.
    // El carbón sobre él da 10.3:1. Mismo patrón que el sello: el relleno trae
    // su propio color de texto en vez de asumir que siempre es blanco.
    errorTexto: '#171A18',
    /** En oscuro el verde tiene que aclararse para separarse de la tinta. */
    exito: '#7BCB8A',
    /** Cuervo 360. Verde lima: SOLO relleno de botones y chips (sobre blanco da 1.68:1; no es texto ni icono). */
    lima: '#A5D83E',
    /** Cuervo 360. Texto sobre el relleno lima: siempre carbón. */
    limaTexto: '#171A18',
    /** Cuervo 360. Verde bosque: iconos y botón secundario (control, no texto). */
    bosque: '#6FA97B',
    /** Cuervo 360. EL SELLO: la única acción que compromete algo (revelar un contacto, enviar un mensaje, contratar). Blanco hueso con texto carbón en oscuro (un botón carbón desaparecería sobre el fondo carbón). Nunca se parece al relleno lima del botón primario. */
    sello: '#F4F6F2',
    /** Texto sobre el sello. */
    selloTexto: '#171A18',
    /** Texto o icono sobre un relleno de `bosque`. */
    bosqueTexto: '#171A18',
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
 * Plus Jakarta Sans — geométrica amable, de formas redondeadas y buena lectura en pantallas pequeñas.
 *
 * Desde el 17/10/2026 (Cuervo 360): la app dejó de verse como un documento oficial y pasó a un mercado
 * cercano, con fotos grandes y etiquetas en frase normal. Archivo, la grotesca del sistema anterior, se
 * retiró. La clave `black` se conserva por compatibilidad y apunta a ExtraBold (800), el peso más grueso
 * que se usa. Las cifras que van en columna siguen llevando `tabular-nums`.
 */
export const Tipografia = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  /** Solo para la calificación y las cifras que mandan en la pantalla. */
  black: 'PlusJakartaSans_800ExtraBold',
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
  /** Cuervo 360. La tarjeta de una publicación y su foto grande. */
  tarjeta: 22,
  /** Cuervo 360. Las esquinas de arriba de la hoja de contenido que sube sobre la foto de la ficha. */
  hojaInferior: 28,
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
/** Alto de la barra de pestañas SIN el área segura inferior. El alto real es este
 *  más el inset (ver `(tabs)/_layout.tsx`): un alto fijo se come el icono y la
 *  etiqueta bajo la barra del sistema. */
/** Alto de la foto de una tarjeta de publicación (la de la propuesta del 17/10/2026). */
export const AltoFotoTarjeta = 190;

export const AltoBarraPestanas = 68;

/** La pastilla lima detrás del icono de la pestaña activa (56 × 32, la de la propuesta del 17/10/2026). */
export const AnchoPastillaPestana = 56;
export const AltoPastillaPestana = 32;

/** Lo que se le resta al área segura inferior en iPhone. Con los 34 pt completos la barra queda más alta de lo
 *  natural (probado en un iPhone real el 17/10/2026). En Android NO se resta: ahí la barra del sistema se comía el
 *  icono y la etiqueta. */
export const DescuentoBarraIOS = 8;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
