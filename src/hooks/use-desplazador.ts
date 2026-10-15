import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useMovimientoReducido } from '@/hooks/use-movimiento-reducido';

/**
 * Cuánto queda POR DEBAJO del borde superior de la vista el nodo al que se
 * desplaza. Lo bastante para que se vea también el campo que está sobre el
 * mensaje de error —la etiqueta y una entrada de 52 pt—, y no solo el mensaje.
 */
export const MARGEN_SUPERIOR = Spacing.six + Spacing.four;

/**
 * El tipo de `ScrollView` de React Native no declara `measureInWindow`, pero el
 * ref que entrega SÍ es el nodo nativo y lo tiene: es el mismo que usan `View` y
 * `Text`. Se declara aquí lo que se usa en vez de silenciar el compilador.
 */
type ScrollMedible = ScrollView & Pick<View, 'measureInWindow'>;

/** Lo único que un formulario necesita de la pantalla que lo contiene. */
export interface Desplazador {
  /** Lleva la vista hasta `nodo`. No hace nada si el ScrollView no está montado. */
  alNodo: (nodo: Pick<View, 'measureInWindow'>) => void;
}

/**
 * Scroll al primer error · las piezas del lado de la PANTALLA.
 *
 * El `ScrollView` es de cada pantalla y el formulario no puede moverlo. Con un
 * pie fijo y un formulario de dieciséis campos, un error puede quedar a varias
 * pantallas de donde se tocó el botón; el aviso dice QUÉ revisar y esto lleva
 * hasta allí.
 *
 *   const { registrarScroll, onScroll, desplazador } = useDesplazador();
 *   <ScrollView ref={registrarScroll} onScroll={onScroll} scrollEventThrottle={16}>
 *     <Formulario desplazador={desplazador} />
 *
 * Se devuelven las tres piezas por separado, y no un objeto, a propósito: el
 * compilador de React marca como «acceso a un ref durante el render» cualquier
 * propiedad leída de un objeto que sale de un hook que usa refs por dentro.
 * Desestructurar lo evita, y `desplazador` ya viene memoizado, así que conserva su
 * identidad entre renders.
 *
 * ── Por qué se mide en la VENTANA ──────────────────────────────────────────
 * `measureInWindow` funciona igual en iOS y Android y sobre cualquier nodo, sin
 * depender de qué ancestro lo contiene (`measureLayout` exige un ref al contenedor
 * nativo exacto). Un nodo da su posición en la ventana, así que para saber dónde
 * está DENTRO del contenido hay que restarle la posición del ScrollView y sumarle
 * lo que ya se desplazó. Por eso se sigue el desplazamiento con `onScroll`.
 *
 * Sin verificar en un dispositivo: la cuenta se comprueba en Jest, pero que la
 * medición devuelva lo esperado en cada plataforma solo se puede juzgar allí.
 */
export function useDesplazador() {
  // El ScrollView se guarda aquí y se entrega a la pantalla como un ref de
  // CALLBACK, no como un objeto ref. Un objeto que contiene un ref no puede pasarse
  // por props ni leerse durante el render (lo marca el compilador de React), y la
  // pantalla lo recibe como valor: `registrarScroll` es solo una función.
  const scrollRef = useRef<ScrollMedible | null>(null);
  const registrarScroll = useCallback((nodo: ScrollView | null) => {
    scrollRef.current = nodo as ScrollMedible | null;
  }, []);
  const desplazamiento = useRef(0);

  // Una animación ES movimiento: con «reducir movimiento» el salto es directo. Va
  // en un ref para que `alNodo` conserve su identidad aunque la preferencia
  // cambie; mientras no se sabe (`null`) se anima, que es lo que hace el sistema.
  // Se sincroniza en un efecto y no durante el render, que es donde no se pueden
  // tocar los refs.
  const reducido = useMovimientoReducido();
  const reducidoRef = useRef(reducido);
  useEffect(() => {
    reducidoRef.current = reducido;
  }, [reducido]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    desplazamiento.current = e.nativeEvent.contentOffset.y;
  }, []);

  const alNodo = useCallback((nodo: Pick<View, 'measureInWindow'>) => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    scroll.measureInWindow((_x, yScroll) => {
      nodo.measureInWindow((_nx, yNodo) => {
        const destino = desplazamiento.current + (yNodo - yScroll) - MARGEN_SUPERIOR;
        scroll.scrollTo({ y: Math.max(0, destino), animated: reducidoRef.current !== true });
      });
    });
  }, []);

  // Un objeto nuevo en cada render haría que quien lo recibe por prop y lo pone en
  // las dependencias de un efecto lo volviera a ejecutar con cada pulsación.
  const desplazador = useMemo<Desplazador>(() => ({ alNodo }), [alNodo]);
  return { registrarScroll, onScroll, desplazador };
}
