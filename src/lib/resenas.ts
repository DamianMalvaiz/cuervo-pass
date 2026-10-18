// Reseñas · Cuervo 360 · migración 0054.
//
// Lo que no depende de la red ni de la pantalla: cuándo una reseña es válida y cómo se escribe una calificación. La base vuelve a
// validar lo suyo (1 a 5 estrellas, 600 caracteres, una por persona); esto evita mandar lo que ya se sabe mal y dice QUÉ falla.

export const MAX_TEXTO_RESENA = 600;
export const MAX_RESPUESTA = 600;

export interface ResenaPublica {
  [key: string]: unknown;
  id: string;
  negocio_id: string | null;
  publicacion_id: string | null;
  estrellas: number;
  texto: string | null;
  respuesta: string | null;
  respondida_en: string | null;
  creado_en: string;
  /** Nombre de usuario de la autora. */
  autor: string;
  es_mia: boolean;
}

export type Objetivo = { negocioId: string; publicacionId?: never } | { publicacionId: string; negocioId?: never };

export type ErroresResena = Partial<Record<'estrellas' | 'texto', string>>;

export function validarResena(estrellas: number, texto: string): ErroresResena {
  const e: ErroresResena = {};
  if (!Number.isInteger(estrellas) || estrellas < 1 || estrellas > 5) e.estrellas = 'Elige de 1 a 5 estrellas';
  if (texto.trim().length > MAX_TEXTO_RESENA) e.texto = `El texto es demasiado largo (máximo ${MAX_TEXTO_RESENA})`;
  return e;
}

export function validarRespuesta(texto: string): string | null {
  return texto.trim().length > MAX_RESPUESTA ? `La respuesta es demasiado larga (máximo ${MAX_RESPUESTA})` : null;
}

/** 4.5 → «4.5»; 4 → «4.0». Una sola cifra decimal, como la calcula la base. */
export const textoCalificacion = (c: number): string => c.toFixed(1);

/** «1 reseña», «12 reseñas». */
export const textoNumResenas = (n: number): string => (n === 1 ? '1 reseña' : `${n} reseñas`);

/** Para el lector de pantalla: «4.5 de 5 estrellas, 12 reseñas». */
export function etiquetaCalificacion(calificacion: number | null | undefined, numResenas: number): string {
  if (calificacion == null || numResenas <= 0) return 'Sin reseñas todavía';
  return `${textoCalificacion(calificacion)} de 5 estrellas, ${textoNumResenas(numResenas)}`;
}

/** Cuántas estrellas se pintan llenas, medio llenas y vacías para un promedio (redondeo a medias). */
export function estrellasDe(calificacion: number): { llenas: number; media: boolean; vacias: number } {
  const c = Math.max(0, Math.min(5, calificacion));
  const medias = Math.round(c * 2);
  const llenas = Math.floor(medias / 2);
  const media = medias % 2 === 1;
  return { llenas, media, vacias: 5 - llenas - (media ? 1 : 0) };
}
