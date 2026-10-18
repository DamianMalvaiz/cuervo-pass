// Publicar un negocio · Cuervo 360 · migración 0052.
//
// Lo que no depende de la red ni de la pantalla: cuándo el formulario está completo y cómo se lee un precio. El servidor
// vuelve a validar lo suyo (longitudes, topes, rutas de foto); esto evita mandar lo que ya se sabe mal y dice QUÉ falla.
// Los límites son los de la base (0047 y 0052).

/** Cota técnica de la base (0053). Lo que manda es el límite del plan (4 / 20 / 60), que la base hace cumplir (CP012). */
export const MAX_FOTOS_NEGOCIO = 60;

export interface DatosNegocioForm {
  categoriaId: string | null;
  nombre: string;
  descripcion: string;
  direccion: string;
  rangoPrecio: number | null;
  horario: string;
  fotos: string[];
}

export interface ErroresNegocio {
  categoriaId?: string;
  nombre?: string;
  descripcion?: string;
  direccion?: string;
  horario?: string;
  fotos?: string;
}

/** `maxFotos` es el límite del plan de la cuenta, si se conoce; si no, rige la cota técnica y la base hace cumplir el plan (CP012). */
export function validarNegocio(d: DatosNegocioForm, maxFotos: number = MAX_FOTOS_NEGOCIO): ErroresNegocio {
  const e: ErroresNegocio = {};
  const nombre = d.nombre.trim();
  const direccion = d.direccion.trim();
  if (!d.categoriaId) e.categoriaId = 'Elige una categoría';
  if (nombre.length < 2) e.nombre = 'Escribe el nombre de tu negocio';
  else if (nombre.length > 80) e.nombre = 'El nombre es demasiado largo (máximo 80)';
  if (direccion.length < 3) e.direccion = 'Escribe la dirección';
  else if (direccion.length > 200) e.direccion = 'La dirección es demasiado larga (máximo 200)';
  if (d.descripcion.trim().length > 600) e.descripcion = 'La descripción es demasiado larga (máximo 600)';
  if (d.horario.trim().length > 120) e.horario = 'El horario es demasiado largo (máximo 120)';
  const tope = Math.min(maxFotos, MAX_FOTOS_NEGOCIO);
  if (d.fotos.length > tope) e.fotos = `Tu plan permite hasta ${tope} fotos. Quita ${d.fotos.length - tope} para guardar.`;

  return e;
}
