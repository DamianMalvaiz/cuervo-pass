import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

const suscribirseSinCambios = () => () => {};

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web.
 * useSyncExternalStore evita el patrón "setState dentro de un efecto": el servidor siempre
 * ve 'light' y el cliente recalcula en cuanto hidrata, sin un render extra en cascada.
 */
export function useColorScheme() {
  const haHidratado = useSyncExternalStore(
    suscribirseSinCambios,
    () => true,
    () => false
  );

  const colorScheme = useRNColorScheme();

  if (haHidratado) {
    return colorScheme;
  }

  return 'light';
}
