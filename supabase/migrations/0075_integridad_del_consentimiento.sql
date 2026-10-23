-- Integridad del consentimiento · hallazgo 1 de la auditoría del 23/10/2026.
--
-- ── El hueco ────────────────────────────────────────────────────────────────
-- La versión del aviso que «se aceptó» y la hora en que se aceptó las podía escribir el CLIENTE:
--   · `usuarios` es escribible por su dueña (una policy limita FILAS, no COLUMNAS), así que un `update` directo guardaba cualquier cadena de
--     1 a 20 caracteres y cualquier fecha. Comprobado contra un Postgres local: `version_aviso_aceptada = 'zzz'` y
--     `acepto_aviso_privacidad_en = '1999-01-01'` quedaban escritas. La 0046 decía que la hora la pone el servidor; ese camino la esquivaba.
--   · el alta y `aceptar_aviso` validaban el FORMATO (`v<n>`), no que la versión EXISTA: 'v99' pasaba.
--   · el camino biométrico (`reservar_intento_biometria`) solo exigía una cadena no vacía: 'zzz' contaba como consentimiento a un dato sensible.
--
-- ── Lo que hace ─────────────────────────────────────────────────────────────
-- 1 · `avisos_privacidad`: las versiones PUBLICADAS del aviso. Una versión nueva se añade con una migración, en el mismo commit que la publica.
-- 2 · `aviso_version_valida(text)`: ¿existe esa versión? (no ejecutable por el cliente).
-- 3 · `handle_new_user` (cuerpo de la 0067): la versión del alta solo se guarda si existe. Sin versión válida la aceptación queda sin versión y
--     la app le pide aceptar la vigente (`app/index.tsx` compara contra VERSION_AVISO): se cura sola, y el alta nunca se tumba por esto.
-- 4 · `aceptar_aviso`: valida contra la tabla y lleva la marca `app.aviso` (local a la transacción) para que el guardián de abajo la deje pasar.
-- 5 · `proteger_consentimiento` (trigger en `usuarios`): la dueña de la fila NO escribe ni la versión ni la hora con un `update` directo. Mismo
--     idioma que `proteger_suspension` (0023) y `proteger_correo_verificado` (0067).
-- 6 · `reservar_intento_biometria` (cuerpo de la 0056): la versión tiene que existir. Una versión inexistente → 22023, igual que una vacía.
--
-- ── Lo que NO resuelve ──────────────────────────────────────────────────────
-- El servidor nunca puede demostrar que la persona VIO el texto: eso lo afirma el cliente («acepto»). Esto asegura que la etiqueta de versión sea
-- una versión real y que la hora la ponga la base. Las cuentas anteriores (106 en null y una en 'v3' al 23/10/2026) no se tocan.
--
-- Código propio: CP014 (consentimiento escrito fuera de `aceptar_aviso`).
--
-- Reversión:
--   drop trigger if exists trg_proteger_consentimiento on usuarios;
--   drop function if exists proteger_consentimiento();
--   -- y volver a crear handle_new_user (0067), aceptar_aviso (0059) y reservar_intento_biometria (0056) con sus cuerpos originales;
--   drop function if exists aviso_version_valida(text);
--   drop table if exists avisos_privacidad;

-- ── 1 · Versiones publicadas ────────────────────────────────────────────────
create table if not exists avisos_privacidad (
  version text primary key check (version ~ '^v[0-9]{1,3}$')
);

insert into avisos_privacidad (version) values ('v2'), ('v3') on conflict (version) do nothing;

alter table avisos_privacidad enable row level security;
revoke all on avisos_privacidad from public, anon, authenticated;
grant select on avisos_privacidad to service_role;

-- ── 2 · ¿Existe esa versión? ────────────────────────────────────────────────
create or replace function aviso_version_valida(p_version text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from avisos_privacidad where version = btrim(coalesce(p_version, '')));
$$;
revoke execute on function aviso_version_valida(text) from public, anon, authenticated;

-- ── 3 · El alta solo guarda una versión que existe ──────────────────────────
-- Cuerpo de la 0067 (con `correo_verificado`) más la comprobación.
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
  insert into usuarios (id, nombre_usuario, nombre_completo, acepto_aviso_privacidad_en, version_aviso_aceptada, correo_verificado)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'nombre_usuario', ''),
      'usuario_' || substr(new.id::text, 1, 8)
    ),
    coalesce(new.raw_user_meta_data->>'nombre_completo', ''),
    case when v_acepto then now() end,
    -- Una versión sin aceptación no cuenta, y una que no existe tampoco: nunca se tumba el alta por esto.
    case when v_acepto and v_version ~ '^v[0-9]{1,3}$' and aviso_version_valida(v_version) then v_version end,
    new.email_confirmed_at is not null
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ── 4 · aceptar_aviso valida contra la tabla ────────────────────────────────
create or replace function aceptar_aviso(p_version text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_version text := btrim(coalesce(p_version, ''));
  v_filas integer;
begin
  if v_uid is null then
    raise exception 'sin sesion' using errcode = '28000';
  end if;
  if v_version !~ '^v[0-9]{1,3}$' or not aviso_version_valida(v_version) then
    raise exception 'version de aviso invalida' using errcode = '22023';
  end if;

  -- La marca deja pasar ESTA escritura por `proteger_consentimiento`. Es local a la transacción: no sobrevive al commit ni puede fijarla el
  -- cliente (PostgREST no expone set_config, y un RPC que lo hiciera tendría que existir en el esquema).
  perform set_config('app.aviso', 'on', true);
  update usuarios
     set acepto_aviso_privacidad_en = now(), version_aviso_aceptada = v_version
   where id = v_uid;
  -- Antes del `perform`: `PERFORM` también modifica FOUND, y el `if` de abajo leería el de `set_config` (siempre una fila).
  get diagnostics v_filas = row_count;
  -- Se apaga EN CUANTO se escribe: la marca vale para esta escritura y nada más, ni siquiera para el resto de la misma transacción.
  perform set_config('app.aviso', 'off', true);
  if v_filas = 0 then
    raise exception 'sin perfil' using errcode = 'CP005';
  end if;
end;
$$;

revoke execute on function aceptar_aviso(text) from public, anon, authenticated;
grant execute on function aceptar_aviso(text) to authenticated;

-- ── 5 · La dueña de la fila no escribe el consentimiento ────────────────────
create or replace function proteger_consentimiento()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('app.aviso', true), 'off') = 'on' then
    return new;
  end if;

  if current_setting('role', true) = 'authenticated'
     and (new.acepto_aviso_privacidad_en is distinct from old.acepto_aviso_privacidad_en
          or new.version_aviso_aceptada is distinct from old.version_aviso_aceptada) then
    raise exception 'el consentimiento se registra solo con aceptar_aviso' using errcode = 'CP014';
  end if;
  return new;
end;
$$;

revoke execute on function proteger_consentimiento() from public, anon, authenticated;

drop trigger if exists trg_proteger_consentimiento on usuarios;
create trigger trg_proteger_consentimiento
  before update on usuarios
  for each row execute function proteger_consentimiento();

-- ── 6 · El consentimiento biométrico exige una versión que exista ───────────
-- Cuerpo de la 0056 más la comprobación. La Edge Function manda la versión que le da el cliente: aquí se decide si cuenta.
create or replace function reservar_intento_biometria(p_usuario uuid, p_rol text, p_version_aviso text)
returns smallint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado text;
  v_intentos smallint;
begin
  if p_version_aviso is null or btrim(p_version_aviso) = '' or not aviso_version_valida(p_version_aviso) then
    raise exception 'sin consentimiento biometrico' using errcode = '22023';
  end if;

  select estado into v_estado from roles_usuario where usuario_id = p_usuario and rol = p_rol;
  if v_estado is distinct from 'pendiente' then
    raise exception 'verificacion no pendiente' using errcode = 'CP005';
  end if;

  insert into verificaciones_biometria (usuario_id, rol, consentimiento_en, version_aviso)
  values (p_usuario, p_rol, now(), btrim(p_version_aviso))
  on conflict (usuario_id, rol) do nothing;

  update verificaciones_biometria
     set intentos = intentos + 1
   where usuario_id = p_usuario and rol = p_rol and intentos < 5
  returning intentos into v_intentos;

  if v_intentos is null then
    raise exception 'intentos de biometria agotados' using errcode = 'CP013';
  end if;
  return v_intentos;
end;
$$;

revoke execute on function reservar_intento_biometria(uuid, text, text) from public, anon, authenticated;
grant execute on function reservar_intento_biometria(uuid, text, text) to service_role;
