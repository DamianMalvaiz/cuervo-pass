// Pagos con Mercado Pago · lo que la app dice y decide (paso 4).
//
// La app no cobra nada ni activa nada: le pide a la Edge Function `crear-pago` una orden y la URL de Mercado Pago, abre esa URL, y el plan se activa
// cuando `mp-webhook` recibe el aviso del pago aprobado. Aquí vive lo que se puede decidir sin red: cada fallo se explica por SU motivo (un fallo
// de Mercado Pago no es «plan no disponible»), nunca se abre una URL que no sea de Mercado Pago, y lo pendiente se dice como pendiente.

import type { OrdenPago } from '@/types/database.types';

export type TipoErrorPago = 'plan_no_disponible' | 'demasiadas_ordenes' | 'no_disponible' | 'sesion' | 'red' | 'desconocido';

export class ErrorPago extends Error {
  constructor(readonly tipo: TipoErrorPago) {
    super(tipo);
    this.name = 'ErrorPago';
  }
}

/** Qué fue mal, según la respuesta HTTP de `crear-pago`. Sin respuesta (`status` indefinido) es la red. */
export function tipoDeErrorPago(status: number | undefined, codigo: string | undefined): TipoErrorPago {
  if (status === undefined) return 'red';
  if (status === 401) return 'sesion';
  if (status === 409 && codigo === 'plan_no_disponible') return 'plan_no_disponible';
  if (status === 429 && codigo === 'demasiadas_ordenes') return 'demasiadas_ordenes';
  if (status === 502 || status === 503) return 'no_disponible';
  return 'desconocido';
}

const MENSAJES: Record<TipoErrorPago, string> = {
  plan_no_disponible: 'Ese plan no está disponible para tu cuenta. Verifica tu identidad primero.',
  demasiadas_ordenes: 'Ya empezaste varios pagos sin terminarlos. Espera un poco antes de intentar otro.',
  no_disponible: 'Mercado Pago no está disponible por ahora. Inténtalo de nuevo en unos minutos.',
  sesion: 'Tu sesión caducó. Vuelve a entrar e inténtalo de nuevo.',
  red: 'No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo.',
  desconocido: 'No pudimos iniciar el pago. Inténtalo de nuevo.',
};

export function mensajeDeErrorPago(tipo: TipoErrorPago): string {
  return MENSAJES[tipo];
}

// El servidor ya valida la URL (`crear-pago/politica.ts`); aquí se repite porque es lo último antes de `Linking.openURL`: una lista corta y propia, no
// importada de las Edge Functions (otro entorno de ejecución). `mercadopago.com.mx.atacante.com` no coincide: se compara el final con un punto.
const DOMINIOS_MP = ['mercadopago.com.mx', 'mercadopago.com'];

/** ¿Es una URL https de Mercado Pago? Es lo único que la app abre para pagar. */
export function esUrlDePago(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  const host = u.hostname.toLowerCase();
  return DOMINIOS_MP.some((d) => host === d || host.endsWith(`.${d}`));
}

/** El texto del diálogo de confirmación. Mientras la app esté en pruebas lo dice; cuando pase a producción es lo único que hay que cambiar. */
export function textoConfirmarPago(precio: string): string {
  return `Se abrirá Mercado Pago para pagar ${precio}. Mientras la app esté en pruebas, usa una cuenta y una tarjeta de prueba: no se cobra dinero real. Si eliges OXXO, el plan se activa cuando pagues en la tienda.`;
}

/** El aviso fijo de la pantalla de planes. */
export const AVISO_PAGOS =
  'Modo de PRUEBA: no se cobra dinero real. Con Mercado Pago usa una cuenta y una tarjeta de prueba; «Probar sin pagar» activa el plan sin pasar por Mercado Pago.';

const VENTANA_ESPERA_MS = 30 * 60_000;

/**
 * Qué decir de la última orden. `pendiente` (OXXO: falta pagar en la tienda) se dice siempre. `creada` solo si es reciente: una orden que se
 * abandonó hace horas no es una espera. Lo demás no lleva aviso: una orden pagada ya se ve en el plan.
 */
export function describirOrden(estado: string | null | undefined, creadaEn: string, ahora: Date = new Date()): string | null {
  if (estado === 'pendiente') return 'Tu pago está pendiente. Si elegiste OXXO, el plan se activa cuando pagues en la tienda.';
  if (estado === 'creada') {
    const edad = ahora.getTime() - new Date(creadaEn).getTime();
    if (Number.isFinite(edad) && edad >= 0 && edad < VENTANA_ESPERA_MS) {
      return 'Estamos esperando la confirmación de Mercado Pago. Si ya pagaste, tarda unos segundos.';
    }
  }
  return null;
}

/** Cada cuánto volver a preguntar por la orden: solo mientras espera su aviso (`creada`). */
export function sondearOrden(estado: OrdenPago['estado'] | string | undefined): number | false {
  return estado === 'creada' ? 5000 : false;
}
