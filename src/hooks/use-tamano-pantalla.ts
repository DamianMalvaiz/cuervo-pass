import { useWindowDimensions } from 'react-native';

/**
 * Clases de tamaño, no modelos de dispositivo.
 *
 * Preguntar por el modelo del teléfono es la forma garantizada de equivocarse:
 * un teléfono en horizontal, una tableta en pantalla dividida y un plegable
 * abierto entregan anchos que ningún catálogo de modelos predice. Lo que
 * importa es cuánto espacio hay AHORA.
 *
 *  · compacta — teléfono pequeño o teclado abierto comiéndose el alto. El
 *    formulario tiene que caber sin que el usuario persiga el botón.
 *  · normal   — el teléfono típico en vertical.
 *  · amplia   — tableta, horizontal o ventana grande. Aquí NO se estira: se
 *    acota la columna y se centra, porque una línea de sesenta caracteres es
 *    legible y una de ciento veinte no.
 */
export type ClaseTamano = 'compacta' | 'normal' | 'amplia';

export interface TamanoPantalla {
  clase: ClaseTamano;
  ancho: number;
  alto: number;
  /** Ancho máximo de la columna de contenido. Centra en pantallas amplias. */
  anchoContenido: number;
  /** Alto poco generoso: conviene recortar lo decorativo y apretar el ritmo. */
  altoApretado: boolean;
  /** Factor para el cuerpo display. Nunca baja de 0.8 ni sube de 1. */
  escalaTitulo: number;
}

export function useTamanoPantalla(): TamanoPantalla {
  const { width, height } = useWindowDimensions();

  const clase: ClaseTamano = width >= 700 ? 'amplia' : width < 360 || height < 700 ? 'compacta' : 'normal';
  const altoApretado = height < 700;

  return {
    clase,
    ancho: width,
    alto: height,
    anchoContenido: clase === 'amplia' ? 480 : width,
    altoApretado,
    // Un título de 26 px en un teléfono de 320 px de ancho se come dos
    // renglones y empuja el formulario fuera de la pantalla.
    escalaTitulo: clase === 'compacta' ? 0.84 : 1,
  };
}
