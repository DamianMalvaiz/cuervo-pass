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

export interface PasosDeBorrado {
  /** Rutas de archivos de cada bucket. Se calculan ANTES de borrar la cuenta: después las filas que las nombran ya no existen. */
  recogerRutas(): Promise<{ fotos: string[]; verificacion: string[] }>;
  /** `null` = la cuenta se borró. Un texto = no se pudo; solo sirve para el registro del servidor y no sale en la respuesta. */
  borrarCuenta(): Promise<string | null>;
  borrarFotos(rutas: string[]): Promise<void>;
  borrarVerificacion(rutas: string[]): Promise<void>;
}

export type ResultadoBorrado = { ok: true; fotos: number; evidencia: number } | { ok: false };

/**
 * El ORDEN del borrado: rutas, luego la CUENTA, y solo después los archivos.
 *
 * Antes se borraban los archivos primero. Si `deleteUser` fallaba por un error transitorio, la cuenta seguía viva con sus fotos y su
 * evidencia ya destruidas (publicaciones con imágenes rotas) y la persona veía un borrado «fallido» que había borrado igualmente.
 * Si la cuenta no se borra, aquí no se toca ni un archivo. Si los archivos fallan DESPUÉS, no se pierde nada: las colas de huérfanas
 * (`fotos_huerfanas`, `evidencia_huerfana`) los recogen aunque la cuenta ya no exista.
 */
export async function ejecutarBorrado(pasos: PasosDeBorrado): Promise<ResultadoBorrado> {
  const rutas = await pasos.recogerRutas();
  const fallo = await pasos.borrarCuenta();
  if (fallo !== null) return { ok: false };
  await pasos.borrarFotos(rutas.fotos);
  await pasos.borrarVerificacion(rutas.verificacion);
  return { ok: true, fotos: rutas.fotos.length, evidencia: rutas.verificacion.length };
}
