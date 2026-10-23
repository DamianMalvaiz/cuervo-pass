// Decisiones de `crear-pago` sin efectos ni dependencias, para probarlas con jest (test-utils/__tests__/crear-pago-politica.test.ts).
// Aquí no hay `Deno`, ni red, ni Supabase: la Edge Function las aplica y este archivo solo decide.
//
// Tres reglas la gobiernan:
//   1 · el cliente solo dice QUÉ plan quiere; el monto, el nombre y la referencia salen de la ORDEN que crea el servidor (migración 0077);
//   2 · la URL a la que se manda a pagar sale de la respuesta de Mercado Pago, y aun así se comprueba (https y dominio de Mercado Pago);
//   3 · un fallo de Mercado Pago se dice como fallo del servicio, nunca como «plan no disponible».

const PLAN_ID = /^[a-z_]{3,40}$/;
/** Dominios a los que se puede mandar a pagar. `mercadopago.com.mx.atacante.com` no coincide: se compara el final del nombre con un punto. */
const DOMINIOS_MP = ['mercadopago.com.mx', 'mercadopago.com'];

export type SolicitudPago = { ok: true; planId: string } | { ok: false; error: 'cuerpo inválido' | 'plan inválido' };

/** Del cuerpo solo se lee `plan_id`. Cualquier otra cosa que mande el cliente (un monto, un usuario) se ignora. */
export function validarSolicitudPago(crudo: unknown): SolicitudPago {
  if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) return { ok: false, error: 'cuerpo inválido' };
  const { plan_id } = crudo as Record<string, unknown>;
  if (typeof plan_id !== 'string' || !PLAN_ID.test(plan_id)) return { ok: false, error: 'plan inválido' };
  return { ok: true, planId: plan_id };
}

export interface DatosOrden {
  ordenId: string;
  planId: string;
  planNombre: string;
  montoCentavos: number;
}

export interface Preferencia {
  items: { id: string; title: string; quantity: 1; unit_price: number; currency_id: 'MXN' }[];
  external_reference: string;
}

/**
 * El cuerpo de la preferencia de Checkout Pro. No lleva datos de la persona (ni `payer`, ni correo, ni su id), ni `notification_url`: los avisos
 * van a la URL configurada en el panel de Mercado Pago, que es la que se firma con el secreto del webhook. El monto sale de los centavos de la orden.
 */
export function construirPreferencia(o: DatosOrden): Preferencia {
  if (!Number.isInteger(o.montoCentavos) || o.montoCentavos <= 0) throw new Error('monto de la orden inválido');
  return {
    items: [
      {
        id: o.planId,
        title: `Cuervo 360 · Plan ${o.planNombre} (30 días)`,
        quantity: 1,
        unit_price: o.montoCentavos / 100,
        currency_id: 'MXN',
      },
    ],
    external_reference: o.ordenId,
  };
}

export type RespuestaPreferencia =
  | { ok: true; preferenceId: string; url: string }
  | { ok: false; motivo: 'mp-rechazo' | 'mp-no-disponible' | 'respuesta-inesperada' | 'url-no-permitida' };

function urlPermitida(texto: string): boolean {
  let u: URL;
  try {
    u = new URL(texto);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  const host = u.hostname.toLowerCase();
  return DOMINIOS_MP.some((d) => host === d || host.endsWith(`.${d}`));
}

/**
 * Qué hacer con lo que respondió Mercado Pago al crear la preferencia. Un 4xx (token, datos) es un rechazo que reintentar igual no arregla;
 * un 429 o un 5xx es que no está disponible; un 2xx sin la forma esperada, o con una URL que no es suya, no se entrega a nadie.
 */
export function interpretarRespuestaPreferencia(estado: number, cuerpo: unknown): RespuestaPreferencia {
  if (estado >= 200 && estado < 300) {
    const c = cuerpo && typeof cuerpo === 'object' && !Array.isArray(cuerpo) ? (cuerpo as Record<string, unknown>) : null;
    if (!c || typeof c.id !== 'string' || c.id === '' || typeof c.init_point !== 'string') return { ok: false, motivo: 'respuesta-inesperada' };
    return urlPermitida(c.init_point) ? { ok: true, preferenceId: c.id, url: c.init_point } : { ok: false, motivo: 'url-no-permitida' };
  }
  if (estado === 429 || estado >= 500) return { ok: false, motivo: 'mp-no-disponible' };
  if (estado >= 400) return { ok: false, motivo: 'mp-rechazo' };
  return { ok: false, motivo: 'respuesta-inesperada' };
}

/** Qué contesta la función cuando `crear_orden_pago` falla. Solo se explican los dos códigos que son de quien llama; lo demás no se cuenta. */
export function respuestaDeErrorOrden(codigo: string | undefined): { status: number; error: string } {
  if (codigo === 'CP011') return { status: 409, error: 'plan_no_disponible' };
  if (codigo === 'CP015') return { status: 429, error: 'demasiadas_ordenes' };
  return { status: 500, error: 'error_interno' };
}
