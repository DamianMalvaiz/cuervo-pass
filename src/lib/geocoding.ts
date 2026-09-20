// Documento maestro v5 · §9 (AUD-02) y §27.
//
// Sustituye a lib/mapbox.ts para TODO lo que se guarda en la base.
//
// Por qué: Mapbox separa geocodificación temporal —resultados usados al vuelo,
// 100k gratis al mes— de geocodificación permanente, que es la única que
// permite almacenar los resultados y no tiene capa gratuita. El esquema guarda
// latitud y longitud en `publicaciones`: eso es uso permanente. El problema no
// era de costo sino de licencia.
//
// Además, v3 geocodificaba DESDE EL CLIENTE con un token EXPO_PUBLIC_. Un token
// público sin restricción de URL, dentro de un APK que cualquiera descomprime,
// es una factura abierta al mundo — y Mapbox no tiene topes de gasto duros que
// la corten automáticamente.
//
// Nominatim sobre OpenStreetMap (ODbL) sí permite almacenar y derivar. Las
// obligaciones (atribución, una petición por segundo, User-Agent identificable)
// se cumplen del lado del servidor, en supabase/functions/geocodificar.
//
// El autocompletado de calles (lib/mapboxAutocomplete.ts) SÍ sigue usando
// Mapbox: ahí el resultado se usa al vuelo y no se almacena, que es exactamente
// el uso que la capa gratuita cubre.

import { supabase } from '@/lib/supabase';
import { aviso } from '@/lib/registro';

export interface Coordenadas {
  lat: number;
  lng: number;
  /** Proveedor y licencia, para saber qué coordenadas vinieron de dónde (AUD-02). */
  proveedor: string;
}

/**
 * Nunca truena el flujo de publicar o de completar el cuestionario si el
 * geocoding falla (§27): devuelve null y quien llama guarda la fila con
 * `pendiente_geocoding = true` para reintentar después.
 */
export async function geocodificarDireccion(direccion: string): Promise<Coordenadas | null> {
  try {
    const { data, error } = await supabase.functions.invoke('geocodificar', {
      body: { direccion },
    });
    if (error) {
      aviso('geocodificar falló', { detalle: error.message });
      return null;
    }
    const { latitud, longitud, proveedor } = data as {
      latitud: number | null;
      longitud: number | null;
      proveedor: string | null;
    };
    if (latitud == null || longitud == null) return null;
    return { lat: latitud, lng: longitud, proveedor: proveedor ?? 'desconocido' };
  } catch (e) {
    aviso('geocodificar no respondió', undefined, e);
    return null;
  }
}

/** Obligación de atribución de la licencia ODbL. Se muestra en el detalle de
 *  publicación y se declara en el README. */
export const ATRIBUCION_MAPA = '© OpenStreetMap contributors';
