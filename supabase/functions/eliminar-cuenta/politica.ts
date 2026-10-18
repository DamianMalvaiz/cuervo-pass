// Decisiones de `eliminar-cuenta` sin efectos ni dependencias, para probarlas con jest
// (test-utils/__tests__/eliminar-cuenta-politica.test.ts). Aquí no hay `Deno`, ni red, ni Supabase.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface Carpetas {
  /** Carpetas del bucket `fotos` que se barren (además de `perfiles/<id>.jpg`, que es un archivo suelto). */
  fotos: string[];
  /** Carpetas del bucket `verificacion` (INE, reverso y fotos del lugar). */
  verificacion: string[];
}

/**
 * Las carpetas de Storage que pertenecen a esta cuenta. Las filas de la base se borran en cascada, pero los ARCHIVOS no: sin esto quedaban
 * para siempre las fotos de los negocios (y las de sus productos) y la evidencia de verificación.
 *
 * El id de la cuenta sale de la sesión, pero se valida igual: esto borra con la llave de servicio y no confía en una ruta armada con un valor
 * que no tiene forma de uuid. Un id de negocio raro se descarta en vez de formar una ruta.
 */
export function carpetasDeLaCuenta(usuarioId: string, negocioIds: readonly string[]): Carpetas {
  if (!UUID.test(usuarioId)) throw new Error('id de cuenta inválido');
  const negocios = negocioIds.filter((id) => UUID.test(id));
  return {
    fotos: [`publicaciones/${usuarioId}`, ...negocios.flatMap((id) => [`negocios/${id}`, `negocios/${id}/p`])],
    verificacion: [usuarioId, `${usuarioId}/comerciante`, `${usuarioId}/arrendador`],
  };
}

/** De un listado de Storage solo salen los ARCHIVOS (los que traen `id`; una subcarpeta no), con su ruta completa y sin nombres raros. */
export function rutasDeEntradas(carpeta: string, entradas: { name: string; id: string | null }[] | null): string[] {
  return (entradas ?? [])
    .filter((e) => e.id && !e.name.includes('..') && !e.name.includes('/'))
    .map((e) => `${carpeta}/${e.name}`);
}
