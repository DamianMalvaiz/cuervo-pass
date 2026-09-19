import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Filete, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * La acción principal, fija al pie de la pantalla.
 *
 * En un formulario largo —el cuestionario tiene cinco secciones, el de
 * publicación dieciséis campos— el botón de guardar queda al final de todo. Eso
 * obliga a deslizar hasta abajo para confirmar, y peor: mientras editas un campo
 * de en medio no tienes ninguna pista de que exista una acción pendiente.
 *
 * Fijado al pie está siempre a la vista y siempre al alcance del pulgar.
 *
 * Se separa del contenido con filete, no con sombra, como el resto de este
 * mundo. Y respeta el inset inferior: sin eso, en un teléfono con barra de
 * gestos el botón queda debajo de la raya de inicio.
 */
export function PieFijo({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        estilos.pie,
        {
          borderTopColor: theme.border,
          backgroundColor: theme.background,
          paddingBottom: Math.max(insets.bottom, Spacing.three),
        },
      ]}
    >
      {children}
    </View>
  );
}

const estilos = StyleSheet.create({
  pie: {
    borderTopWidth: Filete.fino,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
});
