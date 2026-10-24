import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * Llama a `fn` cada vez que la app vuelve a primer plano (de segundo plano o de «inactive», el selector de apps de iOS).
 *
 * Existe porque `lib/consultas.ts` desactiva `refetchOnWindowFocus` a propósito (reconsultar en cada vuelta del selector de fotos o de WhatsApp es
 * gastar batería), pero volver de Mercado Pago SÍ pide refrescar: el pago se confirmó fuera de la app. Usa siempre la última `fn`, sin suscribirse otra vez.
 */
export function useAlVolverAPrimerPlano(fn: () => void) {
  const ultima = useRef(fn);
  useEffect(() => {
    ultima.current = fn;
  });

  useEffect(() => {
    let anterior: AppStateStatus = AppState.currentState;
    const suscripcion = AppState.addEventListener('change', (estado) => {
      if (anterior !== 'active' && estado === 'active') ultima.current();
      anterior = estado;
    });
    return () => suscripcion.remove();
  }, []);
}
