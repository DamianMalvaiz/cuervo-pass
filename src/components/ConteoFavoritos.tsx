import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useConteoFavoritos } from '@/hooks/queries/useFavoritos';
import { useTheme } from '@/hooks/use-theme';

/**
 * «N personas la guardaron» · Cuervo 360. Se ve el número y nunca quién (migración 0045).
 *
 * Es una señal secundaria. Mientras carga, si falla, si es cero o si no se puede ver, NO pinta nada:
 * mostrar «0 personas la guardaron» por un fallo de red diría algo falso (END-11), y un cero de
 * verdad no aporta nada que decir.
 */
export function ConteoFavoritos({ publicacionId }: { publicacionId: string }) {
  const theme = useTheme();
  const { conteos, cargando, fallo } = useConteoFavoritos([publicacionId]);

  const total = conteos.get(publicacionId);
  if (cargando || fallo || !total) return null;

  return (
    <View style={estilos.fila}>
      <Ionicons name="heart-outline" size={14} color={theme.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary">
        {total === 1 ? '1 persona la guardó' : `${total} personas la guardaron`}
      </ThemedText>
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
});
