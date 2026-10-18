// Publicar un negocio · Cuervo 360 · migración 0052.
//
// Lo que no depende de la red ni de la pantalla: cuándo el formulario está completo y cómo se lee un precio. El servidor
// vuelve a validar lo suyo (longitudes, topes, rutas de foto); esto evita mandar lo que ya se sabe mal y dice QUÉ falla.
// Los límites son los de la base (0047 y 0052).

export const MAX_FOTOS_NEGOCIO = 8;
export const MAX_ITEMS_MENU = 40;

export interface ItemEditable {
  /** Presente si el producto ya existe en la base; ausente si es nuevo. */
  id?: string;
  nombre: string;
  /** Texto tal como se escribió («35», «35.50», «35,50»); vacío = «consultar precio». */
  precio: string;
}

export interface DatosNegocioForm {
  categoriaId: string | null;
  nombre: string;
  descripcion: string;
  direccion: string;
  rangoPrecio: number | null;
  horario: string;
  fotos: string[];
  items: ItemEditable[];
}

/** «35» → 35, «35,50» → 35.5, «» → null (consultar precio), «abc» o negativo → NaN (error). */
export function parsearPrecio(texto: string): number | null {
  const t = texto.trim().replace(',', '.');
  if (t === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return Number.NaN;
  return Number(t);
}

export interface ErroresNegocio {
  categoriaId?: string;
  nombre?: string;
  descripcion?: string;
  direccion?: string;
  horario?: string;
  fotos?: string;
  items?: string;
}

export function validarNegocio(d: DatosNegocioForm): ErroresNegocio {
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
  if (d.fotos.length > MAX_FOTOS_NEGOCIO) e.fotos = `Máximo ${MAX_FOTOS_NEGOCIO} fotos`;

  if (d.items.length > MAX_ITEMS_MENU) e.items = `Máximo ${MAX_ITEMS_MENU} productos`;
  else {
    for (const it of d.items) {
      const n = it.nombre.trim();
      if (n.length < 1 || n.length > 80) {
        e.items = 'Cada producto necesita un nombre (máximo 80 letras)';
        break;
      }
      if (Number.isNaN(parsearPrecio(it.precio))) {
        e.items = `El precio de «${n}» no es válido. Escribe solo números, por ejemplo 35 o 35.50`;
        break;
      }
    }
  }
  return e;
}
