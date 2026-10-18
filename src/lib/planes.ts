// Planes y suscripciones · Cuervo 360 · migración 0053.
//
// Lo que no depende de la red ni de la pantalla: cómo se dice un precio, cuántos días quedan y cómo se describe el estado de
// una suscripción. El estado lo calcula la base al leer (vigente, prueba o gratis); aquí solo se escribe en lenguaje de
// persona, sin inventar nada que la base no haya dicho.

export type EstadoSuscripcion = 'vigente' | 'prueba' | 'gratis';

export interface MiSuscripcion {
  plan_id: string;
  plan_nombre: string;
  estado: EstadoSuscripcion;
  /** Fin del periodo pagado o de la prueba; `null` en el plan gratuito. */
  hasta: string | null;
  limite_principal: number;
  max_fotos: number;
  max_productos: number;
  destaca: boolean;
}

const formateadorPesos = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });

/** 9900 → «$99», 12550 → «$125.50», 0 → «Gratis». */
export function precioDe(centavos: number): string {
  return centavos === 0 ? 'Gratis' : `$${formateadorPesos.format(centavos / 100)}`;
}

const MS_DIA = 86_400_000;

/** Días enteros que faltan hasta `hasta` (se redondea HACIA ARRIBA: «vence hoy» es 1 día, no 0). 0 si ya pasó. */
export function diasRestantes(hasta: string | null, ahora: Date = new Date()): number {
  if (!hasta) return 0;
  const ms = new Date(hasta).getTime() - ahora.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / MS_DIA);
}

/** «12 de noviembre de 2026». */
export function fechaLarga(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Una línea que dice en qué va esta suscripción. */
export function describirSuscripcion(s: MiSuscripcion, ahora: Date = new Date()): string {
  if (s.estado === 'vigente' && s.hasta) {
    return `Plan ${s.plan_nombre} · vigente hasta el ${fechaLarga(s.hasta)}`;
  }
  if (s.estado === 'prueba' && s.hasta) {
    const d = diasRestantes(s.hasta, ahora);
    return `Prueba gratis · te ${d === 1 ? 'queda 1 día' : `quedan ${d} días`}`;
  }
  return 'Sin plan: tu negocio no aparece en Servicios hasta que contrates uno';
}

/** Lo que incluye un plan, en palabras. `rol` cambia «negocios» por «anuncios». */
export function incluyeDe(
  p: { limite_principal: number; max_fotos: number; max_productos: number; destaca: boolean },
  rol: 'comerciante' | 'arrendador'
): string[] {
  const filas: string[] = [];
  const unidad = rol === 'comerciante' ? ['negocio', 'negocios'] : ['anuncio', 'anuncios'];
  filas.push(`${p.limite_principal} ${p.limite_principal === 1 ? unidad[0] : unidad[1]} visible${p.limite_principal === 1 ? '' : 's'}`);
  if (rol === 'comerciante') {
    filas.push(`Hasta ${p.max_fotos} fotos de galería`);
    filas.push(`Hasta ${p.max_productos} productos en el menú`);
  }
  if (p.destaca) filas.push('Aparece primero en las listas');
  return filas;
}
