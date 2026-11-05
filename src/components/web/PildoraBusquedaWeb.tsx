import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { ThemedText } from '@/components/themed-text';
import { Colors, Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const D = Colors.dark;

/**
 * La píldora de búsqueda del teléfono: una sola barra grande en vez de un formulario. En el inicio lleva a `/departamentos`; ahí despliega los campos. Dice qué se busca (o qué se buscó) en dos renglones.
 * `expandida` (si se pasa) la anuncia como botón desplegable.
 */
export function PildoraBusquedaWeb({ titulo, subtitulo, onPress, expandida }: { titulo: string; subtitulo: string; onPress: () => void; expandida?: boolean }) {
  const theme = useTheme();
  const desplegable = expandida === undefined ? {} : { 'aria-expanded': expandida };
  return (
    <Pulsable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${titulo}. ${subtitulo}`}
      {...desplegable}
      style={[estilos.pildora, { backgroundColor: theme.backgroundElement, borderColor: theme.filete }]}
    >
      <View style={estilos.lupa}>
        <Ionicons name="search" size={20} color={D.limaTexto} />
      </View>
      <View style={estilos.textos}>
        <ThemedText style={Texto.pequenoFuerte} numberOfLines={1}>{titulo}</ThemedText>
        <ThemedText style={Texto.pequeno} themeColor="textSecondary" numberOfLines={1}>{subtitulo}</ThemedText>
      </View>
    </Pulsable>
  );
}

const estilos = StyleSheet.create({
  pildora: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 64,
    paddingHorizontal: Spacing.three,
    borderRadius: Radios.full,
    borderWidth: Filete.fino,
    boxShadow: '0px 10px 24px -12px rgba(10, 14, 11, 0.45), 0px 2px 6px rgba(10, 14, 11, 0.1)',
  },
  lupa: { width: 40, height: 40, borderRadius: Radios.full, backgroundColor: D.lima, alignItems: 'center', justifyContent: 'center' },
  textos: { flex: 1, minWidth: 0 },
});
