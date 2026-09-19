// Qué se escribe en `perfil_vector` y por qué.
//
// Existía un fallo silencioso: las dos pantallas que guardan el cuestionario
// hacían esto…
//
//   let perfilVector = null;
//   if (usaIa) { try { perfilVector = await generarEmbedding(…); } catch { console.warn(…); } }
//   await actualizarPerfil(…, { perfil_vector: perfilVector });
//
// …y con eso el código no distinguía "retiré el consentimiento" de "el servicio
// falló". Ambos escribían null. Borrar el vector al retirar el consentimiento es
// intencional y correcto; aplicarle el mismo castigo a un hipo de red de veinte
// segundos no lo es. El efecto real, comprobado en producción el 18/09/2026: una
// cuenta con `consiente_analisis_ia = true` y `perfil_vector = null`, o sea
// Nivel 2 muerto para siempre, sin un solo aviso en pantalla.
//
// La regla ahora tiene tres estados, no dos, y el tercero NO TOCA la columna.

import { ServicioIaError, generarEmbedding } from '@/lib/aiService';

export type ResultadoVector =
  | { estado: 'sin-consentimiento' }
  | { estado: 'generado'; vector: number[] }
  | { estado: 'fallo'; cuotaAgotada: boolean };

export async function resolverPerfilVector(
  consiente: boolean,
  textoPerfil: string
): Promise<ResultadoVector> {
  if (!consiente) return { estado: 'sin-consentimiento' };
  try {
    return { estado: 'generado', vector: await generarEmbedding(textoPerfil) };
  } catch (e) {
    return {
      estado: 'fallo',
      cuotaAgotada: e instanceof ServicioIaError && e.cuotaAgotada,
    };
  }
}

/**
 * Qué campos mandarle al UPDATE.
 *
 * El caso 'fallo' devuelve un objeto VACÍO a propósito: PostgREST solo actualiza
 * las claves presentes, así que omitirla deja intacto el vector anterior. Esa es
 * la diferencia entre "no pudimos recalcularlo" y "bórralo".
 */
export function campoVector(resultado: ResultadoVector): { perfil_vector?: number[] | null } {
  switch (resultado.estado) {
    case 'sin-consentimiento':
      return { perfil_vector: null };
    case 'generado':
      return { perfil_vector: resultado.vector };
    case 'fallo':
      return {};
  }
}

/**
 * El aviso en pantalla. Sin esto solo cambiaríamos un silencio por otro: el
 * guardado sí funcionó, y decir únicamente "guardado" volvería a ocultar que la
 * parte semántica quedó atrás.
 *
 * `teniaVector` cambia el mensaje porque cambia la consecuencia: con vector
 * previo las sugerencias siguen ordenándose (con un criterio desfasado); sin él,
 * se cae a Nivel 1.
 */
export function avisoVector(
  resultado: ResultadoVector,
  teniaVector: boolean
): { titulo: string; cuerpo: string } | null {
  if (resultado.estado !== 'fallo') return null;

  const causa = resultado.cuotaAgotada
    ? 'Llegaste al límite de análisis de hoy.'
    : 'No pudimos contactar el servicio de análisis.';

  // Los filtros duros —presupuesto y distancia— viven en columnas normales y sí
  // se guardaron. Lo único que queda atrás es el ORDEN, y conviene decirlo así
  // para que nadie crea que dejó de ver publicaciones.
  const efecto = teniaVector
    ? 'Tus preferencias se guardaron y seguimos usando tu análisis anterior, así que el orden de las sugerencias puede estar desfasado.'
    : 'Tus preferencias se guardaron, pero por ahora las sugerencias se ordenan solo con filtros ponderados (Nivel 1).';

  return {
    titulo: 'Guardado, con una salvedad',
    cuerpo: `${causa} ${efecto} Se corrige solo la próxima vez que guardes.`,
  };
}
