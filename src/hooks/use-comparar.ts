import { useEffect, useMemo, useSyncExternalStore } from 'react';

import { hidratarAlmacen } from '@/lib/almacenLocal';
import { MAX_COMPARAR, alternarComparar, compararCrudo, leerComparar, suscribirComparar } from '@/lib/comparar';

/** La lista de comparar de este navegador. En la página generada (sin navegador) y en la primera pintura está vacía. */
export function useComparar() {
  // En la app la lista vive en AsyncStorage: se lee a la copia en memoria la primera vez que alguien la usa (en la web no hace nada).
  useEffect(() => void hidratarAlmacen(), []);
  const crudo = useSyncExternalStore(suscribirComparar, compararCrudo, () => '');
  const ids = useMemo(() => leerComparar(crudo), [crudo]);
  return { ids, lleno: ids.length >= MAX_COMPARAR, alternar: alternarComparar };
}
