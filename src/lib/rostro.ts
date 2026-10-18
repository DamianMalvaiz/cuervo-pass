// Verificación de rostro · fase 6 (Edge Function `verificar-rostro`, migración 0056).
//
// Es una AYUDA para quien revisa tu verificación; no aprueba nada. Lo que sigue es lo que la PERSONA ve y hace. El servidor decide
// y guarda lo demás, y a propósito no le dice ni la identidad, ni el puntaje, ni por qué falló: eso serviría para afinar una suplantación.

/**
 * Apagado hasta que el aviso de privacidad v3 (que ya habla de la INE y del rostro) esté publicado en la app. Se enciende junto con
 * `VERSION_AVISO` en `verificacion.ts`; `rostro.test.ts` falla si se enciende dejando 'v2'. Un consentimiento sobre un aviso que no
 * menciona el rostro no es un consentimiento informado.
 */
export const BIOMETRIA_HABILITADA = false;

export const TEXTO_CONSENTIMIENTO = {
  etiqueta: 'Acepto que comparen mi rostro con la foto de mi INE',
  ayuda:
    'Es opcional: sin esto, una persona revisa tus documentos igual. No guardamos tu selfie ni la huella numérica de tu rostro, solo el resultado de la comparación.',
} as const;

/** La causa más medida de «repite la foto» fue una selfie demasiado cerca o recortada (experimentos/biometrico, ronda 2). */
export const GUIA_SELFIE = [
  'Sostén el celular a un brazo de distancia: que se vean tu cara, el cuello y los hombros.',
  'Con buena luz de frente, sin contraluz.',
  'Sin gorra, lentes oscuros ni cubrebocas, y solo tú en la foto.',
  'Toma la foto en el momento: no sirve una de la galería ni una foto de otra pantalla.',
] as const;

export type ResultadoRostro =
  | { tipo: 'recibida'; intentosRestantes: number }
  | { tipo: 'repetir'; intentosRestantes: number }
  | { tipo: 'sin_intentos' }
  | { tipo: 'no_disponible' }
  | { tipo: 'error' };

const esIntentos = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 5;

/**
 * Lee la respuesta de la función por su código HTTP y su cuerpo. Todo lo que no sea una forma conocida es `error`: un cuerpo
 * inesperado nunca se interpreta como «recibida».
 */
export function interpretarRespuestaRostro(status: number, cuerpo: unknown): ResultadoRostro {
  if (status === 429) return { tipo: 'sin_intentos' };
  if (status === 503) return { tipo: 'no_disponible' };
  if (status !== 200 || !cuerpo || typeof cuerpo !== 'object') return { tipo: 'error' };
  const { resultado, intentos_restantes } = cuerpo as Record<string, unknown>;
  if (!esIntentos(intentos_restantes)) return { tipo: 'error' };
  if (resultado === 'recibida') return { tipo: 'recibida', intentosRestantes: intentos_restantes };
  if (resultado === 'repetir') return { tipo: 'repetir', intentosRestantes: intentos_restantes };
  return { tipo: 'error' };
}
