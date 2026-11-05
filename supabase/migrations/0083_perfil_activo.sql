-- Perfil activo: estudiante o vendedor · 24/10/2026.
--
-- ── Para qué ────────────────────────────────────────────────────────────────
-- Un negocio no tiene por qué ver «Depas» y «Roomies» al abrir la app, ni un estudiante el panel de un vendedor. La barra de pestañas y la primera
-- vista dependen de qué perfil está usando la persona. Una misma cuenta puede tener los dos (un estudiante que también rentaría un cuarto), y
-- cambia entre ellos; el cambio no toca sus funciones ni su verificación.
--
--   · `usuarios.perfil_activo`: 'estudiante' (por omisión) o 'vendedor'. El alta lo deja en 'vendedor' si la persona se declaró arrendador o
--     comerciante (0082). Las cuentas que ya existen quedan como 'estudiante': no se les mueve la app de lugar hoy.
--   · `cambiar_perfil_activo(p_perfil)`: la única forma de cambiarlo. 'estudiante' siempre se puede; 'vendedor' solo si la cuenta tiene alguna
--     función de vendedor, aunque sea sin verificar (si no, vería un panel de algo que no tiene). No es una regla de seguridad —publicar sigue
--     exigiendo función APROBADA (0051)—, es coherencia de lo que la app enseña.
--   · Un guardián impide el `update` directo, como con `cuenta_restringida` (0082).
--
-- Código propio: CP017 (perfil de vendedor sin función de vendedor, o cambio directo del perfil activo).
--
-- Reversión:
--   drop trigger if exists trg_proteger_perfil_activo on usuarios;
--   drop function if exists proteger_perfil_activo();
--   drop function if exists cambiar_perfil_activo(text);
--   -- volver a crear handle_new_user (0082) sin la columna;
--   alter table usuarios drop column if exists perfil_activo;

alter table usuarios add column if not exists perfil_activo text not null default 'estudiante';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'usuarios_perfil_activo_valido') then
    alter table usuarios add constraint usuarios_perfil_activo_valido check (perfil_activo in ('estudiante', 'vendedor'));
  end if;
end $$;

-- Cuerpo de la 0082 más el perfil activo.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acepto boolean := new.raw_user_meta_data->>'acepto_aviso' = 'true';
  v_version text := nullif(btrim(new.raw_user_meta_data->>'aviso_version'), '');
  v_tipo    text := case when new.raw_user_meta_data->>'tipo_cuenta' in ('arrendador', 'comerciante') then new.raw_user_meta_data->>'tipo_cuenta' end;
begin
  insert into usuarios (id, nombre_usuario, nombre_completo, acepto_aviso_privacidad_en, version_aviso_aceptada, correo_verificado, cuenta_restringida, cuestionario_completo, perfil_activo)
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
    not (es_correo_universitario(new.email) or coalesce(new.raw_app_meta_data->>'sin_restriccion', '') = 'true'),
    v_tipo is not null,
    case when v_tipo is not null then 'vendedor' else 'estudiante' end
  )
  on conflict (id) do nothing;

  if v_tipo is not null then
    insert into roles_usuario (usuario_id, rol) values (new.id, v_tipo) on conflict do nothing;
  end if;
  return new;
end;
$$;

create or replace function proteger_perfil_activo()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('role', true) = 'authenticated'
     and new.perfil_activo is distinct from old.perfil_activo
     and coalesce(current_setting('app.perfil_activo', true), '') <> 'permitido' then
    raise exception 'perfil_activo solo cambia con cambiar_perfil_activo' using errcode = 'CP017';
  end if;
  return new;
end;
$$;
revoke execute on function proteger_perfil_activo() from public, anon, authenticated;

drop trigger if exists trg_proteger_perfil_activo on usuarios;
create trigger trg_proteger_perfil_activo
  before update on usuarios
  for each row execute function proteger_perfil_activo();

-- La marca `app.perfil_activo` es local a la transacción (set_config(..., true)): la deja puesta esta función y la quita al terminar, así que un cliente
-- que la fije por su cuenta no la ve aquí (es su propia sesión y su propio update, que el guardián evalúa igual que a cualquiera).
create or replace function cambiar_perfil_activo(p_perfil text)
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
  if p_perfil is null or p_perfil not in ('estudiante', 'vendedor') then
    raise exception 'perfil no valido' using errcode = '22023';
  end if;
  if p_perfil = 'vendedor' and not exists (select 1 from roles_usuario where usuario_id = v_uid) then
    raise exception 'sin funcion de vendedor' using errcode = 'CP017';
  end if;

  perform set_config('app.perfil_activo', 'permitido', true);
  update usuarios set perfil_activo = p_perfil where id = v_uid;
  perform set_config('app.perfil_activo', '', true);
end;
$$;
revoke execute on function cambiar_perfil_activo(text) from public, anon, authenticated;
grant execute on function cambiar_perfil_activo(text) to authenticated;
