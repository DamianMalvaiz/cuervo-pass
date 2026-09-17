import * as ImageManipulator from 'expo-image-manipulator';

import { supabase } from '@/lib/supabase';

const BUCKET = 'fotos';

// Comprime/redimensiona antes de subir — nunca mandamos el archivo original
// de la cámara (puede pesar varios MB) por WiFi lenta en la demo.
async function comprimirImagen(uriLocal: string): Promise<string> {
  const resultado = await ImageManipulator.manipulateAsync(
    uriLocal,
    [{ resize: { width: 512 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );
  return resultado.uri;
}

async function subirArchivo(path: string, uriLocal: string): Promise<string> {
  const uriComprimida = await comprimirImagen(uriLocal);
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
  return subirArchivo(`perfiles/${usuarioId}.jpg`, uriLocal);
}

// TODO (Semana 3): subirFotoPublicacion(usuarioId, publicacionId, uriLocal) — hasta 5 fotos.
