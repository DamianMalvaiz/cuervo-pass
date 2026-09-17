import { geocodificarDireccion } from '@/lib/mapbox';
import { subirFotoPublicacion } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import type { Publicacion } from '@/types/database.types';

export async function listarPublicacionesActivas() {
  const { data, error } = await supabase
    .from('publicaciones')
    .select('*')
    .eq('activa', true)
    .order('creado_en', { ascending: false });
  if (error) throw error;
  return data as Publicacion[];
}

export async function listarMisPublicaciones(usuarioId: string) {
  const { data, error } = await supabase
    .from('publicaciones')
    .select('*')
    .eq('usuario_id', usuarioId)
    .order('creado_en', { ascending: false });
  if (error) throw error;
  return data as Publicacion[];
}

export async function obtenerPublicacion(id: string) {
  const { data, error } = await supabase.from('publicaciones').select('*').eq('id', id).single();
  if (error) throw error;
  return data as Publicacion;
}

// Una foto ya subida (viene con su URL pública) o una recién elegida en el
// dispositivo (viene con su uri local, `file://...`) — el formulario de
// publicación usa esta misma forma tanto al crear como al editar.
export type FotoEntrada = { url: string; esNueva: false } | { uri: string; esNueva: true };

interface DatosPublicacion {
  usuarioId: string;
  direccion: string;
  precioRenta: number;
  descripcion?: string;
  whatsapp: string;
  fotos: FotoEntrada[];
}

async function resolverFotos(usuarioId: string, publicacionId: string, fotos: FotoEntrada[]): Promise<string[]> {
  return Promise.all(
    fotos.map((foto, indice) =>
      foto.esNueva ? subirFotoPublicacion(usuarioId, publicacionId, indice, foto.uri) : foto.url
    )
  );
}

// TODO (Semana 9): generar y guardar vector_embedding de la descripción.
export async function crearPublicacion(datos: DatosPublicacion): Promise<Publicacion> {
  // Nunca bloquea la publicación si Mapbox falla (sección 17) — coords quedan
  // null y se puede reintentar el geocoding después (editar y guardar de nuevo).
  const coords = await geocodificarDireccion(datos.direccion);

  const { data: fila, error } = await supabase
    .from('publicaciones')
    .insert({
      usuario_id: datos.usuarioId,
      direccion: datos.direccion,
      latitud: coords?.lat,
      longitud: coords?.lng,
      precio_renta: datos.precioRenta,
      descripcion: datos.descripcion,
      whatsapp: datos.whatsapp,
    })
    .select()
    .single();
  if (error) throw error;
  const publicacion = fila as Publicacion;

  if (datos.fotos.length === 0) return publicacion;

  // Las fotos se suben DESPUÉS del insert porque necesitan el id que Postgres
  // genera (gen_random_uuid()) para armar la ruta publicaciones/<usuario>/<id>/n.jpg
  // que las policies de Storage (migración 0002) esperan.
  const urls = await resolverFotos(datos.usuarioId, publicacion.id, datos.fotos);

  const { data: actualizada, error: errorUpdate } = await supabase
    .from('publicaciones')
    .update({ fotos: urls })
    .eq('id', publicacion.id)
    .select()
    .single();
  if (errorUpdate) throw errorUpdate;
  return actualizada as Publicacion;
}

export async function actualizarPublicacion(publicacionId: string, datos: DatosPublicacion): Promise<Publicacion> {
  const [urls, coords] = await Promise.all([
    resolverFotos(datos.usuarioId, publicacionId, datos.fotos),
    geocodificarDireccion(datos.direccion),
  ]);
  const { data, error } = await supabase
    .from('publicaciones')
    .update({
      direccion: datos.direccion,
      latitud: coords?.lat,
      longitud: coords?.lng,
      precio_renta: datos.precioRenta,
      descripcion: datos.descripcion,
      whatsapp: datos.whatsapp,
      fotos: urls,
    })
    .eq('id', publicacionId)
    .select()
    .single();
  if (error) throw error;
  return data as Publicacion;
}

export async function cambiarEstadoPublicacion(id: string, activa: boolean) {
  const { error } = await supabase.from('publicaciones').update({ activa }).eq('id', id);
  if (error) throw error;
}

// Registra el match cuando el usuario contacta por WhatsApp (sección 14, "usado de verdad").
export async function registrarMatch(usuarioId: string, publicacionId: string, score: number) {
  const { error } = await supabase
    .from('matches')
    .insert({ usuario_id: usuarioId, publicacion_id: publicacionId, score });
  if (error) throw error;
}

// TODO: ocultar automáticamente al llegar a 3 reportes (sección 17) requiere un
// trigger en la base — por ahora el conteo/ocultamiento es manual (admin).
export async function reportarPublicacion(reportadoPor: string, publicacionId: string, motivo: string) {
  const { error } = await supabase
    .from('reportes')
    .insert({ reportado_por: reportadoPor, publicacion_id: publicacionId, motivo });
  if (error) throw error;
}
