import { useMemo, useSyncExternalStore } from 'react';

import { MAX_COMPARAR, alternarComparar, compararCrudo, leerComparar, suscribirComparar } from '@/lib/comparar';

/** La lista de comparar de este navegador. En la página generada (sin navegador) y en la primera pintura está vacía. */
export function useComparar() {
  const crudo = useSyncExternalStore(suscribirComparar, compararCrudo, () => '');
  const ids = useMemo(() => leerComparar(crudo), [crudo]);
  return { ids, lleno: ids.length >= MAX_COMPARAR, alternar: alternarComparar };
}
