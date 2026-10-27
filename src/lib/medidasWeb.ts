// Las medidas de la web pública según el ancho de la ventana. Pura, sin React: la usan la portada y las páginas interiores. Va de un teléfono (una columna) a un monitor muy ancho (cinco),
// con el contenido centrado y acotado a `AnchoMaximoWeb` (el hero y el pie sí ocupan todo el ancho).

import { AnchoMaximoWeb, Spacing } from '@/constants/theme';

/** El hueco entre tarjetas. */
export const HUECO_WEB = Spacing.three + Spacing.one;

export function medidasWeb(ancho: number) {
  const escritorio = ancho >= 1000;
  const columnas = ancho >= 1360 ? 5 : ancho >= 1000 ? 4 : ancho >= 700 ? 3 : ancho >= 480 ? 2 : 1;
  const relleno = ancho >= 700 ? Spacing.five : Spacing.three;
  const interior = Math.min(ancho, AnchoMaximoWeb) - relleno * 2;
  const anchoTarjeta = Math.floor((interior - HUECO_WEB * (columnas - 1)) / columnas);
  // El mosaico de negocios es de cuatro celdas de ancho (la grande ocupa dos): no sigue las columnas de la cuadrícula.
  const anchoMosaico = escritorio ? Math.floor((interior - HUECO_WEB * 3) / 4) : anchoTarjeta;
  return { escritorio, columnas, relleno, interior, anchoTarjeta, anchoMosaico };
}
