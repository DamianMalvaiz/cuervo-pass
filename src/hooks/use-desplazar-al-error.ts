import { useCallback, useEffect, useRef, useState } from 'react';
import type { View } from 'react-native';

import type { Desplazador } from '@/hooks/use-desplazador';

/**
 * Scroll al primer error · las piezas del lado del FORMULARIO.
 *
 * Los mensajes de error se anclan con `anclar('campo')`, que registra su nodo; y
 * tras un envío inválido `irAlCampo('campo')` pide al `desplazador` de la pantalla
 * que lleve la vista hasta ese ancla. El registro contiene solo los campos que
 * ESTÁN mal, porque el mensaje —y su ancla— solo se monta cuando hay error.
 *
 * Lo comparten el formulario de publicación y el de cuestionario: es la misma
 * maquinaria, y dos copias se desincronizan.
 *
 * ── Por qué es así ─────────────────────────────────────────────────────────
 *   · El ancla puede no existir todavía: los mensajes de error se montan en el
 *     render que sigue al envío. Se reintenta unos fotogramas antes de rendirse.
 *   · `irA` es un objeto NUEVO en cada intento. Con la misma cadena, un segundo
 *     fallo en el mismo campo no volvería a ejecutar el efecto.
 *   · El efecto depende SOLO de `irA`. `desplazador` se lee por ref: la pantalla
 *     puede recrearlo en cada render, y con esa dependencia la vista saltaría de
 *     vuelta al error con cada tecla.
 */
export function useDesplazarAlError(desplazador?: Desplazador) {
  const anclas = useRef(new Map<string, View>());
  const [irA, setIrA] = useState<{ campo: string } | null>(null);

  // Se sincroniza en un efecto —declarado ANTES del que desplaza, así que corre
  // antes en cada commit— y no durante el render, donde no se pueden tocar refs.
  const desplazadorActual = useRef(desplazador);
  useEffect(() => {
    desplazadorActual.current = desplazador;
  }, [desplazador]);

  /** Callback de ref para el mensaje de error de `campo`. */
  const anclar = useCallback(
    (campo: string) => (nodo: View | null) => {
      if (nodo) anclas.current.set(campo, nodo);
      else anclas.current.delete(campo);
    },
    []
  );

  /** Pide llevar la vista al mensaje de error de `campo`, en cuanto exista. */
  const irAlCampo = useCallback((campo: string) => setIrA({ campo }), []);

  useEffect(() => {
    if (!irA) return;
    let cuadro: number | undefined;
    const intentar = (vez: number) => {
      const nodo = anclas.current.get(irA.campo);
      if (nodo) {
        desplazadorActual.current?.alNodo(nodo);
      } else if (vez < 3) {
        cuadro = requestAnimationFrame(() => intentar(vez + 1));
      }
    };
    intentar(0);
    return () => {
      if (cuadro !== undefined) cancelAnimationFrame(cuadro);
    };
  }, [irA]);

  return { anclar, irAlCampo };
}
