// Documento maestro v5 · §29 — derecho de CANCELACIÓN (ARCO).
//
// Prometerlo en el aviso de privacidad y no implementarlo es peor que no
// prometerlo. Borrar la cuenta de Supabase Auth dispara el `on delete cascade`
// de todo el esquema, y con él el trigger trg_limpiar_fotos (migración 0015),
// que es lo que hace que las fotos desaparezcan de verdad y no solo la fila.
//
// Requiere service_role, así que vive aquí y no en la app.
//   supabase functions deploy eliminar-cuenta

import { createClient } from 'jsr:@supabase/supabase-js@2';

const json = (cuerpo: unknown, status: number) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'método no permitido' }, 405);

  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'no autorizado' }, 401);

  // La identidad la determina el token del usuario, NUNCA un id en el cuerpo:
  // si la función aceptara `{ usuario_id }`, cualquiera borraría la cuenta de
  // cualquiera con una sola petición.
  const anon = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: { user } } = await anon.auth.getUser();
  if (!user) return json({ error: 'sesión inválida' }, 401);

  const servicio = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // La foto de perfil no vive en `publicaciones.fotos`, así que el trigger de
  // limpieza no la alcanza: se borra aquí, explícitamente.
  await servicio.storage.from('fotos').remove([`perfiles/${user.id}.jpg`]);

  const { error } = await servicio.auth.admin.deleteUser(user.id);
  if (error) return json({ error: error.message }, 500);

  return json({ eliminada: true }, 200);
});
