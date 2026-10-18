import { useCallback, useMemo } from 'react';

import { fuenteMiniatura, type FuenteFoto } from '@/lib/miniaturas';
import { supabaseClavePublica, supabaseUrlPublica } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';

const SIN_FUENTES: Map<string, FuenteFoto> = new Map();

/**
 * Las miniaturas de las rutas visibles, SIN red: es solo armar URLs con la sesión en cabeceras (ver `lib/miniaturas.ts`). Devuelve una función: dada una ruta
 * da su fuente, o `null` si no hay miniatura posible (ruta nula, URL externa, sin sesión) y entonces la tarjeta usa la foto completa. Se vuelve a armar cuando cambia el token de la sesión.
 */
export function useMiniaturas(rutas: (string | null | undefined)[], ancho: number): (ruta: string | null | undefined) => FuenteFoto | null {
  const token = useAuthStore((s) => s.session?.access_token);
  const clave = [...new Set(rutas.filter((r): r is string => Boolean(r)))].sort().join('|');

  const mapa = useMemo(() => {
    if (!clave || !token) return SIN_FUENTES;
    const m = new Map<string, FuenteFoto>();
    for (const ruta of clave.split('|')) {
      const f = fuenteMiniatura(supabaseUrlPublica, supabaseClavePublica, token, ruta, ancho);
      if (f) m.set(ruta, f);
    }
    return m;
  }, [clave, token, ancho]);

  // Un accesor y no el mapa: así «¿hay miniatura para esta ruta?» (ruta nula, externa o sin sesión) se resuelve y se prueba AQUÍ, no en cada pantalla.
  return useCallback((ruta: string | null | undefined) => (ruta ? (mapa.get(ruta) ?? null) : null), [mapa]);
}
