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

export const RUTAS_PERMITIDAS = ['parsear-perfil', 'generar-embedding'] as const;
/** La misma cota que valida Pydantic del otro lado (AUD-28): ambas capas, siempre. */
export const MAX_TEXTO = 2000;

export type Solicitud =
  | { ok: true; ruta: (typeof RUTAS_PERMITIDAS)[number]; texto: string }
  | { ok: false; error: 'cuerpo inválido' | 'ruta no permitida' | 'texto inválido' };

/**
 * El cuerpo de la petición, validado ANTES de desestructurarlo. `req.json()` puede devolver `null`, un número o un arreglo, y
 * `const { ruta, texto } = null` lanza TypeError: la función contestaba 500 (`admin` y `verificar-rostro` ya validan la forma).
 */
export function validarSolicitud(crudo: unknown): Solicitud {
  if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) return { ok: false, error: 'cuerpo inválido' };
  const { ruta, texto } = crudo as Record<string, unknown>;
  if (typeof ruta !== 'string' || !(RUTAS_PERMITIDAS as readonly string[]).includes(ruta)) {
    return { ok: false, error: 'ruta no permitida' };
  }
  if (typeof texto !== 'string' || texto.length === 0 || texto.length > MAX_TEXTO) {
    return { ok: false, error: 'texto inválido' };
  }
  return { ok: true, ruta: ruta as (typeof RUTAS_PERMITIDAS)[number], texto };
}

/**
 * Qué significa un error de `consumir_cuota`. Solo CP001 (migración 0032) es «cuota diaria agotada», un límite de quien llama. Cualquier
 * otro —la base no respondió, un permiso, un tiempo agotado— es un fallo del SISTEMA: contestarlo como 429 le diría al usuario que gastó su
 * cupo cuando no es así.
 */
export function clasificarErrorDeCuota(error: { code?: string } | null | undefined): 'agotada' | 'no-disponible' {
  return error?.code === 'CP001' ? 'agotada' : 'no-disponible';
}
