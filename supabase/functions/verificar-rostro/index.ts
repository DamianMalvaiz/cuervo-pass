// Verificación de rostro · fase 6 (migración 0056; ai-service `/verificar-rostro`).
//
// La persona manda UNA selfie (base64). Esta función baja el frente de su INE del bucket privado `verificacion` con la llave de
// servicio, manda las dos imágenes al servicio de IA y guarda SOLO el resultado (estado y dos cifras). Ni la selfie ni la INE ni
// el vector facial se guardan en ningún sitio: viven en memoria lo que dura la petición.
//
// Es una AYUDA para el admin que revisa; no aprueba nada. A la persona se le contesta «recibida» o «repite la foto» y nada más:
// ni identidad, ni puntaje, ni la causa (serían un oráculo para afinar una suplantación).
//
// Despliegue (con verificación de JWT, que es el valor por omisión: la llama la app con la sesión de la persona):
//   supabase functions deploy verificar-rostro
// Usa los mismos secrets que `ai-proxy` (AI_SERVICE_URL, AI_SHARED_TOKEN). Mientras el ai-service tenga BIOMETRIA_ACTIVA apagada
// contesta 503 y la app sigue con la revisión manual.

import { createClient } from 'jsr:@supabase/supabase-js@2';

import { MAX_INTENTOS, respuestaParaLaPersona, rutaDeIneFrente, validarCuerpo } from './politica.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const json = (cuerpo: unknown, status: number) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

/** `btoa(String.fromCharCode(...bytes))` revienta la pila con archivos grandes: se codifica por trozos. */
function aBase64(bytes: Uint8Array): string {
  let binario = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binario);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'método no permitido' }, 405);

  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'no autorizado' }, 401);

  const requeridos = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'AI_SERVICE_URL', 'AI_SHARED_TOKEN'];
  const faltantes = requeridos.filter((n) => !Deno.env.get(n)?.trim());
  if (faltantes.length > 0) {
    console.error('verificar-rostro: faltan secrets', { faltantes });   // NOMBRES, nunca valores
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
  const cuerpo = validarCuerpo(crudo);
  if (!cuerpo.ok) return json({ error: cuerpo.codigo }, 400);

  const servicio = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // La evidencia es la de ESTA persona y ESTE rol: el id sale de la sesión, nunca del cuerpo.
  const { data: fila, error: eFila } = await servicio
    .from('verificaciones_vendedor')
    .select('usuario_id, ine_frente, ine_borrada_en')
    .eq('usuario_id', user.id)
    .eq('rol', cuerpo.rol)
    .maybeSingle();
  if (eFila) {
    console.error('verificar-rostro: no se pudo leer la verificación', eFila.message);
    return json({ error: 'no se pudo leer' }, 500);
  }
  if (!fila) return json({ error: 'sin_verificacion' }, 409);
  const ruta = rutaDeIneFrente(fila);
  if (!ruta) return json({ error: 'sin_ine' }, 409);

  // Reserva el intento ANTES de gastar cómputo; registra el consentimiento la primera vez.
  const { data: usados, error: eReserva } = await servicio.rpc('reservar_intento_biometria', {
    p_usuario: user.id,
    p_rol: cuerpo.rol,
    p_version_aviso: cuerpo.versionAviso,
  });
  if (eReserva) {
    if (eReserva.code === 'CP013') return json({ error: 'sin_intentos', intentos_restantes: 0 }, 429);
    if (eReserva.code === 'CP005') return json({ error: 'no_pendiente' }, 409);
    // La base rechazó la versión del aviso (no existe): se dice como lo que es, no como un fallo del servidor.
    if (eReserva.code === '22023') return json({ error: 'aviso_invalido' }, 400);
    console.error('verificar-rostro: no se pudo reservar el intento', eReserva.code);
    return json({ error: 'no se pudo reservar' }, 500);
  }
  const intentosUsados = typeof usados === 'number' ? usados : MAX_INTENTOS;

  // Si el fallo es del SISTEMA (no se pudo bajar la INE, el servicio de IA no respondió o contestó algo inesperado), el intento
  // reservado se devuelve: la persona no tiene la culpa. Un error al devolverlo solo se registra.
  const devolverIntento = async () => {
    const { error } = await servicio.rpc('devolver_intento_biometria', { p_usuario: user.id, p_rol: cuerpo.rol });
    if (error) console.error('verificar-rostro: no se pudo devolver el intento', error.code);
  };

  const { data: archivo, error: eIne } = await servicio.storage.from('verificacion').download(ruta);
  if (eIne || !archivo) {
    console.error('verificar-rostro: no se pudo bajar la INE', eIne?.message);
    await devolverIntento();
    return json({ degradado: true, motivo: 'sin-ine' }, 503);
  }
  const ine = aBase64(new Uint8Array(await archivo.arrayBuffer()));

  const peticionId = crypto.randomUUID();
  let resultadoIA: Record<string, unknown>;
  try {
    const r = await fetch(`${Deno.env.get('AI_SERVICE_URL')!.trim()}/verificar-rostro`, {
      method: 'POST',
      signal: AbortSignal.timeout(30_000),   // la primera llamada del día carga ~12 s de modelo
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('AI_SHARED_TOKEN')!.trim()}`,
        'x-usuario-id': user.id,
        'x-peticion-id': peticionId,
      },
      body: JSON.stringify({ selfie: cuerpo.selfie, ine }),
    });
    if (!r.ok) {
      // 503 = apagada o sin motor (estado previsto); otros códigos = el servicio no entregó. En ambos casos la app sigue con la
      // revisión manual. El cuerpo ajeno no se reenvía (puede traer rutas del contenedor).
      console.error('verificar-rostro: el servicio no entregó', { peticionId, estado: r.status });
      await devolverIntento();
      return json({ degradado: true, motivo: r.status === 503 ? 'no-disponible' : 'servicio' }, 503);
    }
    resultadoIA = await r.json();
  } catch (e) {
    console.error('verificar-rostro: no alcanzó el servicio', { peticionId, nombre: e instanceof Error ? e.name : typeof e });
    await devolverIntento();
    return json({ degradado: true, motivo: 'sin-conexion' }, 503);
  }

  const paraLaPersona = respuestaParaLaPersona(resultadoIA.estado, intentosUsados);
  // Un estado que el servicio no declara NO se interpreta: ni se guarda ni se muestra como éxito.
  if (!paraLaPersona) {
    console.error('verificar-rostro: estado desconocido del servicio', { peticionId });
    await devolverIntento();
    return json({ error: 'respuesta inesperada' }, 502);
  }

  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const { error: eRegistro } = await servicio.rpc('registrar_resultado_biometria', {
    p_usuario: user.id,
    p_rol: cuerpo.rol,
    p_estado: resultadoIA.estado,
    p_identidad: num(resultadoIA.identidad),
    p_vivo: num(resultadoIA.vivo),
    p_modelo: typeof resultadoIA.modelo === 'string' ? resultadoIA.modelo : null,
  });
  if (eRegistro) {
    console.error('verificar-rostro: no se pudo guardar el resultado', eRegistro.code);
    return json({ error: 'no se pudo guardar' }, 500);
  }

  console.log('verificar-rostro', { peticionId, estado: resultadoIA.estado });
  return json(paraLaPersona, 200);
});
