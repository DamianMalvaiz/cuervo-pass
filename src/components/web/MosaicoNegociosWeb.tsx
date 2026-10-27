import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { FotoLista } from '@/components/FotoLista';
import { ThemedText } from '@/components/themed-text';
import { ScrimWeb } from '@/components/web/ScrimWeb';
import { Colors, Radios, Spacing, Texto } from '@/constants/theme';
import { useFotosPublicas } from '@/hooks/queries/useExplorar';
import { useTheme } from '@/hooks/use-theme';
import { RutasWeb } from '@/lib/rutasWeb';
import type { NegocioExplorar } from '@/services/explorar.service';

const D = Colors.dark;
const HUECO = Spacing.three;

function Mosaico({ n, ancho, alto, grande }: { n: NegocioExplorar; ancho: number; alto: number; grande?: boolean }) {
  const theme = useTheme();
  const { fotos } = useFotosPublicas('negocio', n.id, n.num_fotos);
  const estado = n.abierto_ahora === null ? null : n.abierto_ahora ? 'Abierto ahora' : 'Cerrado ahora';
  return (
    <Pulsable
      onPress={() => router.push(RutasWeb.negocio(n.id))}
      accessibilityRole="button"
      accessibilityLabel={estado ? `${n.nombre}, ${estado}` : n.nombre}
      style={[estilos.mosaico, { width: ancho, height: alto, backgroundColor: theme.backgroundSelected }]}
    >
      <FotoLista completa={fotos[0]} style={estilos.imagen} accessibilityLabel={n.nombre} />
      <ScrimWeb />
      {grande && estado ? (
        <View style={estilos.estado}>
          <ThemedText style={[Texto.pequenoFuerte, { color: D.limaTexto }]}>{estado}</ThemedText>
        </View>
      ) : null}
      <View style={estilos.pie}>
        <ThemedText style={[grande ? Texto.titulo : Texto.subtitulo, estilos.nombre]} numberOfLines={2}>{n.nombre}</ThemedText>
        <View style={estilos.ir}>
          <Ionicons name="arrow-forward" size={20} color={D.limaTexto} />
        </View>
      </View>
    </Pulsable>
  );
}

/**
 * Los negocios como mosaico de fotos grandes con el nombre encima. En escritorio el primero ocupa dos por dos y los cuatro siguientes lo rodean; si hay más, siguen en filas del mismo tamaño
 * (ninguno se pierde). En pantallas más angostas todos son del mismo tamaño. `ancho` es el de una celda; el hueco entre celdas es fijo.
 */
export function MosaicoNegociosWeb({ negocios, escritorio, ancho }: { negocios: NegocioExplorar[]; escritorio: boolean; ancho: number }) {
  const alto = Math.round(ancho * 0.78);
  if (!escritorio || negocios.length < 2) {
    return (
      <View style={estilos.rejilla}>
        {negocios.map((n) => <Mosaico key={n.id} n={n} ancho={ancho} alto={alto} />)}
      </View>
    );
  }
  const [grande, ...resto] = negocios;
  const alrededor = resto.slice(0, 4);
  const otros = resto.slice(4);
  return (
    <View style={estilos.columna}>
      <View style={estilos.rejilla}>
        <Mosaico n={grande} ancho={ancho * 2 + HUECO} alto={alto * 2 + HUECO} grande />
        <View style={[estilos.rejilla, { width: ancho * 2 + HUECO }]}>
          {alrededor.map((n) => <Mosaico key={n.id} n={n} ancho={ancho} alto={alto} />)}
        </View>
      </View>
      {otros.length > 0 ? (
        <View style={estilos.rejilla}>
          {otros.map((n) => <Mosaico key={n.id} n={n} ancho={ancho} alto={alto} />)}
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  columna: { gap: HUECO },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: HUECO },
  mosaico: { borderRadius: Radios.hojaInferior, overflow: 'hidden', justifyContent: 'flex-end' },
  imagen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  estado: { position: 'absolute', left: Spacing.three, top: Spacing.three, backgroundColor: D.lima, borderRadius: Radios.full, paddingVertical: Spacing.one + Spacing.half, paddingHorizontal: Spacing.three },
  pie: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two, padding: Spacing.three + Spacing.one },
  nombre: { color: D.text, flex: 1 },
  ir: { width: 44, height: 44, borderRadius: Radios.full, backgroundColor: D.lima, alignItems: 'center', justifyContent: 'center' },
});
