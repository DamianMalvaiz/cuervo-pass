// Decisiones de `ai-proxy` sin efectos ni dependencias, para poder probarlas con
// jest (test-utils/__tests__/ai-proxy-politica.test.ts). Aquí no hay `Deno`, ni
// red, ni Supabase: la función las aplica y este archivo solo decide.

// Sin cualquiera de estos la función no puede cumplir su trabajo. Los dos de
// `AI_*` son opcionales para Deno (`get` devuelve undefined) y por eso mismo
// fallaban tarde: `fetch('undefined/…')` y `Bearer undefined`.
const OBLIGATORIOS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'AI_SERVICE_URL',
  'AI_SHARED_TOKEN',
] as const;

/** Nombres (nunca valores) de los secrets ausentes o vacíos. */
export function secretsFaltantes(leer: (nombre: string) => string | undefined): string[] {
  return OBLIGATORIOS.filter((n) => !leer(n)?.trim());
}

export type Veredicto =
  | { tipo: 'entregar' }
  | { tipo: 'degradar'; devolver: true; motivo: string };

/**
 * Qué hacer con lo que respondió el microservicio.
 *
 * - Éxito, o entrada rechazada (400/422): se entrega y la cuota SE COBRA. Devolverla
 *   en un 422 regalaría llamadas ilimitadas a quien mande basura.
 * - Todo lo demás es culpa de la infraestructura, no de quien llama: se devuelve la
 *   cuota y se responde un 503 propio. Un 401 del microservicio NO se reenvía: la
 *   app lo leería como sesión caducada.
 */
export function clasificarRespuesta(estado: number): Veredicto {
  if (estado < 400 || estado === 400 || estado === 422) return { tipo: 'entregar' };
  if (estado === 401 || estado === 403 || estado === 404) {
    return { tipo: 'degradar', devolver: true, motivo: 'servicio-mal-configurado' };
  }
  if (estado === 429) return { tipo: 'degradar', devolver: true, motivo: 'servicio-ocupado' };
  return { tipo: 'degradar', devolver: true, motivo: 'servicio-error' };
}
