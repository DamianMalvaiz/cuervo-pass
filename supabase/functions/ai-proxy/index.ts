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

const RUTAS_PERMITIDAS = ['parsear-perfil', 'generar-embedding'] as const;

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

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'sesión inválida' }, 401);

  let cuerpo: { ruta?: string; texto?: string };
  try {
    cuerpo = await req.json();
  } catch {
    return json({ error: 'cuerpo inválido' }, 400);
  }

  const { ruta, texto } = cuerpo;
  if (!ruta || !RUTAS_PERMITIDAS.includes(ruta as typeof RUTAS_PERMITIDAS[number])) {
    return json({ error: 'ruta no permitida' }, 400);
  }

  // AUD-28: sin esto, un usuario autenticado puede mandar 2 KB en bucle contra
  // una API que se cobra por token. El límite de tamaño es la primera barrera,
  // y es la misma cota que valida Pydantic del otro lado.
  if (typeof texto !== 'string' || texto.length === 0 || texto.length > 2000) {
    return json({ error: 'texto inválido' }, 400);
  }

  // AUD-03 y AUD-28: la cuota vive en Postgres porque es el único sitio donde
  // sobrevive a un reinicio del contenedor y a más de una réplica. Un contador
  // en memoria del proceso no es una cuota, es una sugerencia.
  const { recurso, limite } = CUOTA[ruta];
  const { error: errCuota } = await supabase.rpc('consumir_cuota', {
    p_recurso: recurso,
    p_limite: limite,
  });
  if (errCuota) return json({ error: 'cuota diaria agotada' }, 429);

  const peticionId = crypto.randomUUID();
  const control = AbortSignal.timeout(12_000);   // nunca cuelgues al cliente

  try {
    const r = await fetch(`${Deno.env.get('AI_SERVICE_URL')}/${ruta}`, {
      method: 'POST',
      signal: control,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('AI_SHARED_TOKEN')}`,
        'x-usuario-id': user.id,        // clave del limitador del microservicio · AUD-03
        'x-peticion-id': peticionId,    // traza extremo a extremo · AUD-19
      },
      body: JSON.stringify({ texto }),
    });

    const cuerpo = await r.text();

    // END-14 · Dos correcciones en el mismo punto.
    //
    // 1. La cuota se DEVUELVE cuando el microservicio falla. Antes se cobraba
    //    antes del fetch y no se devolvía nunca: con el túnel muerto, treinta
    //    reintentos agotaban el día sin una sola llamada al modelo.
    //
    // 2. El cuerpo ajeno NO se reenvía. Se sanitizaban con cuidado los errores
    //    propios —el comentario de `motivo` de abajo es de eso— y se dejaba
    //    pasar un traceback entero de FastAPI, con rutas del contenedor. El
    //    cuerpo real va al registro del servidor, que es donde sirve.
    if (r.status >= 500) {
      await supabase.rpc('devolver_cuota', { p_recurso: recurso });
      console.error('ai-proxy: el microservicio respondió con error', {
        peticionId,
        ruta,
        estado: r.status,
        cuerpo: cuerpo.slice(0, 500),
      });
      return json({ degradado: true, motivo: 'servicio-error' }, 503, {
        'x-peticion-id': peticionId,
      });
    }

    return new Response(cuerpo, {
      status: r.status,
      headers: { 'Content-Type': 'application/json', ...CORS, 'x-peticion-id': peticionId },
    });
  } catch (e) {
    // La cuota se cobró y no se entregó nada: se devuelve.
    await supabase.rpc('devolver_cuota', { p_recurso: recurso });
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
