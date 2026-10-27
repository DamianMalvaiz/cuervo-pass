// Edge Function `fotos-publicas`: las fotos para quien explora SIN cuenta (la web, tramo 1).
//
// POST { tipo: 'publicacion' | 'negocio' | 'producto', id } → { fotos: string[] } (URL firmadas por 1 hora).
// Las rutas se leen de las vistas de lo visible (0090 y anteriores): lo oculto o inactivo no existe para esta función. Se necesita la llave pública (JWT por defecto), no una sesión.
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { armarRespuesta, fuenteDe, separarFotos, validarSolicitudFotos } from './politica.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const VIGENCIA_SEGUNDOS = 60 * 60;

function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'método no permitido' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const llave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !llave) return json({ error: 'servidor mal configurado' }, 500);

  let crudo: unknown;
  try {
    crudo = await req.json();
  } catch {
    return json({ error: 'cuerpo inválido' }, 400);
  }
  const solicitud = validarSolicitudFotos(crudo);
  if (!solicitud.ok) return json({ error: solicitud.error }, 400);

  const admin = createClient(url, llave, { auth: { persistSession: false } });
  const { vista, columna } = fuenteDe(solicitud.tipo);
  const { data, error } = await admin.from(vista).select(columna).eq('id', solicitud.id).maybeSingle();
  if (error) return json({ error: 'no se pudo leer' }, 500);
  if (!data) return json({ fotos: [] });

  const entradas = separarFotos((data as unknown as Record<string, unknown>)[columna]);
  const rutas = entradas.flatMap((e) => (e.tipo === 'ruta' ? [e.ruta] : []));
  const firmadas = new Map<string, string>();
  if (rutas.length > 0) {
    const { data: filas, error: errFirma } = await admin.storage.from('fotos').createSignedUrls(rutas, VIGENCIA_SEGUNDOS);
    if (errFirma) return json({ error: 'no se pudieron firmar' }, 500);
    for (const f of filas ?? []) if (f.path && f.signedUrl) firmadas.set(f.path, f.signedUrl);
  }
  return json({ fotos: armarRespuesta(entradas, firmadas) });
});
