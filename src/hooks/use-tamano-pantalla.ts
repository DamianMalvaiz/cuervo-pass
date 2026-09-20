import { useWindowDimensions } from 'react-native';

import { MaxContentWidth } from '@/constants/theme';

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
  /** Ancho máximo de la columna de FORMULARIO. Centra en pantallas amplias.
   *  480 px porque una línea de sesenta caracteres es legible y una de ciento
   *  veinte no. */
  anchoContenido: number;
  /** Ancho máximo de una LISTA o una ficha. 800 y no 480: un renglón con foto de
   *  96 y tres columnas de 86 necesita más sitio que un párrafo, y acotarlo a la
   *  medida de un formulario dejaría las columnas apretadas en una tableta justo
   *  donde sobra espacio.
   *
   *  Este es el consumidor de `MaxContentWidth`, que hasta END-36 era un token
   *  MUERTO: declarado en el corazón del sistema visual y con cero usos en todo
   *  el código. La orden D.10 daba la alternativa de borrarlo; se conserva
   *  porque el problema no era el token sino que nadie lo aplicaba. */
  anchoLista: number;
  /** Alto poco generoso: conviene recortar lo decorativo y apretar el ritmo. */
  altoApretado: boolean;
  /** Factor para el cuerpo display. Nunca baja de 0.8 ni sube de 1. */
  escalaTitulo: number;
}

/**
 * Las reglas de tamaño, SIN React.
 *
 * Separado del hook para poder comprobarlo sin plomería: probar el hook exige
 * sustituir `useWindowDimensions`, y sustituirlo obliga a tocar el módulo
 * `react-native` entero —esparcirlo dispara sus getters de deprecación y tumba
 * la suite con un error que no menciona el mock por ningún lado—. Una función
 * que solo hace cuentas se prueba con cuentas.
 */
export function medidasDe(width: number, height: number): TamanoPantalla {
  const clase: ClaseTamano = width >= 700 ? 'amplia' : width < 360 || height < 700 ? 'compacta' : 'normal';
  const altoApretado = height < 700;

  return {
    clase,
    ancho: width,
    alto: height,
    anchoContenido: clase === 'amplia' ? 480 : width,
    anchoLista: Math.min(width, MaxContentWidth),
    altoApretado,
    // Un título de 26 px en un teléfono de 320 px de ancho se come dos
    // renglones y empuja el formulario fuera de la pantalla.
    escalaTitulo: clase === 'compacta' ? 0.84 : 1,
  };
}

export function useTamanoPantalla(): TamanoPantalla {
  const { width, height } = useWindowDimensions();
  return medidasDe(width, height);
}
