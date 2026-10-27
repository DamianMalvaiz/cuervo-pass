import { useCallback, useEffect, useState } from 'react';

import { ErrorAdmin, type TipoErrorAdmin } from './errores';

export type Carga<T> = { fase: 'cargando' } | { fase: 'ok'; datos: T } | { fase: 'error'; tipo: TipoErrorAdmin };

/** Tres estados, no dos (cargando, falló, datos): un fallo nunca se confunde con «no hay nada». `recargar` vuelve a pedir. */
export function useCarga<T>(pedir: () => Promise<T>): { estado: Carga<T>; recargar: () => void } {
  const [estado, setEstado] = useState<Carga<T>>({ fase: 'cargando' });
  const [vez, setVez] = useState(0);

  useEffect(() => {
    let vivo = true;
    setEstado({ fase: 'cargando' });
    pedir().then(
      (datos) => vivo && setEstado({ fase: 'ok', datos }),
      (e: unknown) => vivo && setEstado({ fase: 'error', tipo: e instanceof ErrorAdmin ? e.tipo : 'desconocido' }),
    );
    return () => {
      vivo = false;
    };
  }, [pedir, vez]);

  return { estado, recargar: useCallback(() => setVez((n) => n + 1), []) };
}
