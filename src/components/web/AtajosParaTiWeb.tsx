import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { Colors, Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useComparar } from '@/hooks/use-comparar';
import { useTheme } from '@/hooks/use-theme';
import { RutasWeb } from '@/lib/rutasWeb';

const D = Colors.dark;

interface Atajo {
  clave: string;
  titulo: string;
  nota: string;
  icono: keyof typeof Ionicons.glyphMap;
  /** Cuántos hay; `null` = no se sabe (cargando o falló: «—», nunca un 0 que parezca un hecho); `undefined` = este atajo no lleva cifra. */
  n?: number | null;
  ir: () => void;
  destacado?: boolean;
}

/**
 * Los atajos de «Para ti»: cuatro caminos a lo que la persona más usa, cada uno con su cifra de verdad. Lo guardado y los mensajes llegan de afuera (si no se supieron, `null` y se escribe «—»); lo de comparar es de este navegador y siempre se sabe.
 * «Cerca de tu universidad» no lleva cifra: es un camino, no una cuenta. En el teléfono son dos por fila.
 */
export function AtajosParaTiWeb({ guardados, sinLeer, columnas }: { guardados: number | null; sinLeer: number | null; columnas: number }) {
  const theme = useTheme();
  const { ids: comparados } = useComparar();
  const atajos: Atajo[] = [
    { clave: 'cerca', titulo: 'Cerca de tu universidad', nota: 'Los más cercanos, del más al menos', icono: 'location-outline', ir: () => router.push(RutasWeb.cerca as never), destacado: true },
    { clave: 'guardados', titulo: 'Tus guardados', nota: 'Para decidir con calma', icono: 'heart-outline', n: guardados, ir: () => router.push('/(tabs)/favoritos') },
    { clave: 'comparar', titulo: 'Comparar', nota: 'Hasta 3 lugares lado a lado', icono: 'git-compare-outline', n: comparados.length, ir: () => router.push(RutasWeb.comparar as never) },
    { clave: 'mensajes', titulo: 'Tus mensajes', nota: 'Sin leer', icono: 'chatbubble-outline', n: sinLeer, ir: () => router.push('/(tabs)/chats') },
  ];
  const ancho = columnas >= 4 ? '24%' : '48%';
  return (
    <View style={estilos.fila}>
      {atajos.map((a) => {
        const oscuro = Boolean(a.destacado);
        return (
          <Pulsable
            key={a.clave}
            onPress={a.ir}
            accessibilityRole="link"
            accessibilityLabel={a.n === undefined ? a.titulo : `${a.titulo}: ${a.n === null ? 'sin dato' : a.n}`}
            style={[estilos.atajo, { width: ancho, backgroundColor: oscuro ? D.background : theme.backgroundElement, borderColor: oscuro ? D.background : theme.filete }]}
          >
            <View style={[estilos.icono, { backgroundColor: oscuro ? D.lima : theme.tintedSurface }]}>
              <Ionicons name={a.icono} size={24} color={oscuro ? D.limaTexto : theme.bosque} />
            </View>
            {a.n !== undefined ? <ThemedText style={[Texto.seccionWebCompacto, estilos.cifra, { color: theme.text }]}>{a.n === null ? '—' : String(a.n)}</ThemedText> : null}
            <ThemedText style={[Texto.subtitulo, oscuro && { color: D.text }]}>{a.titulo}</ThemedText>
            <ThemedText style={[Texto.pequeno, { color: oscuro ? D.textSecondary : theme.textSecondary }]}>{a.nota}</ThemedText>
          </Pulsable>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, justifyContent: 'space-between' },
  atajo: { minHeight: 140, borderRadius: Radios.tarjeta, borderWidth: Filete.fino, padding: Spacing.four, gap: Spacing.one, justifyContent: 'flex-end' },
  icono: { width: 48, height: 48, borderRadius: Radios.control, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.two },
  cifra: { position: 'absolute', right: Spacing.four, top: Spacing.three },
});
