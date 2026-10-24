import { router } from 'expo-router';

/**
 * Vuelve al login cuando la sesión termina (cerrarla o borrar la cuenta), VACIANDO el historial.
 *
 * `router.replace` solo cambia la pantalla de arriba: debajo se quedaban Configuración y las pestañas, y «atrás» devolvía a ellas, vacías pero visibles.
 * `dismissAll` saca todo lo apilado hasta la primera pantalla y el `replace` la cambia por el login: la pila queda con una sola pantalla.
 */
export function irAlLogin() {
  if (router.canDismiss()) router.dismissAll();
  router.replace('/(auth)/login');
}
