// §12 · ORDEN A.7 — el registro exige un correo institucional.
//
// Por qué: hasta aquí el registro era abierto y sin verificación de correo
// (`enable_confirmations = false`). Combinado con el ocultamiento automático a
// los 3 reportes —de publicaciones en la 0013 y de personas en la 0023—, tres
// cuentas desechables creadas en dos minutos tumbaban a cualquiera. El umbral
// de tres no es el problema: lo es que una cuenta no cueste nada.
//
// Y al revés: PRODUCT.md dice que el usuario primario decide «sight-unseen»,
// desde otra ciudad, sin poder visitar. Toda la confianza del producto
// descansa en foto, biografía y reportes. La señal más barata y más fuerte que
// existe para ese usuario —«esta persona tiene un correo de tu universidad»—
// estaba sin usar.
//
// Lo que esto SÍ hace: encarece la creación masiva de cuentas y sube el listón
// del brigading de reportes.
// Lo que NO hace, y hay que decirlo: no verifica identidad. Una cuenta
// universitaria real actuando de mala fe pasa igual. Está en
// docs/modelo-amenazas.md.

/**
 * Dominios aceptados.
 *
 * `.edu.mx` cubre la mayoría de las instituciones mexicanas. Los concretos se
 * listan aparte porque varias universidades públicas del Estado de México no
 * usan ese sufijo — la UTVT entre ellas.
 */
export const SUFIJOS_UNIVERSITARIOS = [
  '.edu.mx',
  '.utvtol.edu.mx',
] as const;

export const DOMINIOS_UNIVERSITARIOS = [
  'utvtol.edu.mx',
] as const;

/**
 * Trampa que un `endsWith` ingenuo no ve.
 *
 * `alguien@edu.mx.atacante.com` termina en `.com`, pero un
 * `correo.includes('.edu.mx')` lo daría por bueno, y un
 * `correo.endsWith('.edu.mx')` sobre la cadena COMPLETA también fallaría con
 * `alguien@malo.edu.mx.co`. Por eso se extrae el dominio tras la ÚLTIMA arroba
 * y se compara contra el final de ese dominio, no de la cadena entera.
 */
export function dominioDe(correo: string): string | null {
  const limpio = correo.trim().toLowerCase();
  const arroba = limpio.lastIndexOf('@');
  if (arroba <= 0 || arroba === limpio.length - 1) return null;
  const dominio = limpio.slice(arroba + 1);
  // Un dominio con espacios, dos arrobas o sin punto no es un dominio.
  if (/\s/.test(dominio) || dominio.includes('@') || !dominio.includes('.')) return null;
  if (dominio.startsWith('.') || dominio.endsWith('.') || dominio.includes('..')) return null;
  return dominio;
}

export function esCorreoUniversitario(correo: string): boolean {
  const dominio = dominioDe(correo);
  if (!dominio) return false;
  if (DOMINIOS_UNIVERSITARIOS.includes(dominio as (typeof DOMINIOS_UNIVERSITARIOS)[number])) return true;
  return SUFIJOS_UNIVERSITARIOS.some((s) => dominio.endsWith(s));
}

/** El mensaje que ve quien se equivoca. Dice qué se acepta, no solo que falló. */
export const MENSAJE_CORREO_NO_UNIVERSITARIO =
  'Usa el correo de tu universidad (termina en .edu.mx). Es lo que nos deja saber que eres estudiante.';
