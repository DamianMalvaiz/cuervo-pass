import { useEffect, useState } from 'react';
import { Platform, Text, type TextStyle } from 'react-native';

import { useMovimientoReducido } from '@/hooks/use-movimiento-reducido';
import { valorContado } from '@/lib/movimientoWeb';

/**
 * Una cifra que cuenta hasta su valor al aparecer (la del ajuste de la portada, que cae después de las fotos: `retardoMs` la sincroniza con el sello). El valor real está ya en el primer pintado, así que sin JavaScript,
 * en el HTML exportado o con «reducir movimiento» se ve la cifra final; solo cuando se sabe que SÍ hay movimiento arranca desde 0 (la tarjeta aún está oculta por su animación, así que no hay parpadeo).
 */
export function CifraAnimadaWeb({ valor, retardoMs = 0, duracionMs = 900, style }: { valor: number; retardoMs?: number; duracionMs?: number; style?: TextStyle | TextStyle[] }) {
  const reducido = useMovimientoReducido();
  const [mostrado, setMostrado] = useState(valor);

  useEffect(() => {
    // `null` es «todavía no sé»: no se anima hasta saber que no pidió reducir movimiento.
    if (Platform.OS !== 'web' || reducido !== false) return;
    let cuadro = 0;
    const inicio = performance.now() + retardoMs;
    // El primer cuadro (aún antes del retraso) la pone en 0: la tarjeta sigue oculta por su animación, así que no hay parpadeo.
    const paso = (ahora: number) => {
      const transcurrido = ahora - inicio;
      setMostrado(valorContado(valor, transcurrido, duracionMs));
      if (transcurrido < duracionMs) cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [valor, retardoMs, duracionMs, reducido]);

  return <Text style={style}>{mostrado}</Text>;
}
