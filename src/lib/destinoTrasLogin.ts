// Tras iniciar sesión, el panel de admin web vuelve a la ruta que se pidió. El parámetro `volverA` lo escribe quien arma el enlace, así que solo se
// obedece si es EXACTAMENTE una ruta del panel: nunca una dirección externa, ni `//host`, ni otra pantalla (redirección abierta).
const RUTAS_DEL_PANEL = new Set(['/admin', '/admin/verificaciones', '/admin/moderacion', '/admin/errores']);

export function destinoTrasLogin<T extends string>(volverA: unknown, porDefecto: T): T | string {
  return typeof volverA === 'string' && RUTAS_DEL_PANEL.has(volverA) ? volverA : porDefecto;
}
