// Qué plantilla sirve el Worker. Expo exporta UNA plantilla por pantalla con parámetro (`explorar/[id]`), no una página por id: el id de la URL lo lee el navegador.
// Solo se acepta un id con forma de id (letras, números y guiones, hasta 64): nada de rutas, puntos ni espacios.
const ID = '[A-Za-z0-9-]{1,64}';
const NEGOCIO = new RegExp(`^/explorar/negocio/${ID}/?$`);
const VIVIENDA = new RegExp(`^/explorar/(?!negocio/?$)${ID}/?$`);

/** La ruta de la plantilla para este camino, o `null` si el Worker no debe tocarlo. */
export function rutaDePlantilla(camino) {
  if (NEGOCIO.test(camino)) return '/explorar/negocio/_id';
  if (VIVIENDA.test(camino)) return '/explorar/_id';
  return null;
}
