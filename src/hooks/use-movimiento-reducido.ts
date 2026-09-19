import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * ¿El sistema pide reducir el movimiento?
 *
 * iOS lo llama «Reducir movimiento» y Android «Eliminar animaciones». Quien lo
 * activa no lo hace por gusto: para algunas personas el movimiento repetido
 * produce náusea o desencadena migraña, y un pulso que late sin parar en media
 * pantalla es exactamente ese caso.
 *
 * Se consulta el valor inicial Y se escucha el cambio: alguien puede activarlo
 * con la app abierta, precisamente porque le está molestando.
 *
 * Devuelve `null` mientras NO SE SABE, y ese tercer estado es el punto entero.
 * `AccessibilityInfo.isReduceMotionEnabled()` es una promesa: empezando en
 * `false`, el primer render arranca la animación y el segundo la apaga, así que
 * quien pidió no ver movimiento ve un destello de movimiento. Es un fallo
 * pequeño y es exactamente el de la persona a la que esto intenta servir.
 *
 * Lo atrapó una prueba que contaba las llamadas a `withRepeat`: eran tres antes
 * de conocerse la preferencia. Mirar solo el estado final habría dado verde.
 *
 * Si la consulta falla se asume `false` —hay movimiento—, que es lo que el
 * sistema hace por defecto. No es «fallar abierto» en el sentido del invariante
 * 1: aquí no hay nada que proteger, y suprimir la animación ante un fallo de
 * lectura degradaría la app para todos por un error que no es de nadie.
 */
export function useMovimientoReducido(): boolean | null {
  const [reducido, setReducido] = useState<boolean | null>(null);

  useEffect(() => {
    let vivo = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => { if (vivo) setReducido(v); })
      .catch(() => { if (vivo) setReducido(false); });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducido);
    return () => {
      vivo = false;
      sub?.remove();
    };
  }, []);

  return reducido;
}
