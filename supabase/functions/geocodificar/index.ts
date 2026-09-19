// Documento maestro v5 · §9 (AUD-02) y §27 (geocoding fallido).
//
// Por qué esto existe: guardar latitud y longitud en la base es uso PERMANENTE
// de geocodificación, y la capa gratuita de Mapbox solo cubre el uso temporal
// —resultados que se usan al vuelo y no se almacenan—. No es un problema de
// costo sino de licencia: se estarían guardando datos que los términos del
// producto contratado prohíben guardar.
//
// Nominatim sobre OpenStreetMap (ODbL) sí permite almacenar y derivar, a cambio
// de tres obligaciones que se cumplen aquí:
//   1. Atribución visible → «© OpenStreetMap contributors» en el detalle y el README.
//   2. Máximo una petición por segundo, con User-Agent identificable → se
//      geocodifica desde el SERVIDOR, en cola, nunca desde el cliente.
//   3. No redistribuir la base → solo se guardan coordenadas puntuales por
//      publicación, que es uso permitido.
//
// El proveedor queda anotado en la fila (`publicaciones.geocodificado_por`),
// porque el día que cambie hay que saber qué coordenadas vinieron de dónde y
// bajo qué licencia.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const PROVEEDOR = 'nominatim-osm-odbl';
const CONTACTO = Deno.env.get('NOMINATIM_CONTACTO') ?? 'cuervo-pass@ejemplo.mx';

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

const json = (cuerpo: unknown, status: number) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });

// Nominatim responde mal a direcciones mexicanas escritas informalmente: sin
// esta normalización, "Av. Juárez #12-B, Col. Centro" no encuentra nada.
function normalizar(direccion: string): string {
  return direccion
    .toLowerCase()
    .replace(/\bcp\s*\d{5}\b/g, (cp) => cp.replace(/\D/g, ''))
    .replace(/\b(col\.|colonia)\s*/g, '')
    .replace(/\b(av\.|avda\.)\s*/g, 'avenida ')
    .replace(/\b(int\.|interior)\s*\S+/g, '')
    .replace(/[#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

Deno.serve(async (req) => {
  // El preflight va ANTES de cualquier comprobación: no lleva credenciales por
  // definición, así que exigirlas aquí lo rechazaría siempre.
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'método no permitido' }, 405);

  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'no autorizado' }, 401);

  const anon = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: { user } } = await anon.auth.getUser();
  if (!user) return json({ error: 'sesión inválida' }, 401);

  let direccion: string | undefined;
  try {
    ({ direccion } = await req.json());
  } catch {
    return json({ error: 'cuerpo inválido' }, 400);
  }
  if (typeof direccion !== 'string' || direccion.length < 5 || direccion.length > 300) {
    return json({ error: 'dirección inválida' }, 400);
  }

  const consulta = normalizar(direccion);

  // Obligación 2, hecha código: dos publicaciones en la misma calle no generan
  // dos peticiones. Es la diferencia entre cien peticiones al mes y mil.
  const { data: enCache } = await anon
    .from('geocodificaciones')
    .select('latitud, longitud, proveedor')
    .eq('consulta', consulta)
    .maybeSingle();

  if (enCache) {
    return json({
      latitud: enCache.latitud,
      longitud: enCache.longitud,
      proveedor: enCache.proveedor,
      desde_cache: true,
    }, 200);
  }

  let latitud: number | null = null;
  let longitud: number | null = null;

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', consulta);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');
    url.searchParams.set('countrycodes', 'mx');

    const r = await fetch(url, {
      signal: AbortSignal.timeout(8_000),
      headers: {
        // Obligación 2: User-Agent identificable. Nominatim bloquea a quien no
        // lo manda, y con razón.
        'User-Agent': `CuervoPass/1.0 (${CONTACTO})`,
        'Accept-Language': 'es',
      },
    });
    if (r.ok) {
      const resultados = await r.json();
      if (Array.isArray(resultados) && resultados[0]) {
        latitud = Number(resultados[0].lat);
        longitud = Number(resultados[0].lon);
      }
    }
  } catch {
    // Se cae al retorno de abajo con coordenadas nulas: la publicación se guarda
    // con pendiente_geocoding = true y se reintenta. Nunca se bloquea publicar.
  }

  if (latitud === null || longitud === null) {
    return json({ latitud: null, longitud: null, proveedor: null, pendiente: true }, 200);
  }

  // El insert va con service_role porque `geocodificaciones` no tiene policy de
  // escritura para el cliente: el caché lo llena el servidor o no se llena.
  const servicio = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  await servicio
    .from('geocodificaciones')
    .upsert({ consulta, latitud, longitud, proveedor: PROVEEDOR }, { onConflict: 'consulta' });

  return json({ latitud, longitud, proveedor: PROVEEDOR, desde_cache: false }, 200);
});
