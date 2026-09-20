// Documento maestro v5 · §14 — Supabase Storage.
//
// El bucket dejó de ser público (migración 0016). Antes, cualquiera en internet
// que adivinara el patrón `perfiles/<uuid>.jpg` leía fotos de perfil sin tener
// sesión. Ahora las URLs se firman, con caducidad, y EN LOTE.
//
// Lo que se guarda en la base es la RUTA dentro del bucket, no una URL: una URL
// firmada caduca, y guardarla sería guardar un enlace roto con fecha.

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { supabase } from '@/lib/supabase';
import { aviso } from '@/lib/registro';
import { ok, problema, type Resultado } from '@/lib/resultado';

const BUCKET = 'fotos';
export const CADUCIDAD_SEGUNDOS = 60 * 60;   // una hora: sobra para una sesión de uso

// Comprime/redimensiona antes de subir — nunca mandamos el archivo original de
// la cámara. Una foto de celular ronda los 4 MB; diez publicaciones con cinco
// fotos llenan medio gigabyte por nada.
//
// END-26 · API CONTEXTUAL. `manipulateAsync` está marcada `@deprecated` en la
// versión instalada. No es solo cambiar de nombre: la forma vieja recibía un
// arreglo de acciones y devolvía un archivo; la nueva devuelve un CONTEXTO
// encadenable que programa las transformaciones en un hilo de fondo, y solo
// materializa la imagen cuando se le pide.
//
// Eso trae una obligación que la API vieja no tenía: `ImageManipulatorContext` e
// `ImageRef` son objetos NATIVOS —un `Drawable` en Android, un `UIImage` en
// iOS— que retienen el bitmap. La documentación de `release()` nombra este caso
// exacto como uno de los pocos en que la liberación manual se justifica: «el
// objeto nativo retiene memoria nativa en exclusiva (datos binarios o un bitmap
// de imagen)».
//
// Subir cinco fotos de 4 MB son cinco bitmaps descomprimidos vivos a la vez si
// nadie los suelta. Se liberan en `finally` para que también ocurra cuando la
// compresión falla, que es justo cuando peor viene acumular memoria.
async function comprimirImagen(uriLocal: string, anchoMax: number): Promise<string> {
  const contexto = ImageManipulator.manipulate(uriLocal);
  let imagen: Awaited<ReturnType<typeof contexto.renderAsync>> | null = null;
  try {
    // Solo `width`: la altura se calcula sola conservando la proporción. Fijar
    // las dos deformaría las fotos verticales, que en un teléfono son la mayoría.
    contexto.resize({ width: anchoMax });
    imagen = await contexto.renderAsync();
    const { uri } = await imagen.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
    return uri;
  } finally {
    imagen?.release();
    contexto.release();
  }
}

/** Sube y devuelve la RUTA dentro del bucket (no una URL). */
async function subirArchivo(ruta: string, uriLocal: string, anchoMax: number): Promise<string> {
  const uriComprimida = await comprimirImagen(uriLocal, anchoMax);
  const arrayBuffer = await fetch(uriComprimida).then((res) => res.arrayBuffer());

  const { error } = await supabase.storage.from(BUCKET).upload(ruta, arrayBuffer, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;
  return ruta;
}

export function subirFotoPerfil(usuarioId: string, uriLocal: string): Promise<string> {
  return subirArchivo(`perfiles/${usuarioId}.jpg`, uriLocal, 512);
}

// Hasta 8 fotos por publicación — el mismo tope que el CHECK de la tabla
// (AUD-27). `indice` distingue cada foto dentro de la publicación; re-subir el
// mismo índice la reemplaza.
export function subirFotoPublicacion(
  usuarioId: string,
  publicacionId: string,
  indice: number,
  uriLocal: string
): Promise<string> {
  return subirArchivo(`publicaciones/${usuarioId}/${publicacionId}/${indice}.jpg`, uriLocal, 1024);
}

/**
 * AUD-08 — firma EN LOTE, no una por una.
 *
 * v4 mostraba `createSignedUrl` singular. Una pantalla de sugerencias con diez
 * tarjetas de cinco fotos son cincuenta viajes de ida y vuelta antes de pintar
 * nada; en red móvil eso es la diferencia entre instantáneo y "¿se trabó?".
 */
export async function firmarRutas(
  rutas: (string | null | undefined)[]
): Promise<Resultado<Map<string, string>>> {
  const limpias = [...new Set(rutas.filter((r): r is string => Boolean(r)))];
  // Nada que firmar es un ÉXITO con cero entradas, no un vacío ni un fallo:
  // una publicación sin fotos es perfectamente válida.
  if (limpias.length === 0) return ok(new Map());

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(limpias, CADUCIDAD_SEGUNDOS);

    if (error) {
      // END-25 · Antes devolvía un Map vacío. Una caída de Storage dejaba la
      // app sin fotos y SIN UN SOLO AVISO, indistinguible de una publicación
      // que simplemente no tiene ninguna. §27 pide justo lo contrario.
      aviso('createSignedUrls falló', { detalle: error.message });
      return problema('No pudimos cargar las fotos.');
    }

    const mapa = new Map<string, string>();
    for (const entrada of data ?? []) {
      if (entrada.path && entrada.signedUrl) mapa.set(entrada.path, entrada.signedUrl);
    }
    return ok(mapa);
  } catch (e) {
    aviso('createSignedUrls no respondió', undefined, e);
    return problema('No pudimos cargar las fotos.');
  }
}

/**
 * Miniatura para las tarjetas: la transformación se hace en el servidor, así
 * que baja una décima parte de los bytes del original de 1280 px.
 */
export async function firmarMiniatura(ruta: string | null | undefined): Promise<string | null> {
  if (!ruta) return null;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(ruta, CADUCIDAD_SEGUNDOS, { transform: { width: 400, quality: 70 } });
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function borrarFotoPerfil(usuarioId: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([`perfiles/${usuarioId}.jpg`]);
}
