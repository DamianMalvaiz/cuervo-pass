// Códigos de error, no subcadenas · END-27
//
// La app distinguía sus errores leyendo el TEXTO del mensaje:
//
//   mensaje.includes('duplicate') || mensaje.includes('unique')
//   e.message.includes('límite')
//   mensaje.includes('cuota')
//
// Eso depende del texto que produce Postgres, que cambia por versión y por
// **locale**. En un servidor con locale en español, «duplicate key value» ya no
// dice «duplicate»: la app mostraría «intenta de nuevo en un momento» ante algo
// que no va a funcionar nunca. Y basta con que alguien reescriba el mensaje de
// un `raise` para romper una rama de la interfaz sin tocarla.
//
// El diagnóstico completo, sin embargo, era más incómodo: **no había código que
// leer**. Las dos excepciones propias usaban `check_violation`, el mismo que
// devuelve cualquier CHECK de cualquier tabla. La subcadena no era pereza, era
// lo único disponible. La migración 0032 les dio código propio.

/** Códigos del estándar SQL que Postgres ya distingue bien. */
export const SQL = {
  /** Violación de unicidad. Un reporte repetido, un contacto ya revelado. */
  UNIQUE_VIOLATION: '23505',
  /** Violación de CHECK. Genérico: NO sirve para distinguir reglas de negocio. */
  CHECK_VIOLATION: '23514',
  /** Clave foránea. Ej. una publicación cuyo dueño ya no existe. */
  FOREIGN_KEY_VIOLATION: '23503',
  /** No se puede inferir un índice parcial sin repetir su predicado. */
  INVALID_ON_CONFLICT: '42P10',
} as const;

/**
 * Códigos propios de la aplicación, clase `CP`.
 *
 * Postgres permite SQLSTATEs definidos por la aplicación, y las clases que
 * empiezan por letras fuera de su catálogo no colisionan con las suyas.
 */
export const CP = {
  CUOTA_AGOTADA: 'CP001',
  LIMITE_PUBLICACIONES: 'CP002',
} as const;

/** El `code` de un error de PostgREST/supabase-js, si lo trae. */
export function codigoDe(error: unknown): string | null {
  if (error && typeof error === 'object' && 'code' in error) {
    const c = (error as { code?: unknown }).code;
    if (typeof c === 'string') return c;
  }
  return null;
}

export function esCodigo(error: unknown, ...codigos: string[]): boolean {
  const c = codigoDe(error);
  return c != null && codigos.includes(c);
}
