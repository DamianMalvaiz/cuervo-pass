import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Filete, Radios, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * «Por qué es buena para ti» · Cuervo 360. Reemplaza al desglose «9.4 = 60 % filtros + 40 % afinidad».
 *
 * Una lista corta de razones con una palomita lima. Solo se pintan las que SE CUMPLEN (ver
 * `razonesDeAjuste`); sin ninguna, no se pinta el recuadro vacío. La palomita es relleno lima con el trazo en
 * carbón encima: el lima nunca es el color de un trazo.
 */
export function PorQueEsBuena({ razones }: { razones: string[] }) {
  const theme = useTheme();
  if (razones.length === 0) return null;

  return (
    <View style={[estilos.tarjeta, { backgroundColor: theme.backgroundElement, borderColor: theme.filete }]}>
      <ThemedText type="smallBold">Por qué es buena para ti</ThemedText>
      {razones.map((razon) => (
        <View key={razon} style={estilos.fila}>
          <View style={[estilos.palomita, { backgroundColor: theme.lima }]}>
            <Ionicons name="checkmark" size={14} color={theme.limaTexto} />
          </View>
          <ThemedText type="small" style={estilos.texto}>
            {razon}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: { borderWidth: Filete.fino, borderRadius: Radios.tarjeta, padding: Spacing.three, gap: Spacing.two },
  fila: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  palomita: { width: 22, height: 22, borderRadius: Radios.full, alignItems: 'center', justifyContent: 'center' },
  texto: { flex: 1 },
});
