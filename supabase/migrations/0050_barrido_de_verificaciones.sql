-- Programa el borrado de la INE · Verificación de vendedor.
--
-- Igual que `barrer_fotos_programado` (0025): una tarea de pg_cron llama cada hora a la Edge Function
-- `barrer-verificaciones`, que borra del bucket privado `verificacion` el frente y el reverso de la INE de las
-- verificaciones aprobadas hace 30 días. La credencial (`cron_secret`) y la URL (`barrer_verificaciones_url`) salen de
-- Vault, no de la migración: una migración vive en git.
--
-- Sin esos secretos no se inventa nada: se deja un aviso y no se llama a nadie. El verificador previo a la demo mira la
-- fecha `ine_borrar_en` vencida sin `ine_borrada_en`, así que una tarea muda acaba saliendo a la luz por el efecto y no
-- solo por el log.
--
-- Esta función NO la ejecuta nadie desde la app (invariante 9: revoke explícito a public, anon y authenticated; la
-- 0025 solo quitaba a public).
--
-- Reversión:
--   select cron.unschedule('barrer-verificaciones');
--   drop function if exists barrer_verificaciones_programado();

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function barrer_verificaciones_programado()
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
    from vault.decrypted_secrets where name = 'barrer_verificaciones_url';
  select decrypted_secret into v_secreto
    from vault.decrypted_secrets where name = 'cron_secret';

  if v_url is null or v_secreto is null then
    raise warning 'barrer_verificaciones_programado: faltan los secretos barrer_verificaciones_url / cron_secret en Vault; no se llamó a nadie';
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

revoke execute on function barrer_verificaciones_programado() from public, anon, authenticated;

comment on function barrer_verificaciones_programado() is
  'Invoca la Edge Function barrer-verificaciones. La credencial sale de Vault, no de la migracion.';

do $$
begin
  if exists (select 1 from cron.job where jobname = 'barrer-verificaciones') then
    perform cron.unschedule('barrer-verificaciones');
  end if;
  perform cron.schedule('barrer-verificaciones', '17 * * * *', 'select public.barrer_verificaciones_programado()');
end $$;
