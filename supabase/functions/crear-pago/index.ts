// Pagos con Mercado Pago · paso 4: crear la orden y la preferencia (migración 0077; lógica en `politica.ts`).
//
// La app dice QUÉ plan quiere. Esta función comprueba la sesión, crea la ORDEN en la base (el servidor fija plan y monto desde `planes`),
// le pide a Mercado Pago una preferencia de Checkout Pro con esa orden como referencia, y devuelve la URL a la que mandar a pagar.
// El plan NO se activa aquí: se activa cuando `mp-webhook` recibe el aviso del pago aprobado y lo registra.
//
// Secrets: MP_ACCESS_TOKEN (el de la cuenta vendedora de prueba mientras la app esté en pruebas). Sin él la función falla cerrado y antes de crear
// ninguna orden. Los avisos van a la URL configurada en el panel de Mercado Pago, no a una `notification_url` de la preferencia.
//
// Despliegue (con verificación de JWT, que es el valor por omisión: la llama la app con la sesión de la persona):
//   supabase functions deploy crear-pago

import { createClient } from 'jsr:@supabase/supabase-js@2';

import { construirPreferencia, interpretarRespuestaPreferencia, respuestaDeErrorOrden, validarSolicitudPago } from './politica.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const json = (cuerpo: unknown, status: number) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'método no permitido' }, 405);

  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'no autorizado' }, 401);

  // Falla CERRADO y ANTES de crear ninguna orden. Se registran los NOMBRES de lo que falta, nunca los valores.
  const requeridos = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'MP_ACCESS_TOKEN'];
  const faltantes = requeridos.filter((n) => !Deno.env.get(n)?.trim());
  if (faltantes.length > 0) {
    console.error('crear-pago: faltan secrets', { faltantes });
    return json({ degradado: true, motivo: 'sin-configurar' }, 503);
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'sesión inválida' }, 401);

  let crudo: unknown;
  try {
    crudo = await req.json();
  } catch {
    return json({ error: 'cuerpo inválido' }, 400);
  }
  const solicitud = validarSolicitudPago(crudo);
  if (!solicitud.ok) return json({ error: solicitud.error }, 400);

  const servicio = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // La identidad sale de la SESIÓN, nunca del cuerpo. El plan y el monto los valida y fija la base.
  const { data: ordenes, error: eOrden } = await servicio.rpc('crear_orden_pago', { p_usuario: user.id, p_plan: solicitud.planId });
  if (eOrden) {
    const r = respuestaDeErrorOrden(eOrden.code);
    if (r.status === 500) console.error('crear-pago: no se pudo crear la orden', { codigo: eOrden.code });
    return json({ error: r.error }, r.status);
  }
  const orden = (Array.isArray(ordenes) ? ordenes[0] : ordenes) as { orden_id?: string; monto?: number; plan_nombre?: string } | undefined;
  if (!orden?.orden_id || typeof orden.monto !== 'number' || typeof orden.plan_nombre !== 'string') {
    console.error('crear-pago: la base no devolvió la orden con la forma esperada');
    return json({ error: 'error_interno' }, 500);
  }

  let estadoMp: number;
  let cuerpoMp: unknown;
  try {
    const r = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),   // nunca cuelgues a la persona
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('MP_ACCESS_TOKEN')!.trim()}`,
        // Un reintento con la misma orden no crea una segunda preferencia.
        'X-Idempotency-Key': orden.orden_id,
      },
      body: JSON.stringify(
        construirPreferencia({ ordenId: orden.orden_id, planId: solicitud.planId, planNombre: orden.plan_nombre, montoCentavos: orden.monto }),
      ),
    });
    estadoMp = r.status;
    cuerpoMp = await r.json().catch(() => null);
  } catch (e) {
    console.error('crear-pago: no alcanzó a Mercado Pago', { orden: orden.orden_id, nombre: e instanceof Error ? e.name : typeof e });
    return json({ degradado: true, motivo: 'mp-no-disponible' }, 502);
  }

  const resultado = interpretarRespuestaPreferencia(estadoMp, cuerpoMp);
  if (!resultado.ok) {
    // El cuerpo ajeno no se reenvía ni se registra entero: solo el estado y la clasificación.
    console.error('crear-pago: Mercado Pago no entregó la preferencia', { orden: orden.orden_id, estado: estadoMp, motivo: resultado.motivo });
    return json({ degradado: true, motivo: resultado.motivo }, 502);
  }

  // Guardar el id de la preferencia ayuda a revisar una orden; si falla, no tumba nada: la orden existe y el pago funciona sin él.
  const { error: eGuardar } = await servicio.from('ordenes_pago').update({ mp_preference_id: resultado.preferenceId }).eq('id', orden.orden_id);
  if (eGuardar) console.error('crear-pago: no se guardó el id de la preferencia', { codigo: eGuardar.code });

  return json({ orden_id: orden.orden_id, url: resultado.url }, 200);
});
