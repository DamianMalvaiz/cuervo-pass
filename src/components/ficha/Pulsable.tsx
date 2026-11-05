import { forwardRef } from 'react';
import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { useMovimientoReducido } from '@/hooks/use-movimiento-reducido';

const PressableAnimado = Animated.createAnimatedComponent(Pressable);

/**
 * END-37 · El único feedback de pulsación de toda la app era `opacity: 0.7`.
 *
 * Ese valor es el que React Native pone cuando nadie decide nada. Y dice algo
 * raro: que al tocar, la ficha se DESVANECE. En un mundo de papel, apretar un
 * documento no lo vuelve transparente — lo hunde un poco.
 *
 * Esto hunde: 0.97 de escala y un punto de opacidad, en 90 ms de ida y 140 de
 * vuelta. La vuelta es más lenta a propósito: el dedo se levanta de golpe y la
 * ficha vuelve a su sitio con algo de peso, como un papel que se recupera.
 *
 * ── Con «reducir movimiento» ────────────────────────────────────────────────
 * Una escala ES movimiento, así que desaparece. Queda el cambio de opacidad,
 * instantáneo: sigue habiendo respuesta al toque —que es lo que hace usable un
 * control— sin nada que se mueva. Apagar también la opacidad dejaría la app sin
 * ninguna confirmación táctil, que no es lo que ese ajuste pide.
 */

const ESCALA_HUNDIDO = 0.97;
const OPACIDAD_HUNDIDO = 0.9;
const MS_ENTRADA = 90;
const MS_SALIDA = 140;

export const Pulsable = forwardRef<
  React.ComponentRef<typeof Pressable>,
  PressableProps & { style?: StyleProp<ViewStyle> }
>(function Pulsable({ style, onPressIn, onPressOut, ...resto }, ref) {
  const reducido = useMovimientoReducido();
  const escala = useSharedValue(1);
  const opacidad = useSharedValue(1);

  // La opacidad animada se MULTIPLICA por la del propio estilo: parte de 1 y, sin esto, pisaba un `opacity: 0.45` (control deshabilitado) y lo volvía a
  // pintar activo. Un control que no se puede tocar nunca llega a animarse, así que su estilo era lo único que lo decía.
  const opacidadDelEstilo = StyleSheet.flatten(style as StyleProp<ViewStyle>)?.opacity;
  const opacidadBase = typeof opacidadDelEstilo === 'number' ? opacidadDelEstilo : 1;
  const animado = useAnimatedStyle(() => ({
    transform: [{ scale: escala.value }],
    opacity: opacidad.value * opacidadBase,
  }));

  const hundir = (v: boolean) => {
    // `reducido !== false` cubre el «todavía no sé» (D.8): sin eso, los primeros
    // toques tras abrir la app se animarían igual para quien pidió que no.
    if (reducido !== false) {
      escala.value = 1;
      opacidad.value = v ? 0.7 : 1;
      return;
    }
    const ms = v ? MS_ENTRADA : MS_SALIDA;
    const suave = { duration: ms, easing: Easing.out(Easing.cubic) };
    escala.value = withTiming(v ? ESCALA_HUNDIDO : 1, suave);
    opacidad.value = withTiming(v ? OPACIDAD_HUNDIDO : 1, suave);
  };

  return (
    <PressableAnimado
      ref={ref}
      style={[style, animado]}
      onPressIn={(e) => {
        hundir(true);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        hundir(false);
        onPressOut?.(e);
      }}
      {...resto}
    />
  );
});
