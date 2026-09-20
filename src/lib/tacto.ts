import * as Haptics from 'expo-haptics';

/**
 * END-37 · El tacto, y por qué son solo dos.
 *
 * Este mundo se llama «La Ficha» y su pieza central es EL SELLO: el botón de ver
 * contacto, la única acción de toda la app que compromete algo —revela un
 * teléfono ajeno y consume cuota—. Un sello que no se siente al estampar es
 * media metáfora.
 *
 * Dos funciones y no ocho. El tacto se gasta: una app que vibra en cada toque
 * enseña a ignorarla, y entonces tampoco se siente lo que sí importaba. Por eso
 * la regla está en el nombre:
 *
 *   `sello()` — algo QUEDÓ REGISTRADO y no se deshace: se reveló un contacto, se
 *               publicó. Es la vibración de confirmación del sistema.
 *   `toque()`  — algo RESPONDIÓ: cambió el chip, salió el mensaje. Ligero, casi
 *               imperceptible; su trabajo es confirmar que el toque se registró,
 *               no anunciarse.
 *
 * ── Por qué está envuelto ───────────────────────────────────────────────────
 * `expo-haptics` es un módulo NATIVO. En un cliente de desarrollo compilado
 * antes de instalarlo, llamarlo lanza «Cannot find native module 'ExpoHaptics'»
 * y tumba la pantalla. Que una app se caiga por no poder vibrar sería absurdo:
 * aquí el fallo se traga y ya.
 *
 * Esto NO contradice el invariante 1. «Fallar cerrado» protege lo que decide
 * accesos; el tacto no decide nada. Lo que el invariante prohíbe es que la falta
 * de una pieza deje pasar a alguien, no que deje de vibrar un teléfono.
 *
 * ── Por qué NO mira «reducir movimiento» ────────────────────────────────────
 * La orden D.9 pide que «todo respete useReducedMotion()». El movimiento sí; el
 * tacto no. Son dos ajustes distintos y dos necesidades distintas: quien activa
 * reducir movimiento suele hacerlo por náusea o migraña, y para algunas de esas
 * personas la vibración es justamente el canal que SÍ tolera. iOS y Android
 * tienen su propio interruptor de vibración del sistema, y `expo-haptics` ya lo
 * obedece. Silenciarlo aquí sería decidir por alguien con el ajuste equivocado.
 */

async function intentar(accion: () => Promise<void>) {
  try {
    await accion();
  } catch {
    // Sin módulo nativo, sin motor de vibración, o con la vibración apagada en
    // el sistema. Los tres casos son el mismo desde aquí: no pasa nada.
  }
}

/** Quedó registrado y no se deshace. Revelar contacto, publicar. */
export function sello() {
  void intentar(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Respondió. Cambiar de chip, enviar un mensaje. */
export function toque() {
  void intentar(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}
