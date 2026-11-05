// «¿Qué alcanza con tu presupuesto?»: cuántos de los lugares publicados caben en un monto, en total, por tipo y por tramo de renta. Pura: recibe las rentas y el monto; no sabe de red ni de pantalla.

import type { TipoVivienda } from '@/services/explorar.service';

export interface PrecioPublicado {
  precio_renta: number;
  tipo: TipoVivienda;
}

/** Los topes de los tramos de la gráfica (el último es «más»). */
export const TOPES_TRAMO = [2000, 3000, 4000, 5000, 6000] as const;
/** Los montos que se ofrecen para probar. */
export const MONTOS = [2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000] as const;

export interface Tramo {
  etiqueta: string;
  /** Cuántos lugares hay en el tramo. */
  total: number;
  /** De esos, cuántos caben en el monto. */
  alcanzan: number;
}

export interface ResumenMercado {
  total: number;
  alcanzan: number;
  porTipo: Record<TipoVivienda, { total: number; alcanzan: number }>;
  tramos: Tramo[];
}

const pesos = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
const dinero = (n: number) => `$${pesos.format(n)}`;

/** Un tramo es «hasta $2,000», «$2,001 a $3,000»… y «más de $6,000». */
export function etiquetaDeTramo(i: number): string {
  if (i === 0) return `Hasta ${dinero(TOPES_TRAMO[0])}`;
  if (i < TOPES_TRAMO.length) return `${dinero(TOPES_TRAMO[i - 1] + 1)} a ${dinero(TOPES_TRAMO[i])}`;
  return `Más de ${dinero(TOPES_TRAMO[TOPES_TRAMO.length - 1])}`;
}

/** El tramo de una renta: el primero cuyo tope la cubre; si ninguno, el último. */
export function tramoDe(renta: number): number {
  const i = TOPES_TRAMO.findIndex((t) => renta <= t);
  return i === -1 ? TOPES_TRAMO.length : i;
}

/** Lo que cabe en `monto`. Una renta igual al monto SÍ cabe («hasta»). Las rentas que no son un número positivo no se cuentan (no se inventa un lugar de $0). */
export function resumirMercado(precios: PrecioPublicado[], monto: number): ResumenMercado {
  const validos = precios.filter((p) => Number.isFinite(p.precio_renta) && p.precio_renta > 0);
  const porTipo: ResumenMercado['porTipo'] = { cuarto: { total: 0, alcanzan: 0 }, depa: { total: 0, alcanzan: 0 }, casa_compartida: { total: 0, alcanzan: 0 } };
  const tramos: Tramo[] = Array.from({ length: TOPES_TRAMO.length + 1 }, (_, i) => ({ etiqueta: etiquetaDeTramo(i), total: 0, alcanzan: 0 }));
  let alcanzan = 0;
  for (const p of validos) {
    const cabe = p.precio_renta <= monto;
    if (cabe) alcanzan++;
    if (porTipo[p.tipo]) {
      porTipo[p.tipo].total++;
      if (cabe) porTipo[p.tipo].alcanzan++;
    }
    const t = tramos[tramoDe(p.precio_renta)];
    t.total++;
    if (cabe) t.alcanzan++;
  }
  return { total: validos.length, alcanzan, porTipo, tramos };
}
