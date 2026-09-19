import { Ionicons } from '@expo/vector-icons';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Una sección con carrusel horizontal: título, contador, y las fichas de lado.
 *
 * Es el patrón de la pantalla Explorar de Airbnb, y aquí sirve para algo que una
 * lista vertical sola no hacía: enseñar el MISMO conjunto viable bajo tres
 * lentes distintas —afinidad, cercanía, precio— sin obligar a cambiar un
 * desplegable y perder el sitio.
 *
 * El conteo va en el encabezado a propósito. Airbnb no lo pone porque su
 * catálogo es infinito; el tuyo no, y "4 publicaciones" es información real que
 * evita que alguien deslice buscando una quinta que no existe.
 */
export function Carrusel<T>({
  titulo,
  descripcion,
  datos,
  claveDe,
  renderizar,
  anchoItem,
  onVerTodo,
}: {
  titulo: string;
  descripcion?: string;
  datos: T[];
  claveDe: (item: T) => string;
  renderizar: (item: T) => React.ReactElement;
  anchoItem: number;
  onVerTodo?: () => void;
}) {
  const theme = useTheme();
  if (datos.length === 0) return null;

  return (
    <View style={estilos.seccion}>
      <View style={estilos.cabecera}>
        <View style={estilos.textos}>
          <ThemedText type="subtitle" numberOfLines={2}>
            {titulo}
          </ThemedText>
          <ThemedText type="folio" themeColor="textSecondary">
            {datos.length === 1 ? '1 PUBLICACIÓN' : `${datos.length} PUBLICACIONES`}
            {descripcion ? ` · ${descripcion.toUpperCase()}` : ''}
          </ThemedText>
        </View>
        {onVerTodo && (
          <Pressable
            onPress={onVerTodo}
            style={({ pressed }) => [
              estilos.verTodo,
              { borderColor: theme.border },
              pressed && estilos.presionado,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Ver todas: ${titulo}`}
            hitSlop={8}
          >
            <Ionicons name="arrow-forward" size={16} color={theme.text} />
          </Pressable>
        )}
      </View>

      <FlatList
        horizontal
        data={datos}
        keyExtractor={claveDe}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={estilos.tira}
        // Encaja en el ancho de una ficha más su separación: el carrusel se
        // detiene con una tarjeta completa a la vista, nunca partida a la mitad.
        snapToInterval={anchoItem + Spacing.three}
        decelerationRate="fast"
        renderItem={({ item }) => renderizar(item)}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  seccion: { gap: Spacing.three },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  textos: { flex: 1, gap: Spacing.half },
  verTodo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presionado: { opacity: 0.6 },
  tira: { paddingHorizontal: Spacing.three, gap: Spacing.three },
});
