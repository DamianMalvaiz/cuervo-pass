// Verificación de vendedor · Cuervo 360 · migración 0049.
//
// Lo que no depende de la red ni de la pantalla: qué se le pide a quien quiere publicar y cuándo el formulario está
// completo. El servidor valida lo suyo (longitudes, rutas dentro de la carpeta propia); esto evita mandar un envío
// que ya se sabe incompleto y dice QUÉ falta, en lenguaje de persona.

/** Versión del aviso de privacidad que se registra con el consentimiento. Es la que la app muestra hoy; cuando salga
 *  el aviso v3 (borrador en docs/aviso-privacidad-v3-borrador.md, que ya contempla la INE) se cambia aquí. */
export const VERSION_AVISO = 'v2';

export const MAX_FOTOS_LUGAR = 6;

export type RolVendedor = 'comerciante' | 'arrendador';

export const esRolVendedor = (r: unknown): r is RolVendedor => r === 'comerciante' || r === 'arrendador';

export interface DatosVerificacion {
  nombreLegal: string;
  direccion: string;
  ineFrente: string | null;
  ineReverso: string | null;
  fotosLugar: string[];
  consiente: boolean;
}

export type ErroresVerificacion = Partial<Record<'nombreLegal' | 'direccion' | 'ineFrente' | 'ineReverso' | 'fotosLugar' | 'consiente', string>>;

/** Devuelve lo que falta. Objeto vacío = se puede enviar. Los límites son los de la base (0049). */
export function validarVerificacion(d: DatosVerificacion, rol: RolVendedor): ErroresVerificacion {
  const e: ErroresVerificacion = {};
  const nombre = d.nombreLegal.trim();
  const direccion = d.direccion.trim();
  if (nombre.length < 3) e.nombreLegal = 'Escribe tu nombre completo, como aparece en tu INE';
  else if (nombre.length > 120) e.nombreLegal = 'El nombre es demasiado largo';
  if (direccion.length < 5) e.direccion = 'Escribe la dirección completa';
  else if (direccion.length > 200) e.direccion = 'La dirección es demasiado larga';
  if (!d.ineFrente) e.ineFrente = 'Falta la foto del frente de tu INE';
  if (!d.ineReverso) e.ineReverso = 'Falta la foto del reverso de tu INE';
  if (d.fotosLugar.length < 1) {
    e.fotosLugar = rol === 'comerciante' ? 'Agrega al menos una foto de tu negocio' : 'Agrega al menos una foto del inmueble';
  } else if (d.fotosLugar.length > MAX_FOTOS_LUGAR) e.fotosLugar = `Máximo ${MAX_FOTOS_LUGAR} fotos`;
  if (!d.consiente) e.consiente = 'Necesitamos tu consentimiento para revisar tus documentos';
  return e;
}

export const TITULO_ROL: Record<RolVendedor, string> = { comerciante: 'comerciante', arrendador: 'arrendador' };
