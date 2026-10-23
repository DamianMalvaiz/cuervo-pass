// Pagos con Mercado Pago · paso 3: el aviso del pago (migración 0077; lógica en `politica.ts`).
//
// URL PÚBLICA: la llama Mercado Pago desde su servidor, sin sesión. Por eso el orden de los pasos ES la seguridad:
//   1 · secretos presentes (si no, 503: falla cerrado)  2 · el aviso tiene la forma esperada  3 · la FIRMA coincide
//   4 · se consulta el pago a Mercado Pago por su id    5 · orden, estado y monto salen de ESA respuesta, nunca del cuerpo del aviso
//   6 · `registrar_pago_mp` (idempotente y atómica)     7 · se contesta según la política.
// El aviso solo dice QUÉ pago consultar. Los reembolsos NO se manejan todavía (se ignoran y se registran).
//
// Secrets: MP_WEBHOOK_SECRET (el del panel de Mercado Pago, evento «Pagos») y MP_ACCESS_TOKEN. Nunca se escriben en un console.
//
// Despliegue (SIN verificación de JWT: Mercado Pago no manda ninguno; la firma es la autenticación):
//   supabase functions deploy mp-webhook --no-verify-jwt

import { createClient } from 'jsr:@supabase/supabase-js@2';

import {
  clasificarConsultaPago,
  decidirPago,
  extraerAviso,
  respuestaDeDecisionFallida,
  respuestaDeFirmaFallida,
  respuestaDeRegistro,
  verificarFirma,
} from './politica.ts';

const responder = (r: { status: number; nivel: string; etiqueta: string }, extra: Record<string, unknown> = {}) => {
  if (r.nivel === 'alerta') console.error('mp-webhook:', { etiqueta: r.etiqueta, ...extra });
  else console.log('mp-webhook:', { etiqueta: r.etiqueta, ...extra });
  return new Response(JSON.stringify({ resultado: r.etiqueta }), { status: r.status, headers: { 'Content-Type': 'application/json' } });
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(null, { status: 405 });

  // Falla CERRADO. Se registran los NOMBRES de lo que falta, nunca los valores.
  const requeridos = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'MP_ACCESS_TOKEN', 'MP_WEBHOOK_SECRET'];
  const faltantes = requeridos.filter((n) => !Deno.env.get(n)?.trim());
  if (faltantes.length > 0) return responder({ status: 503, nivel: 'alerta', etiqueta: 'sin-configurar' }, { faltantes });

  const cuerpo: unknown = await req.json().catch(() => null);
  const aviso = extraerAviso(req.url, cuerpo);
  if (aviso.tipo === 'invalido') return responder({ status: 400, nivel: 'info', etiqueta: 'aviso-invalido' });
  if (aviso.tipo === 'ignorar') return responder({ status: 200, nivel: 'info', etiqueta: 'aviso-ignorado' });

  const firma = await verificarFirma({
    cabeceraFirma: req.headers.get('x-signature'),
    requestId: req.headers.get('x-request-id'),
    dataId: aviso.dataId,
    secreto: Deno.env.get('MP_WEBHOOK_SECRET'),
  });
  if (!firma.ok) return responder(respuestaDeFirmaFallida(firma.motivo));

  let estadoMp: number;
  let cuerpoMp: unknown;
  try {
    const r = await fetch(`https://api.mercadopago.com/v1/payments/${aviso.dataId}`, {
      signal: AbortSignal.timeout(10_000),   // Mercado Pago da 22 s para contestar el aviso
      headers: { Authorization: `Bearer ${Deno.env.get('MP_ACCESS_TOKEN')!.trim()}` },
    });
    estadoMp = r.status;
    cuerpoMp = await r.json().catch(() => null);
  } catch (e) {
    return responder({ status: 500, nivel: 'alerta', etiqueta: 'mp-inalcanzable' }, { nombre: e instanceof Error ? e.name : typeof e });
  }

  const consulta = clasificarConsultaPago(estadoMp, cuerpoMp);
  if (consulta.accion === 'responder') return responder(consulta, { estado: estadoMp, pago: aviso.dataId });

  const decision = decidirPago(consulta.pago);
  if (!decision.ok) return responder(respuestaDeDecisionFallida(decision.motivo), { pago: aviso.dataId });

  const servicio = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data, error: eRegistro } = await servicio.rpc('registrar_pago_mp', {
    p_orden: decision.ordenId,
    p_mp_payment_id: aviso.dataId,
    p_estado_mp: decision.estado,
    p_monto_centavos: decision.montoCentavos,
  });
  // Un fallo de la base es transitorio: 500 para que Mercado Pago reintente. Solo el código, nunca el mensaje.
  if (eRegistro) return responder({ status: 500, nivel: 'alerta', etiqueta: 'registro-fallido' }, { codigo: eRegistro.code, pago: aviso.dataId });

  return responder(respuestaDeRegistro(data), { orden: decision.ordenId, pago: aviso.dataId });
});
