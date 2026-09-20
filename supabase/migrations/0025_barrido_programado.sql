-- Documento maestro v5 · §29 (retención) · AUD-10 · cierra la deuda de la 0021.
--
-- La 0021 fue honesta sobre lo que dejaba abierto:
--
--   «El cambio tiene un coste y conviene nombrarlo: encolar no borra. Si nadie
--    vacía esta tabla, los archivos siguen ahí. Se cambia un fallo ruidoso por
--    una deuda visible.»
--
-- No era una deuda visible. Quien vaciaba la cola era un script manual
-- (scripts/limpiar-fotos-huerfanas.mjs), así que el derecho de CANCELACIÓN que
-- promete el aviso de privacidad dependía de que alguien se acordara de correr
-- un comando. Y hasta la 0022 esos archivos seguían siendo legibles por
-- cualquier cuenta con sesión.
--
-- Encadenado: el usuario borra su publicación → la app le dice que se borró →
-- el archivo sigue en el bucket indefinidamente → y cualquiera podía leerlo.
-- Tres decisiones defendidas una por una que, compuestas, reproducían el fallo
-- que cada una decía corregir.
--
-- Aquí el barrido deja de depender de una persona.
--
-- ═══ Qué hay que hacer A MANO, una vez, y por qué no puede ir aquí ═══
--
--   supabase secrets set CRON_SECRET=$(openssl rand -hex 32)
--   supabase functions deploy barrer-fotos --no-verify-jwt
--
--   -- y en el SQL Editor, con los valores reales:
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/barrer-fotos',
--                              'barrer_fotos_url', 'destino del barrido de fotos');
--   select vault.create_secret('<el mismo CRON_SECRET>',
--                              'cron_secret', 'credencial del barrido programado');
--
-- Los secretos NO van en la migración: una migración vive en git. Se leen de
-- Vault en tiempo de ejecución. Si faltan, la tarea programada no llama a nadie
-- y deja un WARNING — no falla en silencio, pero tampoco revienta la base.
--
-- Reversión:
--   select cron.unschedule('barrer-fotos');
--   drop function if exists barrer_fotos_programado();

-- ============================================================
-- 1. Extensiones
-- ============================================================
-- pg_net ya viene instalada en Supabase. pg_cron se habilita con esto tanto en
-- local como en la nube; si el proyecto la tuviera bloqueada, la migración
-- falla aquí y de forma ruidosa, que es lo correcto: una tarea programada que
-- se cree programada y no lo esté es peor que no tenerla.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ============================================================
-- 2. Lo que la tarea ejecuta
-- ============================================================
create or replace function barrer_fotos_programado()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url     text;
  v_secreto text;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'barrer_fotos_url';
  select decrypted_secret into v_secreto
    from vault.decrypted_secrets where name = 'cron_secret';

  -- Sin configuración no se inventa nada, y se deja constancia. El verificador
  -- previo a la demo mira la cola, así que una tarea muda acaba saliendo a la
  -- luz por el lado del efecto y no solo por el del log.
  if v_url is null or v_secreto is null then
    raise warning 'barrer_fotos_programado: faltan los secretos barrer_fotos_url / cron_secret en Vault; no se llamó a nadie';
    return;
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                 'Authorization', 'Bearer ' || v_secreto,
                 'Content-Type',  'application/json'),
    body    := '{}'::jsonb
  );
end;
$$;

-- No la llama ningún cliente: la llama el planificador, que corre como
-- superusuario. Se cierra igual que las demás.
revoke execute on function barrer_fotos_programado() from public;

comment on function barrer_fotos_programado() is
  'Invoca la Edge Function barrer-fotos. La credencial sale de Vault, no de la '
  'migracion: una migracion vive en git.';

-- ============================================================
-- 3. La programación
-- ============================================================
-- Al minuto 7 y no al 0: las horas en punto es cuando todo el mundo programa
-- sus tareas y es cuando la plataforma va más cargada.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'barrer-fotos') then
    perform cron.unschedule('barrer-fotos');
  end if;
  perform cron.schedule('barrer-fotos', '7 * * * *', 'select public.barrer_fotos_programado()');
end $$;
