import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useMovimientoReducido } from '@/hooks/use-movimiento-reducido';
import { useTheme } from '@/hooks/use-theme';
import { toque } from '@/lib/tacto';

/**
 * El corazón, sin saber de qué es favorito (publicación o negocio). Responde al instante; mientras no se sabe qué hay guardado queda
 * desactivado, porque tocar sin saber el estado guardaría lo que ya estaba o quitaría lo que nunca estuvo. El estado no depende solo del
 * color: cambia el glifo, la etiqueta y `selected`. El brinco al guardar respeta «reducir movimiento».
 */
export function CorazonFavorito({ guardado, cargando, onAlternar }: { guardado: boolean; cargando: boolean; onAlternar: () => void }) {
  const theme = useTheme();
  const reducido = useMovimientoReducido();
  const escala = useSharedValue(1);
  const animado = useAnimatedStyle(() => ({ transform: [{ scale: escala.get() }] }));

  const onPress = () => {
    if (cargando) return;
    toque();
    if (!guardado && !reducido) {
      escala.set(1.3);
      escala.set(withSpring(1));
    }
    onAlternar();
  };

  return (
    // respuesta-ok: el corazón ya anima su propia respuesta con un resorte
    <Pressable
      onPress={onPress}
      disabled={cargando}
      accessibilityRole="button"
      accessibilityLabel={guardado ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      accessibilityState={{ selected: guardado, disabled: cargando }}
      style={estilos.boton}
    >
      <Animated.View style={animado}>
        <Ionicons name={guardado ? 'heart' : 'heart-outline'} size={24} color={guardado ? theme.bosque : theme.textSecondary} />
      </Animated.View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  boton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
