-- Versión del aviso de privacidad que aceptó cada cuenta, y la forma de aceptar una nueva.
--
-- ── Por qué ─────────────────────────────────────────────────────────────────
-- Hasta aquí solo se guardaba CUÁNDO se aceptó el aviso (`acepto_aviso_privacidad_en`), no CUÁL. Con la versión 3 (que ya habla de la INE,
-- de los planes y de las reseñas) hace falta poder decir «esta cuenta aceptó la v3» y pedirla a quien aceptó otra. El propio aviso lo promete
-- en su sección 10.
--
-- Las cuentas existentes quedan con `null`: la base NO sabe qué versión vieron (se aceptó antes de que se registrara la versión), así que
-- no se inventa una. `null` significa «hay que aceptar la vigente».
--
-- ── Qué es y qué no es ──────────────────────────────────────────────────────
-- Es el REGISTRO del consentimiento, no una barrera de seguridad: quien llama a la API con su propia sesión puede escribir la versión que
-- quiera sobre SU fila. La pantalla es la que exige aceptar la vigente (`src/app/index.tsx`); aquí se guarda la evidencia con la hora del servidor.
--
-- Reversión:
--   drop function if exists aceptar_aviso(text);
--   alter table usuarios drop column if exists version_aviso_aceptada;
--   -- y volver a crear handle_new_user con el cuerpo de la 0046.

alter table usuarios
  add column if not exists version_aviso_aceptada text check (char_length(version_aviso_aceptada) between 1 and 20);

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
  insert into usuarios (id, nombre_usuario, nombre_completo, acepto_aviso_privacidad_en, version_aviso_aceptada)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'nombre_usuario', ''),
      'usuario_' || substr(new.id::text, 1, 8)
    ),
    coalesce(new.raw_user_meta_data->>'nombre_completo', ''),
    case when v_acepto then now() end,
    -- Una versión sin aceptación no cuenta, y una con formato raro tampoco: nunca se tumba el alta por esto.
    case when v_acepto and v_version ~ '^v[0-9]{1,3}$' then v_version end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function aceptar_aviso(p_version text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_version text := btrim(coalesce(p_version, ''));
begin
  if v_uid is null then
    raise exception 'sin sesion' using errcode = '28000';
  end if;
  if v_version !~ '^v[0-9]{1,3}$' then
    raise exception 'version de aviso invalida' using errcode = '22023';
  end if;

  update usuarios
     set acepto_aviso_privacidad_en = now(), version_aviso_aceptada = v_version
   where id = v_uid;
  if not found then
    raise exception 'sin perfil' using errcode = 'CP005';
  end if;
end;
$$;

revoke execute on function aceptar_aviso(text) from public, anon, authenticated;
grant execute on function aceptar_aviso(text) to authenticated;
