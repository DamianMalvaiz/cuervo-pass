// Documento maestro v5 · §24 — la Edge Function `ai-proxy`.
//
// v3 llamaba al microservicio directo desde la app con EXPO_PUBLIC_AI_SERVICE_URL,
// es decir: la URL del servicio y su token compartido acababan dentro del APK,
// que cualquiera descomprime. Esta función es la pieza que hace verdadera la
// afirmación "las claves nunca llegan al cliente".
//
// Despliegue:
//   supabase secrets set AI_SERVICE_URL=https://tu-tunel.trycloudflare.com
//   supabase secrets set AI_SHARED_TOKEN=$(openssl rand -hex 32)
//   supabase functions deploy ai-proxy

import { createClient } from 'jsr:@supabase/supabase-js@2';

import { clasificarErrorDeCuota, clasificarRespuesta, secretsFaltantes, validarSolicitud } from './politica.ts';

// Cuota diaria por usuario, por recurso. El parseo cuesta dinero (API de
// Anthropic); el embedding corre en CPU propia y por eso es más generoso.
const CUOTA: Record<string, { recurso: string; limite: number }> = {
  'parsear-perfil': { recurso: 'parseo_llm', limite: 30 },
  'generar-embedding': { recurso: 'embedding', limite: 200 },
};

// CORS · END-14 · `req.method !== 'POST'` devolvía 405 también al preflight, así
// que un navegador nunca llegaba a hacer la petición real. `package.json` tiene
// script `web` y `react-native-web` en dependencias, así que la app web está
// contemplada y esto la rompía en silencio.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const json = (cuerpo: unknown, status: number, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS, ...extra },
  });

Deno.serve(async (req) => {
  // El preflight va ANTES de cualquier comprobación: no lleva credenciales por
  // definición, así que exigirlas aquí lo rechazaría siempre.
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'método no permitido' }, 405);

  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'no autorizado' }, 401);

  // Falla CERRADO y ANTES de cobrar nada. Sin AI_SERVICE_URL el fetch iba a
  // `undefined/parsear-perfil`; sin AI_SHARED_TOKEN mandaba «Bearer undefined» y
  // el microservicio contestaba 401. Se registran los NOMBRES, nunca los valores.
  // Va después de comprobar que hay sesión: quien no la tiene no se entera de la
  // configuración. La app trata el 503 como cualquier degradación (Nivel 1).
  const faltantes = secretsFaltantes((n) => Deno.env.get(n));
  if (faltantes.length > 0) {
    console.error('ai-proxy: faltan secrets', { faltantes });
    return json({ degradado: true, motivo: 'sin-configurar' }, 503);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'sesión inválida' }, 401);

  // Cliente de SERVICIO, solo para devolver cuota (migración 0036).
  //
  // Antes la devolución se pedía con el cliente de arriba, o sea con el token de
  // quien llama, y por eso `devolver_cuota` tenía que estar concedida a
  // `authenticated`. Eso convertía la devolución en una RPC pública que
  // decrementaba la cuota del propio llamante: veinticinco llamadas y el límite
  // diario de revelaciones volvía a cero, en bucle, sin tocar esta función.
  //
  // Ahora el usuario va por parámetro y solo `service_role` puede llamarla. La
  // diferencia no es de estilo: es que el permiso de devolver deja de estar en
  // manos de quien se beneficia de la devolución.
  const servicio = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let crudo: unknown;
  try {
    crudo = await req.json();
  } catch {
    return json({ error: 'cuerpo inválido' }, 400);
  }

  // La forma del cuerpo, la ruta y el tope de 2000 caracteres (AUD-28) los decide la política: `null` ya no llega a desestructurarse.
  // AUD-28: sin el tope, un usuario autenticado puede mandar 2 KB en bucle contra una API que se cobra por token.
  const v = validarSolicitud(crudo);
  if (!v.ok) return json({ error: v.error }, 400);
  const { ruta, texto } = v;

  // AUD-03 y AUD-28: la cuota vive en Postgres porque es el único sitio donde
  // sobrevive a un reinicio del contenedor y a más de una réplica. Un contador
  // en memoria del proceso no es una cuota, es una sugerencia.
  const { recurso, limite } = CUOTA[ruta];
  const { error: errCuota } = await supabase.rpc('consumir_cuota', {
    p_recurso: recurso,
    p_limite: limite,
  });
  if (errCuota) {
    if (clasificarErrorDeCuota(errCuota) === 'agotada') return json({ error: 'cuota diaria agotada' }, 429);
    // No es un límite del usuario sino un fallo del sistema: se dice como degradación (la app cae al Nivel 1) y nada se cobró.
    console.error('ai-proxy: no se pudo consumir la cuota', { codigo: errCuota.code });   // el código, nunca el mensaje
    return json({ degradado: true, motivo: 'cuota-no-disponible' }, 503);
  }

  const peticionId = crypto.randomUUID();
  const control = AbortSignal.timeout(12_000);   // nunca cuelgues al cliente

  try {
    const r = await fetch(`${Deno.env.get('AI_SERVICE_URL')!.trim()}/${ruta}`, {
      method: 'POST',
      signal: control,
      headers: {
        'Content-Type': 'application/json',
        // ngrok (cuenta gratuita) pone una página intermedia a lo que parece un navegador; con esta cabecera la petición pasa directo. Otros túneles la ignoran.
        'ngrok-skip-browser-warning': '1',
        Authorization: `Bearer ${Deno.env.get('AI_SHARED_TOKEN')!.trim()}`,
        'x-usuario-id': user.id,        // clave del limitador del microservicio · AUD-03
        'x-peticion-id': peticionId,    // traza extremo a extremo · AUD-19
      },
      body: JSON.stringify({ texto }),
    });

    const cuerpo = await r.text();

    // END-14 · Dos correcciones en el mismo punto.
    //
    // 1. La cuota se DEVUELVE cuando el microservicio no entrega. Antes se cobraba
    //    antes del fetch y no se devolvía nunca: con el túnel muerto, treinta
    //    reintentos agotaban el día sin una sola llamada al modelo. Qué respuestas
    //    cuentan como «no entregó» lo decide `clasificarRespuesta`: no solo los
    //    5xx, también un 401/403/404 (token o URL mal puestos) o un 429 propio del
    //    microservicio, que tampoco son culpa de quien llama.
    //
    // 2. El cuerpo ajeno NO se reenvía. Se sanitizaban con cuidado los errores
    //    propios —el comentario de `motivo` de abajo es de eso— y se dejaba
    //    pasar un traceback entero de FastAPI, con rutas del contenedor. El
    //    cuerpo real va al registro del servidor, que es donde sirve.
    const veredicto = clasificarRespuesta(r.status);
    if (veredicto.tipo === 'degradar') {
      await servicio.rpc('devolver_cuota', { p_usuario: user.id, p_recurso: recurso });
      console.error('ai-proxy: el microservicio no entregó', {
        peticionId,
        ruta,
        estado: r.status,
        motivo: veredicto.motivo,
        cuerpo: cuerpo.slice(0, 500),
      });
      return json({ degradado: true, motivo: veredicto.motivo }, 503, {
        'x-peticion-id': peticionId,
      });
    }

    return new Response(cuerpo, {
      status: r.status,
      headers: { 'Content-Type': 'application/json', ...CORS, 'x-peticion-id': peticionId },
    });
  } catch (e) {
    // La cuota se cobró y no se entregó nada: se devuelve.
    await servicio.rpc('devolver_cuota', { p_usuario: user.id, p_recurso: recurso });
    // El microservicio no respondió. La app degrada a Nivel 1: esto NO es un 500,
    // es un estado previsto del sistema (§27).
    //
    // `motivo` clasifica el fallo sin filtrar nada: el mensaje de Deno incluye
    // la URL completa, así que solo se devuelve el TIPO. Distingue los dos casos
    // que se diagnostican distinto —"tardó más de 12 s" contra "no se pudo
    // conectar"— y sin él la app solo puede decir "non-2xx", que no orienta a
    // nadie. El detalle completo va al registro del servidor, no al cliente.
    const esTiempo = e instanceof Error && e.name === 'TimeoutError';
    console.error('ai-proxy no alcanzó el microservicio', {
      peticionId,
      ruta,
      nombre: e instanceof Error ? e.name : typeof e,
      mensaje: e instanceof Error ? e.message : String(e),
    });
    return json(
      { degradado: true, motivo: esTiempo ? 'tiempo-agotado' : 'sin-conexion' },
      503,
      { 'x-peticion-id': peticionId }
    );
  }
});
