// Reglas de la web de la app (app.cuervo360.com). Lógica pura: la usa `construir-app-web.mjs` y la prueba la comprueba (`test-utils/__tests__/app-web.test.ts`).
//
// Como la CSP del panel de admin (`web-admin-csp.mjs`): los scripts son propios y el único en línea (el de hidratación de Expo Router, el mismo en todas las páginas) pasa por su hash,
// nunca con 'unsafe-inline'; imágenes y conexiones solo hacia el Supabase de producción. La diferencia es `style-src 'unsafe-inline'`: la librería de la app (react-native-web)
// pone estilos en los elementos, y sin eso no se pinta. Es el mismo permiso que ya tiene la web pública.
export { hashDeScript, scriptsEnLinea } from './web-admin-csp.mjs';

export function construirCsp({ supabaseUrl, hashes }) {
  const url = new URL(supabaseUrl);
  if (url.protocol !== 'https:') throw new Error(`La web de producción solo habla con un Supabase https (llegó ${supabaseUrl})`);
  const origen = url.origin;
  return [
    "default-src 'none'",
    `script-src 'self' ${[...hashes].join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${origen}`,
    "font-src 'self' data:",
    `connect-src 'self' ${origen} wss://${url.host}`,
    "manifest-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

// `no-transform`: Cloudflare inyecta en el HTML su Web Analytics y sus detecciones de JavaScript, y la CSP (sin scripts de terceros) los bloquea; con esta cabecera no modifica la respuesta.
// Cloudflare SUMA las cabeceras de todas las reglas que coinciden: por eso lo estático empieza con `! Cache-Control`, que quita el `no-store` de la regla general.
export function construirCabeceras({ supabaseUrl, hashes }) {
  return `/*
  Content-Security-Policy: ${construirCsp({ supabaseUrl, hashes })}
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  Strict-Transport-Security: max-age=31536000
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  X-Robots-Tag: noindex, nofollow
  Cache-Control: no-store, no-transform
/_expo/static/*
  ! Cache-Control
  Cache-Control: public, max-age=31536000, immutable
/assets/*
  ! Cache-Control
  Cache-Control: public, max-age=31536000, immutable
`;
}

/** El rol de cada JWT que aparezca en un texto. Un bundle publicado solo puede llevar la llave `anon`: cualquier otro rol (`service_role`) es una fuga. */
export function rolesDeJwt(texto) {
  const roles = [];
  for (const m of texto.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
    try {
      const rol = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8')).role;
      if (typeof rol === 'string') roles.push(rol);
    } catch {
      // No era un JWT: se ignora.
    }
  }
  return roles;
}

/** Cloudflare no sirve bien los archivos con corchetes en el nombre: `[id].html` pasa a `_id.html`. */
export const nombreSinCorchetes = (ruta) => ruta.replace(/\[([^\]/]+)\]/g, '_$1');
