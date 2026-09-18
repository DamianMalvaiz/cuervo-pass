import { useEffect, useState } from 'react';

import { firmarRutas } from '@/lib/storage';

// Referencia estable para "todavía no hay nada que firmar": devolver un Map
// nuevo en cada render haría que cualquier consumidor memoizado se invalide
// siempre.
const SIN_URLS: Map<string, string> = new Map();

/**
 * Documento maestro v5 · §14 · AUD-08 — firma en LOTE.
 *
 * Con el bucket privado, cada foto necesita una URL firmada. Pedirlas de una en
 * una desde cada tarjeta convierte una lista de diez publicaciones con cinco
 * fotos en cincuenta viajes de ida y vuelta antes de pintar nada. Este hook
 * junta todas las rutas visibles y las firma en una sola petición.
 *
 * Devuelve un mapa vacío mientras carga: las tarjetas muestran el marcador de
 * posición y se rellenan cuando llegan, en vez de quedarse en blanco.
 */
export function useFotosFirmadas(rutas: (string | null | undefined)[]): Map<string, string> {
  const [urls, setUrls] = useState<Map<string, string>>(SIN_URLS);

  // Clave estable: sin esto el efecto se dispararía en cada render, porque el
  // array de rutas es nuevo cada vez aunque su contenido sea idéntico.
  const clave = rutas.filter(Boolean).join('|');

  useEffect(() => {
    if (!clave) return;
    let activo = true;
    firmarRutas(clave.split('|')).then((mapa) => {
      if (activo) setUrls(mapa);
    });
    return () => {
      activo = false;
    };
  }, [clave]);

  // Cuando la lista se vacía se devuelve el mapa vacío directamente, en vez de
  // limpiar el estado desde el efecto: un setState síncrono ahí dentro provoca
  // renders en cascada, y aquí el valor se puede derivar sin estado.
  return clave ? urls : SIN_URLS;
}
