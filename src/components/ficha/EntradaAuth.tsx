import { useEffect } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { Filete } from '@/constants/theme';
import { useMovimientoReducido } from '@/hooks/use-movimiento-reducido';
import { useTheme } from '@/hooks/use-theme';

/**
 * La entrada de las pantallas de acceso (login, registro, recuperar contraseña).
 *
 * Frecuencia: una vez por sesión, así que cabe en el presupuesto de «deleite»; pero entera dura menos de un segundo y solo corre al
 * montar la pantalla, nunca al teclear. Propósito: que la pantalla no aparezca de golpe y que el primer contacto tenga identidad
 * («La Ficha»: una línea que se traza y un botón que cae como un sello).
 *
 * Todo corre en el hilo de UI (`entering` y valores compartidos de Reanimated). Con «reducir movimiento» no hay desplazamiento,
 * escala ni trazo: el contenido ya está en su sitio. `null` («todavía no sé») cuenta como reducido, igual que en `Pulsable`.
 *
 * Línea de tiempo del login: encabezado 0 ms · filete 150 ms (420 ms) · campos cada 70 ms · botón ~420 ms con golpe de 180 ms.
 */

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const MS_ENTRADA = 300;
const MS_ENTRE_ELEMENTOS = 70;
const MS_INICIO = 60;
/** Más allá de este orden todo entra a la vez: un formulario largo no puede tardar en dejarse usar. */
const TOPE_ORDEN = 6;

/** Un bloque que sube suave y aparece. `orden` escalona: 0 entra primero. */
export function Entrada({
  orden,
  children,
  style,
  testID,
}: {
  orden: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const reducido = useMovimientoReducido();
  const animar = reducido === false;
  const retraso = MS_INICIO + Math.min(orden, TOPE_ORDEN) * MS_ENTRE_ELEMENTOS;

  return (
    <Animated.View
      testID={testID}
      style={style}
      entering={animar ? FadeInDown.duration(MS_ENTRADA).delay(retraso).easing(EASE_OUT) : undefined}
    >
      {children}
    </Animated.View>
  );
}

/** El filete del membrete: se traza de izquierda a derecha. Es un relleno de 2 pt, no un elemento con hijos. */
export function FileteQueSeTraza({ retraso = 150 }: { retraso?: number }) {
  const theme = useTheme();
  const reducido = useMovimientoReducido();
  const progreso = useSharedValue(0);

  useEffect(() => {
    if (reducido === null) return;
    if (reducido) progreso.set(1);
    else progreso.set(withDelay(retraso, withTiming(1, { duration: 420, easing: EASE_OUT })));
  }, [reducido, retraso, progreso]);

  const animado = useAnimatedStyle(() => ({ transform: [{ scaleX: progreso.get() }] }));

  return <Animated.View style={[estilos.filete, { backgroundColor: theme.text }, animado]} />;
}

/** El botón principal «cae» sobre la hoja: entra un poco grande y se asienta. Sin háptico: no lo provocó un toque. */
export function GolpeDeSello({
  children,
  retraso = 420,
  style,
}: {
  children: React.ReactNode;
  retraso?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reducido = useMovimientoReducido();
  const escala = useSharedValue(1.08);
  const opacidad = useSharedValue(0);

  useEffect(() => {
    if (reducido === null) return;
    if (reducido) {
      escala.set(1);
      opacidad.set(1);
      return;
    }
    opacidad.set(withDelay(retraso, withTiming(1, { duration: 140, easing: EASE_OUT })));
    escala.set(withDelay(retraso, withTiming(1, { duration: 180, easing: EASE_OUT })));
  }, [reducido, retraso, escala, opacidad]);

  const animado = useAnimatedStyle(() => ({ opacity: opacidad.get(), transform: [{ scale: escala.get() }] }));

  return <Animated.View style={[style, animado]}>{children}</Animated.View>;
}

const estilos = StyleSheet.create({
  filete: { height: Filete.grueso, transformOrigin: 'left center' },
});
