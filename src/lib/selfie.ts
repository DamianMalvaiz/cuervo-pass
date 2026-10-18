// Prepara la selfie para mandarla: la achica y la devuelve en base64. Nunca se guarda en un archivo permanente ni en Storage.
//
// 1024 px de ancho bastan para detectar y comparar un rostro, y mantienen la imagen muy por debajo de los 4 MB que acepta el
// servicio de IA (una foto de cámara ronda los 4 MB y crecería un tercio más en base64). Mismo manejo de memoria nativa que
// `comprimirImagen` en storage.ts: el bitmap se libera en `finally`.

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export const ANCHO_SELFIE = 1024;

export async function prepararSelfie(uriLocal: string): Promise<string> {
  const contexto = ImageManipulator.manipulate(uriLocal);
  let imagen: Awaited<ReturnType<typeof contexto.renderAsync>> | null = null;
  try {
    contexto.resize({ width: ANCHO_SELFIE });
    imagen = await contexto.renderAsync();
    const { base64 } = await imagen.saveAsync({ compress: 0.8, format: SaveFormat.JPEG, base64: true });
    if (!base64) throw new Error('no se pudo preparar la selfie');
    return base64;
  } finally {
    imagen?.release();
    contexto.release();
  }
}
