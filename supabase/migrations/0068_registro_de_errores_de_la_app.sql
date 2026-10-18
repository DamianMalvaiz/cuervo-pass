-- Registro de errores de la app, con una vista en el panel de admin. Plan de excelencia 0.2 (barra B2: «todo fallo se ve»).
--
-- ── El hueco ────────────────────────────────────────────────────────────────
-- `lib/registro.ts` centraliza los avisos y errores de la app (22 archivos lo usan), pero los manda a la consola del teléfono, que en una APK de
-- producción nadie lee. Todo lo que la app sabe de sus propios fallos se perdía donde más importa. La fachada ya prevé un «sumidero» enchufable.
--
-- ── Qué hace ────────────────────────────────────────────────────────────────
-- Un sumidero envía cada error (con límite) a `registrar_error_app`, que lo AGRUPA por huella en `errores_app` (mensaje normalizado + versión +
-- plataforma): una fila por problema distinto con su conteo, primera y última vez. Así la tabla crece con los problemas distintos, no con las repeticiones,
-- y el panel de admin enseña «qué se rompe y cuánto» en vez de un chorro de líneas. Se borra lo que no se repite en 30 días.
--
-- ── Privacidad (minimización) ───────────────────────────────────────────────
-- NO se guarda quién: ni id de cuenta, ni correo, ni dispositivo, ni IP. Solo mensaje, detalle técnico, versión de la app y plataforma. Antes de guardar,
-- el servidor vuelve a limpiar el texto (correos, tokens JWT, «Bearer …», números de 10 dígitos) aunque el cliente ya lo haga: el cliente no es de fiar.
--
-- ── Contra el abuso ─────────────────────────────────────────────────────────
-- Solo cuentas con sesión (un anónimo no se puede contar), 40 registros por cuenta y día (la cuota de siempre, `consumir_cuota`) y un tope de
-- 2000 problemas distintos en la tabla: pasado el tope, lo ya conocido sigue contando pero no se crean grupos nuevos.
--
-- Reversión:
--   select cron.unschedule('limpiar-errores-app');
--   drop function if exists admin_borrar_error(uuid, uuid), admin_listar_errores(uuid), registrar_error_app(text, text, text, text, text),
--     limpiar_errores_app(), limpiar_texto_error(text);
--   drop table if exists errores_app;
--   -- y quitar 'error_app' de `cuotas_uso_recurso_check` (0035).
--   -- y volver a dejar `acciones_admin.accion` sin 'borrar_error'.

create table if not exists errores_app (
  id          uuid primary key default gen_random_uuid(),
  huella      text not null,
  nivel       text not null check (nivel in ('aviso', 'error')),
  mensaje     text not null check (char_length(mensaje) between 1 and 300),
  detalle     text check (char_length(detalle) <= 500),
  version_app text not null check (char_length(version_app) between 1 and 20),
  plataforma  text not null check (plataforma in ('android', 'ios', 'web', 'otro')),
  conteo      integer not null default 1 check (conteo >= 1),
  primera_vez timestamptz not null default now(),
  ultima_vez  timestamptz not null default now(),
  unique (huella, version_app, plataforma)
);
create index if not exists errores_app_ultima_idx on errores_app (ultima_vez desc);

alter table errores_app enable row level security;
revoke all on errores_app from public, anon, authenticated;
grant select on errores_app to service_role;

-- La cuota usa su propio nombre de recurso, y `cuotas_uso.recurso` solo admite los conocidos (0035): se añade el nuevo.
alter table cuotas_uso drop constraint if exists cuotas_uso_recurso_check;
alter table cuotas_uso add constraint cuotas_uso_recurso_check
  check (recurso in ('revelar_contacto', 'parseo_llm', 'embedding', 'geocodificacion', 'error_app'));

-- Quita de un texto lo que no debe guardarse. Interna: no la ejecuta ningún cliente.
create or replace function limpiar_texto_error(t text)
returns text
language sql
immutable
set search_path = public
as $$
  select regexp_replace(
           regexp_replace(
             regexp_replace(
               regexp_replace(coalesce(t, ''), '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[correo]', 'g'),
               'eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}', '[token]', 'g'),
             'Bearer\s+[A-Za-z0-9._~+/=-]+', 'Bearer [token]', 'gi'),
           '\y[0-9]{10}\y', '[tel]', 'g');
$$;
revoke execute on function limpiar_texto_error(text) from public, anon, authenticated;

create or replace function registrar_error_app(p_nivel text, p_mensaje text, p_detalle text, p_version text, p_plataforma text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nivel   text := case when p_nivel in ('aviso', 'error') then p_nivel else 'error' end;
  v_mensaje text := left(limpiar_texto_error(p_mensaje), 300);
  v_detalle text := nullif(left(limpiar_texto_error(p_detalle), 500), '');
  v_version text := left(coalesce(nullif(btrim(p_version), ''), '?'), 20);
  v_plat    text := case when p_plataforma in ('android', 'ios', 'web') then p_plataforma else 'otro' end;
  v_huella  text;
begin
  if auth.uid() is null then
    raise exception 'sin sesion' using errcode = '28000';
  end if;
  if btrim(v_mensaje) = '' then
    return;
  end if;

  -- Pasada la cuota diaria no se registra nada MÁS y tampoco se le avisa a la app (registrar un error no puede producir otro).
  begin
    perform consumir_cuota('error_app', 40);
  exception when others then
    return;
  end;

  -- La huella agrupa el mismo problema aunque cambien números e identificadores del mensaje.
  v_huella := md5(v_nivel || '|' || left(btrim(regexp_replace(regexp_replace(lower(v_mensaje),
                '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '<id>', 'g'), '[0-9]+', '#', 'g')), 200));

  update errores_app
     set conteo = conteo + 1, ultima_vez = now(), detalle = coalesce(v_detalle, detalle)
   where huella = v_huella and version_app = v_version and plataforma = v_plat;
  if found then
    return;
  end if;

  if (select count(*) from errores_app) >= 2000 then
    return;
  end if;

  insert into errores_app (huella, nivel, mensaje, detalle, version_app, plataforma)
  values (v_huella, v_nivel, v_mensaje, v_detalle, v_version, v_plat)
  on conflict (huella, version_app, plataforma)
    do update set conteo = errores_app.conteo + 1, ultima_vez = now();
end;
$$;
revoke execute on function registrar_error_app(text, text, text, text, text) from public, anon, authenticated;
grant execute on function registrar_error_app(text, text, text, text, text) to authenticated;

create or replace function limpiar_errores_app()
returns void language sql security definer set search_path = public as $$
  delete from errores_app where ultima_vez < now() - interval '30 days';
$$;
revoke execute on function limpiar_errores_app() from public, anon, authenticated;
grant execute on function limpiar_errores_app() to service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'limpiar-errores-app') then
    perform cron.unschedule('limpiar-errores-app');
  end if;
  perform cron.schedule('limpiar-errores-app', '43 3 * * *', 'select public.limpiar_errores_app()');
end $$;

-- ── Panel de admin ──────────────────────────────────────────────────────────
alter table acciones_admin drop constraint if exists acciones_admin_accion_check;
alter table acciones_admin add constraint acciones_admin_accion_check
  check (accion in ('ocultar_resena', 'restaurar_resena', 'ocultar_negocio', 'restaurar_negocio', 'modo_demo', 'ver_documentos', 'borrar_error'));

create or replace function admin_listar_errores(p_admin uuid)
returns table (id uuid, nivel text, mensaje text, detalle text, version_app text, plataforma text, conteo integer, primera_vez timestamptz, ultima_vez timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not es_admin_aprobado(p_admin) then
    raise exception 'responsable no es admin' using errcode = 'CP007';
  end if;
  return query
    select e.id, e.nivel, e.mensaje, e.detalle, e.version_app, e.plataforma, e.conteo, e.primera_vez, e.ultima_vez
      from errores_app e
     where e.ultima_vez > now() - interval '7 days'
     order by (e.nivel = 'error') desc, e.ultima_vez desc
     limit 100;
end;
$$;
revoke execute on function admin_listar_errores(uuid) from public, anon, authenticated;
grant execute on function admin_listar_errores(uuid) to service_role;

-- «Ya lo vi / ya está arreglado»: borra el grupo (si vuelve a pasar, nace uno nuevo). Queda en la bitácora.
create or replace function admin_borrar_error(p_admin uuid, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not es_admin_aprobado(p_admin) then
    raise exception 'responsable no es admin' using errcode = 'CP007';
  end if;
  delete from errores_app where id = p_id;
  if not found then
    raise exception 'no existe' using errcode = 'P0002';
  end if;
  insert into acciones_admin (admin_id, accion, objetivo_id) values (p_admin, 'borrar_error', p_id);
end;
$$;
revoke execute on function admin_borrar_error(uuid, uuid) from public, anon, authenticated;
grant execute on function admin_borrar_error(uuid, uuid) to service_role;
