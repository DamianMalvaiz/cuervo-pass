// Qué plantilla sirve el Worker. Expo exporta UNA plantilla por pantalla con parámetro (`departamentos/[id]`, `servicios/[id]`), no una página por id: el id de la URL lo lee el navegador.
// Solo se acepta un id con forma de id (letras, números y guiones, hasta 64): nada de rutas, puntos ni espacios. Las páginas sin id (`/departamentos`, `/servicios`, `/roomies`) son archivos y no pasan por aquí.
const ID = '[A-Za-z0-9-]{1,64}';
const VIVIENDA = new RegExp(`^/departamentos/${ID}/?$`);
const NEGOCIO = new RegExp(`^/servicios/${ID}/?$`);

/** La ruta de la plantilla para este camino, o `null` si el Worker no debe tocarlo. */
export function rutaDePlantilla(camino) {
  if (VIVIENDA.test(camino)) return '/departamentos/_id';
  if (NEGOCIO.test(camino)) return '/servicios/_id';
  return null;
}

const DOMINIO = 'cuervo360.com';
const SUBDOMINIO_VIEJO = `app.${DOMINIO}`;

/** A dónde mandar una petición hecha al subdominio viejo (`app.`), o `null` si no es de ese host. Solo ese host exacto: nada de coincidencias parciales. */
export function destinoDeRedireccion(direccion) {
  const url = new URL(direccion);
  if (url.hostname !== SUBDOMINIO_VIEJO) return null;
  return `https://${DOMINIO}${url.pathname}${url.search}`;
}
