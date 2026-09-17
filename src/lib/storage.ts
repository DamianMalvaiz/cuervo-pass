import * as ImageManipulator from 'expo-image-manipulator';

import { supabase } from '@/lib/supabase';

const BUCKET = 'fotos';

// Comprime/redimensiona antes de subir — nunca mandamos el archivo original
// de la cámara (puede pesar varios MB) por WiFi lenta en la demo.
async function comprimirImagen(uriLocal: string, anchoMax: number): Promise<string> {
  const resultado = await ImageManipulator.manipulateAsync(
    uriLocal,
    [{ resize: { width: anchoMax } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );
  return resultado.uri;
}

async function subirArchivo(path: string, uriLocal: string, anchoMax: number): Promise<string> {
  const uriComprimida = await comprimirImagen(uriLocal, anchoMax);
  const arrayBuffer = await fetch(uriComprimida).then((res) => res.arrayBuffer());

  const { error } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  // Rompe el caché del CDN/navegador: la misma ruta ahora tiene contenido nuevo.
  return `${data.publicUrl}?t=${Date.now()}`;
}

export function subirFotoPerfil(usuarioId: string, uriLocal: string): Promise<string> {
  return subirArchivo(`perfiles/${usuarioId}.jpg`, uriLocal, 512);
}

// Hasta 5 fotos por publicación (sección 20, Semana 3). `indice` distingue cada
// foto dentro de la misma publicación; re-subir el mismo índice la reemplaza.
export function subirFotoPublicacion(
  usuarioId: string,
  publicacionId: string,
  indice: number,
  uriLocal: string
): Promise<string> {
  return subirArchivo(`publicaciones/${usuarioId}/${publicacionId}/${indice}.jpg`, uriLocal, 1024);
}
