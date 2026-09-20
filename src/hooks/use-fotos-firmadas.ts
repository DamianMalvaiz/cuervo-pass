import { useQuery } from '@tanstack/react-query';

import { CADUCIDAD_SEGUNDOS, firmarRutas } from '@/lib/storage';

// Referencia estable para "sin fotos todavía": devolver un Map nuevo en cada
// render invalidaría a cualquier consumidor memoizado.
const SIN_URLS: Map<string, string> = new Map();

/**
 * Cada cuánto se vuelven a firmar las URLs · END-24
 *
 * Las firmas caducan a la hora y se pedían UNA sola vez, al montar. Una app
 * abierta más de sesenta minutos se quedaba **sin ninguna foto** —todas en
 * 403— y no se recuperaba nunca: el efecto ya había corrido y no volvía a
 * correr mientras la pantalla siguiera montada.
 *
 * No es un caso raro. Alguien que deja la app abierta mientras come, o el
 * teléfono conectado durante una exposición, lo ve.
 *
 * Cincuenta minutos deja diez de holgura sobre la caducidad. El margen no es
 * decorativo: la refirma es una petición de red que puede tardar o fallar y
 * reintentarse, y sin holgura el reintento llegaría cuando las URLs ya no
 * sirven.
 */
export const INTERVALO_REFIRMA_MS = 50 * 60 * 1000;

/**
 * Documento maestro v5 · §14 · AUD-08 — firma en LOTE.
 *
 * Con el bucket privado, cada foto necesita una URL firmada. Pedirlas de una en
 * una desde cada tarjeta convierte una lista de diez publicaciones con cinco
 * fotos en cincuenta viajes de ida y vuelta antes de pintar nada. Este hook
 * junta todas las rutas visibles y las firma en una sola petición.
 *
 * END-25 · Devuelve además `fallo`. Sin él, una caída de Storage era
 * indistinguible de una publicación sin fotos: la app se quedaba sin imágenes y
 * no lo decía.
 */
export function useFotosFirmadas(
  rutas: (string | null | undefined)[]
): { urls: Map<string, string>; fallo: string | null } {
  // Clave ORDENADA: la misma lista en distinto orden es la misma consulta, y
  // sin ordenar se firmarían dos veces las mismas fotos —una por cada orden en
  // que una pantalla las liste—, que es justo lo que AUD-08 vino a evitar.
  const limpias = [...new Set(rutas.filter((r): r is string => Boolean(r)))].sort();
  const clave = limpias.join('|');

  const q = useQuery({
    queryKey: ['fotosFirmadas', clave],
    queryFn: () => firmarRutas(limpias),
    enabled: limpias.length > 0,
    // Se refrescan solas antes de caducar, incluso con la pantalla quieta: el
    // problema no era que nadie las pidiera, era que nadie las volvía a pedir.
    refetchInterval: INTERVALO_REFIRMA_MS,
    refetchIntervalInBackground: false,
    // `staleTime` igual al intervalo: dentro de ese periodo las firmas valen, y
    // volver a la pantalla no debe gastar una petición en refirmar lo vigente.
    staleTime: INTERVALO_REFIRMA_MS,
  });

  // Las URLs que ya funcionaban NO se borran por un fallo posterior: perder las
  // fotos visibles por un refresco fallido sería el mismo defecto que END-11 en
  // otra capa. `q.data` conserva el último resultado bueno.
  const resultado = q.data;
  const urls = resultado?.estado === 'ok' ? resultado.datos : SIN_URLS;

  const fallo =
    resultado?.estado === 'error'
      ? resultado.mensaje
      : q.isError
        ? 'No pudimos cargar las fotos.'
        : null;

  return { urls, fallo };
}

/** Se reexporta para que una prueba pueda comprobar el margen sin importar dos módulos. */
export { CADUCIDAD_SEGUNDOS };
