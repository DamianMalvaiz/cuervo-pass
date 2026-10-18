import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Filete, Radios, Spacing, Texto } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Una condición a un vistazo, en pastilla · Cuervo 360.
 *
 * Reemplaza a la tabla de campos de la ficha de una publicación (17/10/2026). Va con icono y palabra, nunca
 * solo uno de los dos. `atenuada` es para lo que NO se cumple («No acepta mascotas», «Distancia sin dato»):
 * el dato existe y se dice, solo que sin el peso de lo que sí. No es interactiva.
 */
export function Pastilla({
  icono,
  texto,
  atenuada = false,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  texto: string;
  atenuada?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={[estilos.pastilla, { backgroundColor: theme.backgroundElement, borderColor: theme.filete }]}>
      <Ionicons name={icono} size={16} color={atenuada ? theme.textSecondary : theme.bosque} />
      <ThemedText type="small" themeColor={atenuada ? 'textSecondary' : 'text'} style={Texto.pesoFuerte}>
        {texto}
      </ThemedText>
    </View>
  );
}

const estilos = StyleSheet.create({
  // Sin alto fijo: el alto sale del texto y del relleno, y crece con el tamaño de letra del sistema.
  pastilla: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: Filete.fino,
    borderRadius: Radios.full,
  },
});
