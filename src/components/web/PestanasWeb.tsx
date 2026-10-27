import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { Colors, Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { RutasWeb } from '@/lib/rutasWeb';
import { useTheme } from '@/hooks/use-theme';

const D = Colors.dark;

// `selected` no se escribe para enlaces en la web: la página actual se anuncia con `aria-current="page"` (React Native Web lo deja pasar al DOM).
const ACTUAL = { 'aria-current': 'page' } as object;

export type SeccionWeb = 'depas' | 'roomies' | 'servicios';

const PESTANAS: { seccion: SeccionWeb; nombre: string; icono: keyof typeof Ionicons.glyphMap; ruta: string }[] = [
  { seccion: 'depas', nombre: 'Departamentos', icono: 'home-outline', ruta: RutasWeb.departamentos },
  { seccion: 'roomies', nombre: 'Roomies', icono: 'people-outline', ruta: RutasWeb.roomies },
  { seccion: 'servicios', nombre: 'Servicios', icono: 'storefront-outline', ruta: RutasWeb.servicios },
];

/**
 * Las tres pestañas de la web: cada una lleva a SU página (no a un punto de una misma pantalla). La de la página en que se está se anuncia como la actual (`aria-current`).
 * `forma="pildora"` las dibuja como botones con borde (los atajos del inicio en el teléfono); la `pestana` es la barra de siempre. `oscuro` es para sobre el carbón del hero (que no cambia con el modo); `claro`, para la barra de las páginas interiores, que sí sigue al modo.
 */
export function PestanasWeb({ activa, tono, forma = 'pestana' }: { activa: SeccionWeb | null; tono: 'oscuro' | 'claro'; forma?: 'pestana' | 'pildora' }) {
  const theme = useTheme();
  const texto = tono === 'oscuro' ? D.text : theme.text;
  const fondoActiva = tono === 'oscuro' ? D.backgroundSelected : theme.backgroundSelected;
  return (
    <View style={estilos.fila}>
      {PESTANAS.map((p) => {
        const seleccionada = activa === p.seccion;
        return (
          <Pulsable
            key={p.seccion}
            onPress={() => router.push(p.ruta as never)}
            accessibilityRole="link"
            accessibilityLabel={p.nombre}
            {...(seleccionada ? ACTUAL : {})}
            style={[estilos.pestana, forma === 'pildora' && [estilos.pildora, { borderColor: theme.filete, backgroundColor: theme.backgroundElement }], seleccionada && { backgroundColor: fondoActiva }]}
          >
            <Ionicons name={p.icono} size={20} color={texto} />
            <ThemedText style={[Texto.pequenoFuerte, { color: texto }]}>{p.nombre}</ThemedText>
          </Pulsable>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', gap: Spacing.one },
  pildora: { borderWidth: Filete.fino, paddingHorizontal: Spacing.four },
  pestana: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 44, paddingHorizontal: Spacing.three, borderRadius: Radios.full },
});
