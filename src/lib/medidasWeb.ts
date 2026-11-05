// Las medidas de la web pública según el ancho de la ventana. Pura, sin React: la usan la portada y las páginas interiores. Va de un teléfono (una columna) a un monitor muy ancho (cinco),
// con el contenido centrado y acotado a `AnchoMaximoWeb` (el hero y el pie sí ocupan todo el ancho).

import { AnchoMaximoWeb, Spacing } from '@/constants/theme';

/** El hueco entre tarjetas. */
export const HUECO_WEB = Spacing.three + Spacing.one;
/** El hueco entre las tarjetas de un carrusel del teléfono. */
export const HUECO_CARRUSEL = Spacing.three - Spacing.one;

export function medidasWeb(ancho: number) {
  const escritorio = ancho >= 1000;
  // Por debajo de 700 px es un teléfono: diseño de app (barra inferior, carruseles, tarjetas compactas), no el de escritorio apilado.
  const telefono = ancho < 700;
  const columnas = ancho >= 1360 ? 5 : ancho >= 1000 ? 4 : ancho >= 700 ? 3 : 2;
  const relleno = ancho >= 700 ? Spacing.five : Spacing.three;
  const interior = Math.min(ancho, AnchoMaximoWeb) - relleno * 2;
  const anchoTarjeta = Math.floor((interior - HUECO_WEB * (columnas - 1)) / columnas);
  // El mosaico de negocios es de cuatro celdas de ancho (la grande ocupa dos): no sigue las columnas de la cuadrícula.
  const anchoMosaico = escritorio ? Math.floor((interior - HUECO_WEB * 3) / 4) : anchoTarjeta;
  // La tarjeta de un carrusel del teléfono: caben dos y un pedazo de la tercera, para que se note que se desliza.
  const anchoCarrusel = Math.floor((ancho - relleno) / 2.35 - HUECO_CARRUSEL / 2);
  return { escritorio, telefono, columnas, relleno, interior, anchoTarjeta, anchoMosaico, anchoCarrusel };
}
