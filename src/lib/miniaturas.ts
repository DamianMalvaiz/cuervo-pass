// Miniaturas de las listas · plan de excelencia 0.4.
//
// Medido en producción (18/10/2026): las fotos pesan 192 KB de promedio y cada tarjeta de una lista bajaba la FOTO COMPLETA: ~30 tarjetas ≈ 5.8 MB por pantalla.
// Probado contra este proyecto: el mismo archivo con el endpoint de transformación a 400 px y calidad 70 baja de 129 KB a 29 KB (−78 %).
//
// Qué se descartó, y por qué:
//   · `createSignedUrls` (en lote) NO admite transformación; la URL firmada normal cambiada a `/render/` con `?width=` devuelve 117 KB: el ancho se ignora.
//   · `createSignedUrl` con `transform` funciona pero es UNA petición por foto, justo lo que AUD-08 quitó.
//   · Generar y subir una segunda imagen al subir pide cambiar la subida, borrar dos archivos en cada baja y rellenar las 422 existentes.
// Lo que sí: `/storage/v1/render/image/authenticated/…` con la sesión en CABECERAS. No firma nada (cero peticiones extra), respeta las mismas policies de lectura
// que ya protegen el bucket (sin sesión da 404), y sirve también las fotos ya subidas.

export interface FuenteFoto {
  uri: string;
  headers: { Authorization: string; apikey: string };
}

/**
 * Anchos por uso, medidos con las primeras 30 fotos de producción (completa = 4.98 MB): 720 px → 1.97 MB (−60 %), 480 → 1.33 (−73 %), 360 → 1.03 (−79 %),
 * 160 → 0.47 (−91 %). La tarjeta de ancho completo pide 720 (a 2× se ve nítida); lo compacto, menos. La ficha sigue pidiendo la foto completa.
 */
export const ANCHOS = { ancha: 720, media: 480, compacta: 360, fila: 240, avatar: 160 } as const;

const ANCHO_MIN = 32;
const ANCHO_MAX = 1280;
const CALIDAD = 70;

/** Las fotos sembradas guardan URLs externas (Unsplash): no son del bucket y no se transforman. */
export function rutaEsDelBucket(ruta: string | null | undefined): ruta is string {
  return typeof ruta === 'string' && ruta.length > 0 && !/^https?:\/\//i.test(ruta);
}

/**
 * La fuente de imagen de una miniatura, o `null` si no se puede (ruta externa, o falta la base, la clave o la sesión). `null` significa «usa la foto
 * completa que ya se firmó»: nunca se arma una URL a medias.
 *
 * El token va en cabeceras, no en la URL: la URL se guarda en la caché de imágenes y puede acabar en registros.
 */
export function fuenteMiniatura(
  base: string | undefined,
  clave: string | undefined,
  token: string | undefined,
  ruta: string | null | undefined,
  ancho: number,
): FuenteFoto | null {
  if (!base || !clave || !token || !rutaEsDelBucket(ruta)) return null;
  const w = Number.isFinite(ancho) ? Math.min(ANCHO_MAX, Math.max(ANCHO_MIN, Math.round(ancho))) : ANCHOS.media;
  const camino = ruta.split('/').map(encodeURIComponent).join('/');
  return {
    uri: `${base}/storage/v1/render/image/authenticated/fotos/${camino}?width=${w}&quality=${CALIDAD}`,
    headers: { Authorization: `Bearer ${token}`, apikey: clave },
  };
}
