import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';

/**
 * El espacio superior cuando la pantalla NO tiene barra de navegación.
 *
 * Al esconder la barra de las pestañas, lo que antes reservaba el hueco de la
 * muesca y de la barra de estado desapareció con ella. Sin esto, el título de
 * cada pantalla se pinta DEBAJO del reloj y de la cámara frontal.
 *
 * Sale del inset real del dispositivo, no de un número fijo: un iPhone con
 * Dynamic Island, uno sin muesca y un Android con barra de estado traslúcida
 * reservan alturas distintas, y ninguna es adivinable.
 */
export function useMargenSuperior(): number {
  const insets = useSafeAreaInsets();
  return insets.top + Spacing.two;
}
