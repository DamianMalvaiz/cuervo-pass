// Cabeceras de seguridad del panel de admin web (admin.cuervo360.com). Lógica pura: la usa `construir-web-admin.mjs` y la prueba la comprueba.
//
// La CSP sale de lo que el panel REALMENTE carga: scripts y estilos propios (sin estilos en línea), y cualquier script en línea permitido por su hash,
// nunca con 'unsafe-inline'. Imágenes y conexiones solo hacia el proyecto de Supabase.
import { createHash } from 'node:crypto';

export const hashDeScript = (contenido) => `'sha256-${createHash('sha256').update(contenido, 'utf8').digest('base64')}'`;

/** Los scripts EN LÍNEA de un HTML (sin `src`). */
export function scriptsEnLinea(html) {
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).filter((c) => c.trim() !== '');
}

export function construirCsp({ supabaseUrl, hashes }) {
  const url = new URL(supabaseUrl);
  if (url.protocol !== 'https:') throw new Error(`El panel de producción solo habla con un Supabase https (llegó ${supabaseUrl})`);
  const origen = url.origin;
  return [
    "default-src 'none'",
    `script-src 'self' ${[...hashes].join(' ')}`.trim(),
    "style-src 'self'",
    `img-src 'self' data: blob: ${origen}`,
    "font-src 'self' data:",
    `connect-src 'self' ${origen} wss://${url.host}`,
    "manifest-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export function construirCabeceras({ supabaseUrl, hashes }) {
  return `/*
  Content-Security-Policy: ${construirCsp({ supabaseUrl, hashes })}
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  Strict-Transport-Security: max-age=31536000
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  X-Robots-Tag: noindex, nofollow
  Cache-Control: no-store
/_expo/static/*
  Cache-Control: public, max-age=31536000, immutable
`;
}
