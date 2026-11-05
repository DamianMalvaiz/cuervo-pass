import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { FotoLista } from '@/components/FotoLista';
import { ThemedText } from '@/components/themed-text';
import { Colors, Radios, Spacing, Texto } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const D = Colors.dark;
const HUECO = Spacing.two + Spacing.one;
const ALTO_ESCRITORIO = 460;

/**
 * La galería de una ficha: en escritorio, una foto grande a la izquierda y hasta cuatro a la derecha; el reparto se acomoda a cuántas hay (una, dos, tres, cuatro o más), sin huecos ni fotos inventadas.
 * En pantalla angosta, un carrusel a todo el ancho con su contador. Sin fotos, lo dice. `fotos` son URL ya firmadas.
 */
export function GaleriaWeb({
  fotos,
  titulo,
  escritorio,
  textoSinFotos = 'Este lugar todavía no tiene fotos',
}: {
  fotos: string[];
  titulo: string;
  escritorio: boolean;
  textoSinFotos?: string;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [actual, setActual] = useState(0);
  const total = fotos.length;
  const etiqueta = (i: number) => `${titulo}, foto ${i + 1} de ${total}`;
  const foto = (i: number, estilo: object = estilos.flexible) => (
    <View key={i} style={[estilos.celda, { backgroundColor: theme.backgroundSelected }, estilo]}>
      <FotoLista completa={fotos[i]} style={estilos.imagen} accessibilityLabel={etiqueta(i)} />
    </View>
  );

  if (total === 0) {
    return (
      <View style={[estilos.vacia, { backgroundColor: theme.backgroundSelected }]}>
        <Ionicons name="image-outline" size={36} color={theme.textSecondary} />
        <ThemedText style={Texto.cuerpo} themeColor="textSecondary">{textoSinFotos}</ThemedText>
      </View>
    );
  }

  if (!escritorio) {
    const ancho = Math.max(240, width - Spacing.three * 2);
    const alDeslizar = (e: NativeSyntheticEvent<NativeScrollEvent>) => setActual(Math.round(e.nativeEvent.contentOffset.x / ancho));
    return (
      <View>
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={alDeslizar} scrollEventThrottle={16} style={estilos.carrusel}>
          {/* Sin `flex`: en la web `flex: 0` es `flex-basis: 0%`, y dentro del contenedor en columna que el ScrollView pone a cada página la altura base era 0 (la galería no se veía en el teléfono). */}
          {fotos.map((_, i) => foto(i, { width: ancho, height: Math.round(ancho * 0.8), borderRadius: Radios.tarjeta }))}
        </ScrollView>
        <View style={estilos.contador}>
          <ThemedText style={[Texto.pequenoFuerte, { color: D.text }]}>{`${Math.min(actual, total - 1) + 1} / ${total}`}</ThemedText>
        </View>
      </View>
    );
  }

  const derecha = fotos.slice(1, 5).map((_, i) => i + 1);
  const grande = foto(0, { flex: 2 });
  let lado: React.ReactNode;
  if (derecha.length === 0) lado = null;
  else if (derecha.length === 1) lado = <View style={estilos.lado}>{foto(derecha[0])}</View>;
  else if (derecha.length === 2) lado = <View style={estilos.lado}>{derecha.map((i) => foto(i))}</View>;
  else if (derecha.length === 3) {
    lado = (
      <View style={estilos.lado}>
        {foto(derecha[0])}
        <View style={estilos.filaLado}>{foto(derecha[1])}{foto(derecha[2])}</View>
      </View>
    );
  } else {
    lado = (
      <View style={estilos.lado}>
        <View style={estilos.filaLado}>{foto(derecha[0])}{foto(derecha[1])}</View>
        <View style={estilos.filaLado}>{foto(derecha[2])}{foto(derecha[3])}</View>
      </View>
    );
  }

  return (
    <View style={estilos.mosaico}>
      {grande}
      {lado}
    </View>
  );
}

const estilos = StyleSheet.create({
  mosaico: { flexDirection: 'row', gap: HUECO, height: ALTO_ESCRITORIO, borderRadius: Radios.hojaInferior, overflow: 'hidden' },
  lado: { flex: 1, gap: HUECO },
  filaLado: { flex: 1, flexDirection: 'row', gap: HUECO },
  celda: { overflow: 'hidden' },
  flexible: { flex: 1 },
  imagen: { width: '100%', height: '100%' },
  vacia: { height: 260, borderRadius: Radios.tarjeta, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  carrusel: { borderRadius: Radios.tarjeta },
  contador: { position: 'absolute', right: Spacing.three, bottom: Spacing.three, backgroundColor: D.background, borderRadius: Radios.full, paddingVertical: Spacing.one, paddingHorizontal: Spacing.three },
});
