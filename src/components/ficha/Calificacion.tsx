import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * La casilla de la calificación.
 *
 * Es la pieza que define el mundo. Un kardex mexicano pone la calificación en
 * una casilla enmarcada con su etiqueta encima, y cualquiera que haya pasado por
 * una universidad pública lee "9.4" sin que nadie se lo explique. El motor de
 * sugerencias produce un score en [0,1]; aquí se presenta en la escala que este
 * público ya sabe interpretar.
 *
 * La casilla NO lleva lavado ámbar. Una calificación informa, no compromete, y
 * con veinte fichas en pantalla ese lavado ponía veinte manchas de sello donde
 * no se podía actuar. El recuadro y el cuerpo de la cifra bastan.
 *
 * Vive DENTRO de un recuadro con su etiqueta, alineada con las demás fichas de
 * la lista. Esa es la diferencia entre un documento y el widget de tablero de
 * "número grande, etiqueta chica" que cualquier app entrega: la cifra no flota,
 * ocupa una casilla, y la casilla forma columna al recorrer la lista.
 */
export function Calificacion({
  score,
  tamano = 'lista',
  etiqueta = 'AJUSTE',
}: {
  /** El score del motor, en [0,1]. Se presenta como calificación sobre 10. */
  score: number | null | undefined;
  tamano?: 'compacta' | 'lista' | 'ficha';
  etiqueta?: string;
}) {
  const theme = useTheme();
  const esFicha = tamano === 'ficha';
  // END-31 · `compacta` existe para el carrusel, donde la casilla convive con
  // el precio en una fila estrecha. Antes ese caso se resolvía reimplementando
  // la casilla entera dentro de FichaCompacta —con su propio fontSize y
  // fontFamily, y SIN la etiqueta—, así que el número flotaba sin decir qué
  // era. Dos implementaciones de la pieza central divergen el día que una de
  // las dos se toca; que la etiqueta faltara en una prueba que ya habían
  // divergido.
  const esCompacta = tamano === 'compacta';

  // Sin score no se inventa un número: la casilla se muestra vacía, como un
  // campo del formulario que nadie llenó. Es información, no un hueco.
  const hay = typeof score === 'number' && Number.isFinite(score);

  // END-30 · MEDIOS PUNTOS, no décimas.
  //
  // El número es `0.6 × score + 0.4 × similitud`, una mezcla ponderada de
  // cuatro heurísticas normalizadas a mano. No tiene un decimal de resolución:
  // 8.7 y 8.6 son ruido entre sí. Presentarlo con una décima —en el elemento
  // más grande de la pantalla, dentro de una casilla que imita un kardex—
  // afirma una exactitud que el cálculo no soporta.
  //
  // Veintiún valores posibles en vez de ciento uno. La cifra sigue ordenando y
  // sigue comparándose de un vistazo; lo que deja de hacer es prometer una
  // precisión inventada.
  const valor = hay ? Math.round(Math.min(10, Math.max(0, score * 10)) * 2) / 2 : null;

  return (
    <View
      style={[
        estilos.casilla,
        { borderColor: theme.border, backgroundColor: theme.backgroundElement },
        esFicha && estilos.casillaFicha,
        esCompacta && estilos.casillaCompacta,
      ]}
      accessibilityLabel={hay ? `${etiqueta.toLowerCase()} ${valor!.toFixed(1)} de 10` : `sin ${etiqueta.toLowerCase()}`}
    >
      <ThemedText type="etiqueta" themeColor="textSecondary">
        {etiqueta}
      </ThemedText>
      <ThemedText
        type={esFicha ? 'calificacion' : 'cifra'}
        numberOfLines={1}
        adjustsFontSizeToFit
        themeColor={hay ? 'text' : 'textSecondary'}
        style={esFicha || esCompacta ? undefined : estilos.cifraLista}
      >
        {valor != null ? valor.toFixed(1) : '—'}
      </ThemedText>
    </View>
  );
}

const estilos = StyleSheet.create({
  casilla: {
    borderWidth: Filete.fino,
    borderRadius: Radios.casilla,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    alignItems: 'flex-start',
    // Ancho fijo para que la casilla caiga en la misma columna en cada ficha de
    // la lista. Un documento impreso nunca tambalea sus columnas.
    minWidth: 96,
  },
  // Estrecha, para que quepa junto al precio en el carrusel. Conserva el
  // recuadro y la etiqueta: son lo que la hace legible sin explicación.
  casillaCompacta: {
    paddingHorizontal: Spacing.one,
    paddingVertical: 2,
    minWidth: 56,
    alignItems: 'center',
  },
  casillaFicha: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minWidth: 128,
  },
  cifraLista: Texto.cifraLista,
});
