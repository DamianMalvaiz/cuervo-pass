import { useMemo, useSyncExternalStore } from 'react';

import { leerVistos, suscribirVistos, vistosCrudos } from '@/lib/vistos';

/** Los ids de las fichas que esta persona abrió en este navegador, la más reciente primero. En la página generada (sin navegador) y en la primera pintura no hay ninguno; lo de otra pestaña también llega. */
export function useVistos() {
  const crudo = useSyncExternalStore(suscribirVistos, vistosCrudos, () => '');
  return useMemo(() => leerVistos(crudo), [crudo]);
}
