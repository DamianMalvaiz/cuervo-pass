/**
 * El enlace de WhatsApp de «Ver contacto». AUD-17: el prefijo 52 fija México; es una decisión de alcance declarada en el README y en docs/modelo-amenazas.md, no un descuido.
 */
export function urlWhatsapp(numero: string, tituloPublicacion: string): string {
  const mensaje = encodeURIComponent(`Hola, vi tu publicación "${tituloPublicacion}" en Cuervo 360 y me interesa.`);
  return `https://wa.me/52${numero.replace(/\D/g, '')}?text=${mensaje}`;
}
