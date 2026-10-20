#!/usr/bin/env node
//
// ¿Es esto un dominio de túnel, o alguien escribió otra cosa en `.tunel-actual`?
//
//   import { esDominioDeTunel } from './dominio-tunel.mjs';   // desde Node
//   node scripts/dominio-tunel.mjs "<valor>"                   // desde bash
//
// ── POR QUÉ EXISTE ─────────────────────────────────────────────────────────
//
// El 19/09/2026 `.tunel-actual` contenía `http://127.0.0.1:8000`: la URL LOCAL,
// no el dominio público. Los dos consumidores del archivo se lo creyeron, y eso
// desactivó en silencio las dos comprobaciones previas a exponer la app:
//
//   · `tunel.sh` hacía `curl "$ANTERIOR/listo"`. Contra localhost eso responde
//     200 siempre, así que imprimía «sigue vivo. No se toca», salía con 0 y
//     NUNCA volvía a crear un túnel.
//   · `verificar.mjs` comprobaba localhost creyendo comprobar el túnel — que es
//     exactamente lo que ese código existe para evitar. Su propio encabezado
//     dice: «En localhost siempre se ve bien. Lo que importa es el camino que
//     recorre la Edge Function».
//
// Un verificador que da confianza falsa justo antes de una demo es peor que no
// tenerlo.
//
// ── POR QUÉ UN MÓDULO Y NO UN `case` EN CADA SITIO ─────────────────────────
//
// Porque son dos consumidores en dos lenguajes. Dos copias de la misma regla se
// desincronizan en cuanto alguien amplíe una — y este repositorio ya tuvo
// exactamente ese problema con el reparto de `.env`, que era un párrafo
// repetido en tres archivos que decían tres cosas distintas. Una definición,
// dos consumidores, y una prueba sobre el CLI que los dos usan.

/**
 * Sufijos de host aceptados.
 *
 *   · `.trycloudflare.com` — el túnel RÁPIDO de Cloudflare. Cambia de dominio en cada arranque y su DNS llegó a tardar más de media hora: sirve para probar, no
 *     para una demostración.
 *   · `.ngrok-free.app`, `.ngrok-free.dev`, `.ngrok.app`, `.ngrok.dev` — un dominio ESTÁTICO de ngrok (la cuenta gratuita trae uno): no cambia, así que el secret
 *     `AI_SERVICE_URL` se fija UNA vez. Es lo que se recomienda (docs/ia-local.md).
 *   · `.ts.net` — Tailscale Funnel, también estable.
 *   · `.cuervo360.com` — el dominio PROPIO (comprado el 19/10/2026) con un túnel con nombre de Cloudflare (`ia.cuervo360.com`). Es el recomendado. Se exige un
 *     SUBDOMINIO (el punto inicial): el apex `cuervo360.com` no es un túnel, y `ia-cuervo360.com` (otro dominio que solo se le parece) no termina en `.cuervo360.com`.
 */
export const SUFIJOS_DE_TUNEL = ['.cuervo360.com', '.trycloudflare.com', '.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.dev', '.ts.net'];

export function esDominioDeTunel(valor) {
  if (typeof valor !== 'string') return false;
  const limpio = valor.trim();
  if (!limpio) return false;

  let url;
  try {
    url = new URL(limpio);
  } catch {
    // Sin protocolo no es una URL. `arising-lightbox.trycloudflare.com` a secas
    // se rechaza a propósito: `fetch` lo interpretaría como ruta relativa.
    return false;
  }

  // HTTPS y solo HTTPS. Un túnel por `http://` degrada la conexión sin avisar,
  // y el 19/09 el valor equivocado era justamente `http://`.
  if (url.protocol !== 'https:') return false;

  // Contra el HOST, nunca contra la cadena entera: `trycloudflare.com.atacante.net`
  // termina en `.net`, pero un `includes('.trycloudflare.com')` lo daría por
  // bueno. Es la misma trampa que src/lib/correoUniversitario.ts cubre para los
  // correos, y se resuelve igual.
  if (!SUFIJOS_DE_TUNEL.some((s) => url.hostname.endsWith(s))) return false;

  // Solo el origen. Con una ruta pegada, `${dominio}/listo` produciría
  // `https://…/algo/listo` y la comprobación preguntaría por otra cosa.
  if (url.pathname !== '/' || url.search || url.hash) return false;

  return true;
}

/** El mensaje que ven los dos consumidores. Dice qué hay, no solo que está mal. */
export function motivoRechazo(valor) {
  const mostrado = typeof valor === 'string' && valor.trim() ? valor.trim() : '(vacío)';
  return `El valor no es un dominio de túnel: ${mostrado}. `
    + `Se esperaba https://ia.cuervo360.com (recomendado, estable), https://<algo>.ngrok-free.app, https://<algo>.ts.net o https://<algo>.trycloudflare.com — corre ./scripts/tunel.sh.`;
}

// Modo CLI, para que `tunel.sh` use la misma definición que `verificar.mjs`.
// Sale 0 si es válido y 1 si no, que es lo que un `if` de bash entiende.
if (import.meta.url === `file://${process.argv[1]}`) {
  const valor = process.argv[2] ?? '';
  if (esDominioDeTunel(valor)) process.exit(0);
  console.error(motivoRechazo(valor));
  process.exit(1);
}
