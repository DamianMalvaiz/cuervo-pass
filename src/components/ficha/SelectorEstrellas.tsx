import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { Pulsable } from '@/components/ficha/Pulsable';
import { useTheme } from '@/hooks/use-theme';

/** Cinco estrellas tocables para elegir de 1 a 5. Cada una lleva su etiqueta («3 estrellas») y su estado seleccionado. */
export function SelectorEstrellas({ valor, onCambiar }: { valor: number; onCambiar: (n: number) => void }) {
  const theme = useTheme();
  return (
    <View style={estilos.fila} accessibilityRole="radiogroup">
      {[1, 2, 3, 4, 5].map((n) => (
        <Pulsable
          key={n}
          onPress={() => onCambiar(n)}
          accessibilityRole="radio"
          accessibilityLabel={n === 1 ? '1 estrella' : `${n} estrellas`}
          accessibilityState={{ selected: n === valor }}
          style={estilos.estrella}
        >
          <Ionicons name={n <= valor ? 'star' : 'star-outline'} size={30} color={theme.text} />
        </Pulsable>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row' },
  estrella: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
