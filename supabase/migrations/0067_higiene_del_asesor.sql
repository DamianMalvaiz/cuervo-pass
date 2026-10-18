-- Higiene que marca el asesor de Supabase (`supabase db advisors`, 18/10/2026). Plan de excelencia 0.3.
--
-- 1 · `function_search_path_mutable` (13 funciones): una función sin `search_path` fijo resuelve nombres con el del llamador, y un esquema
--     que alguien pueda escribir primero en ese camino puede sustituir un objeto. Las 13 son `security invoker` (RLS sigue aplicando), así que el
--     riesgo era teórico, pero es la deuda más barata de pagar y las pruebas ahora exigen que no vuelva (toda función propia de `public` lo fija).
-- 2 · `auth_users_exposed` (ERROR): `perfiles_publicos` hacía join con `auth.users` solo para leer `email_confirmed_at`. Se guarda como una
--     columna booleana de `usuarios`, mantenida por trigger, y la vista deja de tocar `auth.users`. El dato que se publica sigue siendo un booleano
--     («¿confirmó su correo?»), nunca la fecha ni el correo.
--       · `usuarios` es escribible por su dueña (policy de fila), y una policy limita FILAS, no COLUMNAS: sin un trigger, una cuenta podría ponerse
--         `correo_verificado = true`. `proteger_correo_verificado` lo impide con el mismo idioma que `proteger_suspension` (0023).
-- 3 · `multiple_permissive_policies` en `roomies`: `roomies_select_propio` es un subconjunto exacto de `roomies_todo_dueno` (ALL, mismo predicado). Se quita
--     la redundante; el comportamiento no cambia y cada lectura deja de evaluar dos policies.
--
-- Lo que NO se toca (decisión documentada en docs/auditoria-18-10-2026.md):
--   · las 7 vistas `security definer`: lo son A PROPÓSITO, para publicar columnas de lista blanca sin abrir la tabla;
--   · `vector` y `pg_net` en `public`: mover `vector` exige reescribir los tipos de las columnas; sin beneficio que justifique el riesgo ahora.
--
-- Reversión: quitar el trigger y la columna, volver a crear la vista con el join de la 0026 y la policy `roomies_select_propio`, y
--   `alter function … reset search_path` en las 13.

-- 1 · search_path fijo
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as firma
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in ('actualizar_timestamp', 'proteger_suspension', 'proteger_contenido_mensaje', 'exportar_mis_datos', 'distancia_km',
                         'score_ajuste', 'sugerencias_publicaciones', 'sugerencias_con_ranking', 'nuevas_esta_semana',
                         'limitar_publicaciones', 'limitar_favoritos', 'verif_rutas_propias', 'guardar_menu')
  loop
    execute format('alter function %s set search_path = public', f.firma);
  end loop;
end $$;

-- 2 · correo_verificado
alter table usuarios add column if not exists correo_verificado boolean not null default false;

update usuarios u
   set correo_verificado = (au.email_confirmed_at is not null)
  from auth.users au
 where au.id = u.id and u.correo_verificado is distinct from (au.email_confirmed_at is not null);

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
    case when v_acepto and v_version ~ '^v[0-9]{1,3}$' then v_version end,
    new.email_confirmed_at is not null
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Mantiene la columna cuando alguien confirma su correo (el enlace del mensaje).
create or replace function sincronizar_correo_verificado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update usuarios set correo_verificado = (new.email_confirmed_at is not null)
   where id = new.id and correo_verificado is distinct from (new.email_confirmed_at is not null);
  return new;
end;
$$;
revoke execute on function sincronizar_correo_verificado() from public, anon, authenticated;

drop trigger if exists trg_sincronizar_correo_verificado on auth.users;
create trigger trg_sincronizar_correo_verificado
  after update of email_confirmed_at on auth.users
  for each row execute function sincronizar_correo_verificado();

-- La dueña de la fila NO fija esta columna: la fija el servidor al confirmar el correo.
create or replace function proteger_correo_verificado()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('role', true) = 'authenticated' and new.correo_verificado is distinct from old.correo_verificado then
    raise exception 'correo_verificado no se modifica desde la aplicacion';
  end if;
  return new;
end;
$$;

revoke execute on function proteger_correo_verificado() from public, anon, authenticated;

drop trigger if exists trg_proteger_correo_verificado on usuarios;
create trigger trg_proteger_correo_verificado
  before update on usuarios
  for each row execute function proteger_correo_verificado();

create or replace view perfiles_publicos with (security_invoker = false) as
  select u.id, u.nombre_usuario, u.nombre_completo, u.foto_url, u.biografia,
         u.mascotas, u.fuma, u.nivel_ruido, u.horario_predominante, u.creado_en,
         u.correo_verificado
    from usuarios u
   where u.activo = true;
revoke all on perfiles_publicos from public, anon, authenticated;
grant select on perfiles_publicos to authenticated;

-- 3 · policy redundante
drop policy if exists roomies_select_propio on roomies;
