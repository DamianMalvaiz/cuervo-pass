import { StyleSheet, View } from 'react-native';

import { Radios, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { HUECO_WEB } from '@/lib/medidasWeb';
import { anim } from '@/lib/movimientoWeb';

/** Una pieza gris con brillo que la cruza (el CSS global `brillo`; con «reducir movimiento» queda quieta). */
function Pieza({ estilo }: { estilo: object }) {
  const theme = useTheme();
  return <View style={[estilo, { backgroundColor: theme.backgroundSelected }]} {...anim('brillo')} />;
}

const ESTADO = { role: 'status', 'aria-label': 'Cargando', 'aria-busy': true } as object;

/**
 * Lo que se ve mientras llegan las tarjetas de una rejilla: la forma de cada tarjeta (foto 4:5, dos líneas de texto) en el ancho de la real, para que la página no brinque al llegar los datos.
 * Son formas y no texto: no afirman nada del contenido. El brillo existe solo mientras se espera.
 */
export function EsqueletoTarjetasWeb({ cuantas, ancho }: { cuantas: number; ancho: number }) {
  return (
    <View style={estilos.rejilla} {...ESTADO}>
      {Array.from({ length: cuantas }, (_, i) => (
        <View key={i} testID="esqueleto-tarjeta" style={[estilos.tarjeta, { width: ancho }]}>
          <Pieza estilo={estilos.foto} />
          <Pieza estilo={estilos.linea} />
          <Pieza estilo={estilos.lineaCorta} />
        </View>
      ))}
    </View>
  );
}

/** Lo que se ve mientras llega una lista de filas (la bandeja de chats): avatar y dos líneas por fila. */
export function EsqueletoFilasWeb({ filas }: { filas: number }) {
  return (
    <View {...ESTADO}>
      {Array.from({ length: filas }, (_, i) => (
        <View key={i} testID="esqueleto-fila" style={estilos.fila}>
          <Pieza estilo={estilos.avatar} />
          <View style={estilos.textos}>
            <Pieza estilo={estilos.linea} />
            <Pieza estilo={estilos.lineaCorta} />
          </View>
        </View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: HUECO_WEB },
  tarjeta: { gap: Spacing.two },
  foto: { aspectRatio: 4 / 5, borderRadius: Radios.tarjeta, overflow: 'hidden' },
  linea: { height: 14, borderRadius: Radios.full, width: '80%', overflow: 'hidden' },
  lineaCorta: { height: 14, borderRadius: Radios.full, width: '50%', overflow: 'hidden' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, minHeight: 76 },
  avatar: { width: 48, height: 48, borderRadius: Radios.full, overflow: 'hidden' },
  textos: { flex: 1, gap: Spacing.two },
});
