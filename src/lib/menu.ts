// El menú de un negocio · Cuervo 360 · migración 0053.
//
// Lo que no depende de la red ni de la pantalla: cuándo un producto es válido, cómo se agrupa un menú largo en secciones y
// cómo se busca en él. La base vuelve a validar lo suyo (longitudes, tope del plan, rutas de foto); esto evita mandar lo
// que ya se sabe mal y dice QUÉ falla.

export const MAX_PRODUCTOS_TECNICO = 250;
export const MAX_LARGO_NOMBRE = 80;
export const MAX_LARGO_SECCION = 40;
export const MAX_LARGO_DESCRIPCION = 200;
/** El tope de la base (0085): un producto lleva hasta 5 fotos, la primera es la portada. */
export const MAX_FOTOS_PRODUCTO = 5;

export interface ProductoEditable {
  /** Clave local estable para la lista (el id de la base si ya existe). */
  clave: string;
  /** Presente si el producto ya existe en la base. */
  id?: string;
  nombre: string;
  /** Texto tal como se escribió; vacío = «consultar precio». */
  precio: string;
  seccion: string;
  descripcion: string;
  /** Rutas de Storage de las fotos que YA están guardadas, en orden (la primera es la portada). */
  fotos: string[];
  /** URIs locales de fotos nuevas elegidas en esta sesión; se suben al guardar y quedan DESPUÉS de las guardadas. */
  fotosNuevas: string[];
}

/** «35» → 35, «35,50» → 35.5, «» → null (consultar precio), «abc» o negativo → NaN (error). */
export function parsearPrecio(texto: string): number | null {
  const t = texto.trim().replace(',', '.');
  if (t === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return Number.NaN;
  return Number(t);
}

export type ErroresProducto = Partial<Record<'nombre' | 'precio' | 'seccion' | 'descripcion' | 'fotos', string>>;

export function validarProducto(p: Pick<ProductoEditable, 'nombre' | 'precio' | 'seccion' | 'descripcion' | 'fotos' | 'fotosNuevas'>): ErroresProducto {
  const e: ErroresProducto = {};
  const nombre = p.nombre.trim();
  if (nombre.length < 1) e.nombre = 'Escribe el nombre del producto';
  else if (nombre.length > MAX_LARGO_NOMBRE) e.nombre = `El nombre es demasiado largo (máximo ${MAX_LARGO_NOMBRE})`;
  if (Number.isNaN(parsearPrecio(p.precio))) e.precio = 'Escribe solo números, por ejemplo 35 o 35.50';
  if (p.seccion.trim().length > MAX_LARGO_SECCION) e.seccion = `La sección es demasiado larga (máximo ${MAX_LARGO_SECCION})`;
  if (p.descripcion.trim().length > MAX_LARGO_DESCRIPCION) {
    e.descripcion = `La descripción es demasiado larga (máximo ${MAX_LARGO_DESCRIPCION})`;
  }
  const sobran = p.fotos.length + p.fotosNuevas.length - MAX_FOTOS_PRODUCTO;
  if (sobran > 0) e.fotos = `Un producto lleva hasta ${MAX_FOTOS_PRODUCTO} fotos. Quita ${sobran}.`;
  return e;
}

/** Valida el menú ENTERO antes de guardarlo. Devuelve el primer problema, ya con el nombre del producto. */
export function validarMenu(productos: ProductoEditable[], maxPlan: number = MAX_PRODUCTOS_TECNICO): string | null {
  const tope = Math.min(maxPlan, MAX_PRODUCTOS_TECNICO);
  if (productos.length > tope) return `Tu plan permite hasta ${tope} productos. Quita ${productos.length - tope} para guardar.`;
  for (const p of productos) {
    const e = validarProducto(p);
    const primero = e.nombre ?? e.precio ?? e.seccion ?? e.descripcion ?? e.fotos;
    if (primero) return p.nombre.trim() ? `«${p.nombre.trim()}»: ${primero}` : primero;
  }
  return null;
}

export interface GrupoMenu<T extends { seccion: string } = ProductoEditable> {
  /** Nombre de la sección; `null` agrupa los que no tienen. */
  seccion: string | null;
  productos: T[];
}

/**
 * Agrupa en secciones respetando el ORDEN del menú: cada sección aparece donde aparece su primer producto, y los
 * productos sin sección van al final. La comparación ignora mayúsculas y espacios sobrantes («Tacos» y «tacos » son la
 * misma sección), y se conserva la escritura de la primera.
 */
export function agruparPorSeccion<T extends { seccion: string }>(productos: T[]): GrupoMenu<T>[] {
  const grupos: GrupoMenu<T>[] = [];
  const indice = new Map<string, GrupoMenu<T>>();
  const sin: T[] = [];
  for (const p of productos) {
    const nombre = p.seccion.trim();
    if (!nombre) {
      sin.push(p);
      continue;
    }
    const clave = nombre.toLocaleLowerCase('es');
    let g = indice.get(clave);
    if (!g) {
      g = { seccion: nombre, productos: [] };
      indice.set(clave, g);
      grupos.push(g);
    }
    g.productos.push(p);
  }
  if (sin.length > 0) grupos.push({ seccion: null, productos: sin });
  return grupos;
}

/** Las secciones distintas que ya existen, en orden de aparición (para ofrecerlas al editar un producto). */
export function seccionesDe<T extends { seccion: string }>(productos: T[]): string[] {
  return agruparPorSeccion(productos)
    .map((g) => g.seccion)
    .filter((s): s is string => s !== null);
}

const normalizar = (t: string) =>
  t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es').trim();

/** Busca por nombre, descripción o sección, sin importar mayúsculas ni acentos. Texto vacío = todo. */
export function buscarEnMenu(productos: ProductoEditable[], texto: string): ProductoEditable[] {
  const q = normalizar(texto);
  if (!q) return productos;
  return productos.filter((p) => normalizar(`${p.nombre} ${p.descripcion} ${p.seccion}`).includes(q));
}

let contador = 0;
/** Una clave local única para un producto nuevo. */
export const claveNueva = () => `nuevo-${Date.now()}-${++contador}`;

export const productoVacio = (): ProductoEditable => ({
  clave: claveNueva(), nombre: '', precio: '', seccion: '', descripcion: '', fotos: [], fotosNuevas: [],
});
