-- Cuentas de vendedor sin correo universitario · 24/10/2026.
--
-- ── El hueco ────────────────────────────────────────────────────────────────
-- El filtro «solo correos .edu.mx» vivía ÚNICAMENTE en la app (`correoUniversitario.ts`, un refine del formulario). La llave anónima de
-- Supabase va dentro del APK: cualquiera podía dar de alta un Gmail llamando a Auth directamente. Lo que los comentarios llamaban «encarece las
-- cuentas desechables» solo era cierto para quien usa la app, no para quien ataca.
--
-- ── La decisión ─────────────────────────────────────────────────────────────
-- Arrendadores y comerciantes necesitan entrar con el correo que tengan. Abrir el registro a cualquier correo vuelve a abaratar el brigading
-- (tres reportes ocultan una publicación), así que se separa QUIÉN entra de QUÉ puede hacer:
--
--   · `hook_alta_de_usuario` (hook `before_user_created` de Auth): un correo universitario entra; uno que no lo es solo entra si la solicitud
--     se declara `arrendador` o `comerciante`. Esa declaración la manda el cliente y cualquiera puede mandarla: NO es lo que protege. Se
--     activa en el panel de Supabase (Authentication → Hooks) y en config.toml; sin activarlo, el filtro sigue solo en la app.
--   · `usuarios.cuenta_restringida`: la fija el trigger de alta (verdadera cuando el correo no es universitario) y la dueña no la toca.
--     Una cuenta restringida NO puede reportar, reseñar ni abrir conversaciones nuevas; SÍ responde en las que ya existen (un arrendador
--     tiene que contestar a quien lo busca). Es lo que de verdad frena a las cuentas desechables, haya o no hook.
--
-- Las cuentas creadas con la clave de servicio pueden llevar `app_metadata.sin_restriccion = true` (scripts de demo y de verificación); la
-- marca de `user_metadata` NO sirve, porque esa la manda el cliente.
--
-- Las cuentas que ya existen quedan sin restricción (el valor por omisión es falso): no se le quita nada a nadie hoy.
--
-- ── Lo que NO resuelve ──────────────────────────────────────────────────────
-- Una cuenta restringida puede escribir en las conversaciones que otra persona abrió, y un correo `.edu.mx` real puede actuar de mala fe igual
-- (docs/modelo-amenazas.md). Los favoritos y las publicaciones no se tocan: publicar sigue exigiendo rol aprobado (0051).
--
-- Código propio: CP016 (cuenta restringida).
--
-- Reversión:
--   drop trigger if exists trg_proteger_cuenta_restringida on usuarios;
--   drop function if exists proteger_cuenta_restringida();
--   -- volver a crear handle_new_user (0075), abrir_conversacion (0012), reportar_resena (0054) y las policies reportes_insert (0038),
--   -- resenas_insert (0054) y conversaciones_crear (0014) con sus cuerpos originales;
--   drop trigger if exists trg_levantar_restriccion_de_servicio on auth.users;
--   drop function if exists levantar_restriccion_de_servicio();
--   drop function if exists hook_alta_de_usuario(jsonb);
--   drop function if exists es_correo_universitario(text);
--   alter table usuarios drop column if exists cuenta_restringida;

-- ── 1 · la regla del dominio, en la base ────────────────────────────────────
-- Igual que `correoUniversitario.ts`: el dominio tras la ÚLTIMA arroba debe terminar en `.edu.mx`. Un `edu.mx` en medio no cuenta.
create or replace function es_correo_universitario(p_correo text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(
    substring(lower(btrim(p_correo)) from '@([^@[:space:]]+)$') ~ '^[a-z0-9-]+(\.[a-z0-9-]+)*\.edu\.mx$',
    false
  );
$$;
-- La usan el trigger de alta y el hook; el cliente no tiene por qué llamarla.
revoke execute on function es_correo_universitario(text) from public, anon, authenticated;
grant execute on function es_correo_universitario(text) to supabase_auth_admin;

-- ── 2 · el hook de Auth ─────────────────────────────────────────────────────
-- Falla CERRADO: sin correo o con un correo que no es universitario y sin declararse vendedor, rechaza.
create or replace function hook_alta_de_usuario(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_correo text := event->'user'->>'email';
  v_tipo   text := event->'user'->'user_metadata'->>'tipo_cuenta';
begin
  if es_correo_universitario(v_correo) or v_tipo in ('arrendador', 'comerciante') then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 400,
    'message', 'Usa el correo de tu universidad (termina en .edu.mx). Si eres arrendador o tienes un negocio, regístrate como vendedor.'
  ));
end;
$$;
revoke execute on function hook_alta_de_usuario(jsonb) from public, anon, authenticated;
grant execute on function hook_alta_de_usuario(jsonb) to supabase_auth_admin;

-- ── 3 · la marca ────────────────────────────────────────────────────────────
alter table usuarios add column if not exists cuenta_restringida boolean not null default false;

-- Cuerpo de la 0075 más la marca.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acepto boolean := new.raw_user_meta_data->>'acepto_aviso' = 'true';
  v_version text := nullif(btrim(new.raw_user_meta_data->>'aviso_version'), '');
begin
  insert into usuarios (id, nombre_usuario, nombre_completo, acepto_aviso_privacidad_en, version_aviso_aceptada, correo_verificado, cuenta_restringida)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'nombre_usuario', ''),
      'usuario_' || substr(new.id::text, 1, 8)
    ),
    coalesce(new.raw_user_meta_data->>'nombre_completo', ''),
    case when v_acepto then now() end,
    case when v_acepto and v_version ~ '^v[0-9]{1,3}$' and aviso_version_valida(v_version) then v_version end,
    new.email_confirmed_at is not null,
    -- `raw_app_meta_data` solo la escribe la API de administración (clave de servicio): el cliente no puede mandar esa marca. Es lo que usan
    -- los scripts que crean cuentas de demo o de verificación con correos que no son universitarios.
    not (es_correo_universitario(new.email) or coalesce(new.raw_app_meta_data->>'sin_restriccion', '') = 'true')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- La dueña de la fila no la cambia (una policy limita FILAS, no COLUMNAS): mismo idioma que `proteger_correo_verificado` (0067).
create or replace function proteger_cuenta_restringida()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('role', true) = 'authenticated' and new.cuenta_restringida is distinct from old.cuenta_restringida then
    raise exception 'cuenta_restringida no se modifica desde la aplicacion' using errcode = 'CP016';
  end if;
  return new;
end;
$$;
revoke execute on function proteger_cuenta_restringida() from public, anon, authenticated;

drop trigger if exists trg_proteger_cuenta_restringida on usuarios;
create trigger trg_proteger_cuenta_restringida
  before update on usuarios
  for each row execute function proteger_cuenta_restringida();

-- Auth escribe `app_metadata` en un UPDATE posterior al INSERT (medido en el Auth local: `updated_at` 15 ms después), así que al alta el trigger
-- todavía no ve la marca. Este trigger la recoge cuando llega. Solo LEVANTA la restricción y solo con la marca de servicio; el cliente no puede
-- escribir `raw_app_meta_data`.
create or replace function levantar_restriccion_de_servicio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.raw_app_meta_data->>'sin_restriccion', '') = 'true'
     and coalesce(old.raw_app_meta_data->>'sin_restriccion', '') is distinct from 'true' then
    update usuarios set cuenta_restringida = false where id = new.id and cuenta_restringida;
  end if;
  return new;
end;
$$;
revoke execute on function levantar_restriccion_de_servicio() from public, anon, authenticated;

drop trigger if exists trg_levantar_restriccion_de_servicio on auth.users;
create trigger trg_levantar_restriccion_de_servicio
  after update of raw_app_meta_data on auth.users
  for each row execute function levantar_restriccion_de_servicio();

-- ── 4 · lo que una cuenta restringida no puede ──────────────────────────────
alter policy reportes_insert on reportes
  with check (
    (select auth.uid()) = reportado_por
    and not exists (select 1 from usuarios u where u.id = (select auth.uid()) and u.cuenta_restringida)
  );

alter policy resenas_insert on resenas
  with check (
    usuario_id = (select auth.uid())
    and not exists (select 1 from usuarios u where u.id = (select auth.uid()) and u.cuenta_restringida)
    and (
      (negocio_id is not null
        and exists (select 1 from negocios_publicos np where np.id = negocio_id)
        and not exists (select 1 from negocios n where n.id = negocio_id and n.usuario_id = (select auth.uid())))
      or
      (publicacion_id is not null
        and exists (select 1 from publicaciones_publicas pp where pp.id = publicacion_id)
        and not exists (select 1 from publicaciones p where p.id = publicacion_id and p.usuario_id = (select auth.uid())))
    )
  );

alter policy conversaciones_crear on conversaciones
  with check (
    (select auth.uid()) in (usuario_a, usuario_b)
    and not exists (select 1 from usuarios u where u.id = (select auth.uid()) and u.cuenta_restringida)
  );

-- Cuerpo de la 0054 con la comprobación AL PRINCIPIO: una cuenta restringida recibe CP016 y no un error que insinúe qué reseñas existen.
create or replace function reportar_resena(p_resena uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'sin sesion' using errcode = '28000';
  end if;
  if exists (select 1 from usuarios where id = v_uid and cuenta_restringida) then
    raise exception 'cuenta restringida' using errcode = 'CP016';
  end if;
  if p_motivo is null or char_length(btrim(p_motivo)) < 1 or char_length(p_motivo) > 300 then
    raise exception 'motivo invalido' using errcode = '23514';
  end if;

  if not exists (select 1 from resenas_publicas rp where rp.id = p_resena and not rp.es_mia) then
    raise exception 'no puedes reportar esta resena' using errcode = '42501';
  end if;

  insert into resenas_reportes (resena_id, reportado_por, motivo)
  values (p_resena, v_uid, btrim(p_motivo))
  on conflict (resena_id, reportado_por) do nothing;

  update resenas set oculta_por_reportes = true
   where id = p_resena and (select count(*) from resenas_reportes where resena_id = p_resena) >= 3;
end;
$$;
revoke execute on function reportar_resena(uuid, text) from public, anon, authenticated;
grant execute on function reportar_resena(uuid, text) to authenticated;

-- Cuerpo de la 0012: una cuenta restringida solo RECUPERA una conversación que ya existe; no abre una nueva.
create or replace function abrir_conversacion(p_otro uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_a uuid; v_b uuid; v_id uuid;
begin
  if auth.uid() is null or p_otro is null or p_otro = auth.uid() then
    raise exception 'destinatario inválido';
  end if;

  if not exists (select 1 from usuarios where id = p_otro and activo) then
    raise exception 'usuario no disponible';
  end if;

  v_a := least(auth.uid(), p_otro);
  v_b := greatest(auth.uid(), p_otro);

  if exists (select 1 from usuarios where id = auth.uid() and cuenta_restringida) then
    select id into v_id from conversaciones where usuario_a = v_a and usuario_b = v_b;
    if v_id is null then
      raise exception 'cuenta restringida' using errcode = 'CP016';
    end if;
    return v_id;
  end if;

  insert into conversaciones (usuario_a, usuario_b)
  values (v_a, v_b)
  on conflict (usuario_a, usuario_b) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from conversaciones
     where usuario_a = v_a and usuario_b = v_b;
  end if;

  return v_id;
end;
$$;
revoke execute on function abrir_conversacion(uuid) from public, anon;
grant execute on function abrir_conversacion(uuid) to authenticated;
