// Los ayudantes del movimiento de la web. Las animaciones viven en `src/global.css` (solo sin «reducir movimiento»); aquí se marca QUÉ elemento lleva cuál y la curva de la cifra que cuenta.

const MAX_PASO = 8;

/**
 * Los atributos que encienden una animación del CSS global (React Native Web vuelve `dataSet` en `data-*`). Se esparce en el elemento: `<View {...anim('sube', 2)} />`.
 * `paso` es el lugar en una fila o lista (70 ms por escalón): entero, de 1 a 8, para que el retraso total tenga tope. El primero (0) no lleva retraso. Devuelve `object` para esparcirlo sin pelear con los tipos de React Native.
 */
export function anim(nombre: string, paso?: number): object {
  const escalon = paso === undefined ? 0 : Math.min(Math.max(Math.round(paso), 0), MAX_PASO);
  return { dataSet: escalon > 0 ? { anim: nombre, paso: String(escalon) } : { anim: nombre } };
}

/** Una tarjeta de una rejilla: entra en escalera (`paso`) y se marca para el levantado y el acercamiento de la foto al pasar el cursor (`data-tarjeta`, CSS global). */
export function animTarjeta(paso?: number): object {
  const { dataSet } = anim('sube', paso) as { dataSet: Record<string, string> };
  return { dataSet: { tarjeta: '1', ...dataSet } };
}

/**
 * El valor de una cifra que cuenta de 0 a `final` en `duracionMs`, con salida exponencial (arranca rápido y se asienta). Entero siempre, nunca pasa de `final` y termina EXACTO en él.
 */
export function valorContado(final: number, transcurridoMs: number, duracionMs: number): number {
  if (duracionMs <= 0 || transcurridoMs >= duracionMs) return final;
  if (transcurridoMs <= 0) return 0;
  const avance = 1 - Math.pow(2, -10 * (transcurridoMs / duracionMs));
  return Math.min(final, Math.floor(final * avance));
}
