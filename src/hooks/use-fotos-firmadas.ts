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
 *
 * END-25 · Devuelve además `fallo`. Sin él, una caída de Storage era
 * indistinguible de una publicación sin fotos: la app se quedaba sin imágenes y
 * no lo decía. Que el fallo llegue a quien pinta es lo que permite enseñarlo.
 */
export function useFotosFirmadas(
  rutas: (string | null | undefined)[]
): { urls: Map<string, string>; fallo: string | null } {
  const [urls, setUrls] = useState<Map<string, string>>(SIN_URLS);
  const [fallo, setFallo] = useState<string | null>(null);

  // Clave estable: sin esto el efecto se dispararía en cada render, porque el
  // array de rutas es nuevo cada vez aunque su contenido sea idéntico.
  const clave = rutas.filter(Boolean).join('|');

  useEffect(() => {
    if (!clave) return;
    let activo = true;
    firmarRutas(clave.split('|')).then((r) => {
      if (!activo) return;
      if (r.estado === 'ok') {
        setUrls(r.datos);
        setFallo(null);
      } else {
        // No se borran las URLs que ya había: perder las fotos visibles por un
        // fallo posterior sería el mismo defecto que END-11 en otra pantalla.
        setFallo(r.estado === 'error' ? r.mensaje : 'No pudimos cargar las fotos.');
      }
    });
    return () => {
      activo = false;
    };
  }, [clave]);

  // Cuando la lista se vacía se devuelve el mapa vacío directamente, en vez de
  // limpiar el estado desde el efecto: un setState síncrono ahí dentro provoca
  // renders en cascada, y aquí el valor se puede derivar sin estado.
  return { urls: clave ? urls : SIN_URLS, fallo };
}
