// Decisiones de `mp-webhook` sin efectos ni dependencias externas, para probarlas con jest (test-utils/__tests__/mp-webhook-politica.test.ts).
// Aquí no hay `Deno`, ni red, ni Supabase: la Edge Function las aplica y este archivo solo decide.
//
// El aviso del webhook llega a una URL PÚBLICA: lo puede mandar cualquiera. Tres reglas lo gobiernan:
//   1 · la firma se verifica SIEMPRE y falla cerrado (sin secreto configurado no se procesa nada, ni siquiera con una firma «válida»);
//   2 · el aviso solo dice QUÉ pago consultar; el estado, el monto, la moneda y la orden salen de lo que Mercado Pago responde a esa consulta;
//   3 · un aviso que no se va a poder procesar nunca se contesta con 500 (reintentos eternos), y uno que sí se puede reintentar nunca con 200.

import { igualEnTiempoConstante } from '../_shared/tiempoConstante.ts';

const HEX64 = /^[0-9a-f]{64}$/;
const SOLO_DIGITOS = /^[0-9]{1,20}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── La firma ────────────────────────────────────────────────────────────────

/** `x-signature: ts=1704908010,v1=<hex de 64>` → sus dos valores, o null si no tiene esa forma. Tolera espacios, cualquier orden y claves ajenas. */
export function parsearFirma(cabecera: string | null | undefined): { ts: string; v1: string } | null {
  if (typeof cabecera !== 'string') return null;
  let ts: string | undefined;
  let v1: string | undefined;
  for (const parte of cabecera.split(',')) {
    const i = parte.indexOf('=');
    if (i < 0) continue;
    const clave = parte.slice(0, i).trim();
    const valor = parte.slice(i + 1).trim();
    if (clave === 'ts') ts = valor;
    else if (clave === 'v1') v1 = valor.toLowerCase();
  }
  if (!ts || !SOLO_DIGITOS.test(ts) || !v1 || !HEX64.test(v1)) return null;
  return { ts, v1 };
}

/**
 * El texto que firma Mercado Pago: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`. El id va en minúsculas (la documentación lo exige cuando es
 * alfanumérico) y si falta un valor se omite ese segmento.
 */
export function construirManifiesto(v: { dataId: string | null; requestId: string | null; ts: string }): string {
  let m = '';
  if (v.dataId) m += `id:${v.dataId.toLowerCase()};`;
  if (v.requestId) m += `request-id:${v.requestId};`;
  return m + `ts:${v.ts};`;
}

/** HMAC-SHA256 en hexadecimal con Web Crypto (existe en Deno y en Node; ninguna dependencia). */
export async function hmacSha256Hex(secreto: string, texto: string): Promise<string> {
  const codificador = new TextEncoder();
  const clave = await crypto.subtle.importKey('raw', codificador.encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const firma = await crypto.subtle.sign('HMAC', clave, codificador.encode(texto));
  return Array.from(new Uint8Array(firma), (b) => b.toString(16).padStart(2, '0')).join('');
}

export type ResultadoFirma =
  | { ok: true }
  | { ok: false; motivo: 'sin-secreto' | 'sin-firma' | 'firma-mal-formada' | 'sin-id' | 'no-coincide' };

/**
 * ¿Este aviso lo mandó Mercado Pago? FALLA CERRADO: sin secreto, sin cabecera o sin id de pago no pasa nada. El secreto se comprueba ANTES que la
 * firma: HMAC con una clave vacía es calculable por cualquiera, así que una firma «válida» contra un secreto ausente no vale.
 */
export async function verificarFirma(v: {
  cabeceraFirma: string | null | undefined;
  requestId: string | null;
  dataId: string | null;
  secreto: string | null | undefined;
}): Promise<ResultadoFirma> {
  if (typeof v.secreto !== 'string' || v.secreto.trim() === '') return { ok: false, motivo: 'sin-secreto' };
  if (typeof v.cabeceraFirma !== 'string' || v.cabeceraFirma.trim() === '') return { ok: false, motivo: 'sin-firma' };
  const firma = parsearFirma(v.cabeceraFirma);
  if (!firma) return { ok: false, motivo: 'firma-mal-formada' };
  // Sin id de pago el manifiesto omitiría ese segmento y una firma legítima del resto coincidiría: el id se exige aparte.
  if (!v.dataId) return { ok: false, motivo: 'sin-id' };
  const esperado = await hmacSha256Hex(v.secreto, construirManifiesto({ dataId: v.dataId, requestId: v.requestId, ts: firma.ts }));
  return igualEnTiempoConstante(esperado, firma.v1) ? { ok: true } : { ok: false, motivo: 'no-coincide' };
}

// ── Qué dice el aviso ───────────────────────────────────────────────────────

export type Aviso =
  | { tipo: 'pago'; dataId: string }
  | { tipo: 'ignorar'; motivo: string }
  | { tipo: 'invalido'; motivo: string };

/**
 * Del aviso solo se toma QUÉ pago consultar. El id sale de la query (`data.id`, que es lo que cubre la firma) y, si no viene, del cuerpo. Otros
 * tipos de aviso (órdenes, planes, suscripciones) se ignoran con 200: no son de este flujo y reintentarlos no los arregla.
 */
export function extraerAviso(url: string, cuerpo: unknown): Aviso {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { tipo: 'invalido', motivo: 'url' };
  }
  const obj: Record<string, unknown> = cuerpo && typeof cuerpo === 'object' && !Array.isArray(cuerpo) ? (cuerpo as Record<string, unknown>) : {};

  const tipo = u.searchParams.get('type') ?? u.searchParams.get('topic') ?? (typeof obj.type === 'string' ? obj.type : null);
  if (tipo !== 'payment') return { tipo: 'ignorar', motivo: tipo ?? 'sin-tipo' };

  const idCuerpo = obj.data && typeof obj.data === 'object' ? (obj.data as Record<string, unknown>).id : undefined;
  const crudo = u.searchParams.get('data.id') ?? (typeof idCuerpo === 'string' || typeof idCuerpo === 'number' ? String(idCuerpo) : null);
  if (crudo === null || !SOLO_DIGITOS.test(crudo)) return { tipo: 'invalido', motivo: 'id-de-pago' };
  return { tipo: 'pago', dataId: crudo };
}

// ── Qué cobró Mercado Pago ──────────────────────────────────────────────────

export type DecisionPago =
  | { ok: true; ordenId: string; estado: string; montoCentavos: number }
  | { ok: false; motivo: 'pago-mal-formado' | 'moneda-no-mxn' | 'sin-referencia' | 'monto-invalido' };

/**
 * Del pago que Mercado Pago devolvió al consultarlo por su id (no de lo que traiga el aviso): la orden (`external_reference`), el estado y el monto en
 * centavos. Se exige MXN y una referencia con forma de uuid. Un monto con fracciones de centavo no es un precio del catálogo: se rechaza, no se redondea.
 * El estado pasa tal cual: decidir qué hacer con cada uno es de la base (`registrar_pago_mp`).
 */
export function decidirPago(pago: unknown): DecisionPago {
  if (!pago || typeof pago !== 'object' || Array.isArray(pago)) return { ok: false, motivo: 'pago-mal-formado' };
  const p = pago as Record<string, unknown>;
  if (typeof p.status !== 'string' || p.status === '') return { ok: false, motivo: 'pago-mal-formado' };
  if (p.currency_id !== 'MXN') return { ok: false, motivo: 'moneda-no-mxn' };
  if (typeof p.external_reference !== 'string' || !UUID.test(p.external_reference)) return { ok: false, motivo: 'sin-referencia' };

  const monto = p.transaction_amount;
  if (typeof monto !== 'number' || !Number.isFinite(monto) || monto <= 0) return { ok: false, motivo: 'monto-invalido' };
  const centavos = Math.round(monto * 100);
  if (Math.abs(monto * 100 - centavos) > 1e-6) return { ok: false, motivo: 'monto-invalido' };

  return { ok: true, ordenId: p.external_reference.toLowerCase(), estado: p.status, montoCentavos: centavos };
}

// ── Qué se le contesta a Mercado Pago ───────────────────────────────────────

export interface RespuestaDeRegistro {
  status: 200 | 500;
  /** `alerta` = algo que un humano debería mirar (va a `console.error`). */
  nivel: 'info' | 'alerta';
  etiqueta: string;
}

/**
 * Qué contesta el webhook según lo que devolvió `registrar_pago_mp`. Mercado Pago reintenta cada 15 minutos mientras no reciba 200 o 201: un
 * monto distinto o una orden inexistente no se arreglan reintentando (200 con alerta), y un resultado que la función no conoce es un 500 para que
 * reintente en vez de perder un pago por una versión desfasada.
 */
export function respuestaDeRegistro(resultado: unknown): RespuestaDeRegistro {
  if (typeof resultado === 'string') {
    if (['activado', 'duplicado', 'pendiente', 'rechazado', 'ignorado'].includes(resultado)) return { status: 200, nivel: 'info', etiqueta: resultado };
    if (['monto_distinto', 'orden_inexistente'].includes(resultado)) return { status: 200, nivel: 'alerta', etiqueta: resultado };
  }
  return { status: 500, nivel: 'alerta', etiqueta: 'resultado-desconocido' };
}

// ── Lo que no es el camino feliz ────────────────────────────────────────────
// La regla de las tres: lo que un reintento puede arreglar es 5xx (Mercado Pago reintenta cada 15 min); lo que no, 200 con su registro; y lo que
// no demostró venir de Mercado Pago, 401/503. Nunca un 200 que pierda un pago ni un 500 eterno por algo que no cambia.

export interface RespuestaWebhook {
  status: 200 | 400 | 401 | 500 | 503;
  nivel: 'info' | 'alerta';
  etiqueta: string;
}

/** El aviso no demostró venir de Mercado Pago. Un motivo desconocido NO deja pasar. */
export function respuestaDeFirmaFallida(motivo: string): RespuestaWebhook {
  if (motivo === 'sin-secreto') return { status: 503, nivel: 'alerta', etiqueta: 'sin-secreto' };
  if (motivo === 'no-coincide') return { status: 401, nivel: 'alerta', etiqueta: 'no-coincide' };
  if (['sin-firma', 'firma-mal-formada', 'sin-id'].includes(motivo)) return { status: 401, nivel: 'info', etiqueta: motivo };
  return { status: 401, nivel: 'alerta', etiqueta: 'firma-desconocida' };
}

export type ConsultaPago =
  | { accion: 'procesar'; pago: object }
  | ({ accion: 'responder' } & RespuestaWebhook);

/** Qué hacer con lo que contestó `GET /v1/payments/{id}`. */
export function clasificarConsultaPago(status: number, cuerpo: unknown): ConsultaPago {
  const responder = (s: 200 | 500, nivel: 'info' | 'alerta', etiqueta: string): ConsultaPago => ({ accion: 'responder', status: s, nivel, etiqueta });
  if (status === 200) {
    if (cuerpo && typeof cuerpo === 'object' && !Array.isArray(cuerpo)) return { accion: 'procesar', pago: cuerpo };
    return responder(500, 'alerta', 'consulta-mal-formada');
  }
  if (status === 404) return responder(200, 'info', 'pago-inexistente');
  if (status === 401 || status === 403) return responder(500, 'alerta', 'credencial-rechazada');
  if (status === 429 || status >= 500) return responder(500, 'alerta', 'mp-no-disponible');
  if (status >= 400) return responder(200, 'alerta', 'consulta-rechazada');
  return responder(500, 'alerta', 'consulta-inesperada');
}

/** Un pago que no se pudo convertir en una orden (ver `decidirPago`). */
export function respuestaDeDecisionFallida(motivo: string): RespuestaWebhook {
  if (motivo === 'sin-referencia') return { status: 200, nivel: 'info', etiqueta: 'pago-ajeno' };
  if (motivo === 'moneda-no-mxn' || motivo === 'monto-invalido') return { status: 200, nivel: 'alerta', etiqueta: motivo };
  if (motivo === 'pago-mal-formado') return { status: 500, nivel: 'alerta', etiqueta: 'pago-mal-formado' };
  return { status: 500, nivel: 'alerta', etiqueta: 'decision-desconocida' };
}
