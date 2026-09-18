-- Documento maestro v5 · §11 (modelo de datos), §12 (alta de usuario), §30 (qué cifrar).
--
-- Migración hacia adelante (§33.4, regla 1): no se edita ninguna de 0001-0007,
-- se corrige con una nueva. Todo es idempotente para poder re-aplicarla sobre
-- una base que ya quedó a medias.
--
-- Reversión (no se usa, pero se escribe — §33.4 regla 3):
--   alter table usuarios drop column distancia_max_km, drop column horario_predominante,
--     drop column cuestionario_completo, drop column acepto_aviso_privacidad_en,
--     drop column consiente_analisis_ia, drop column perfil_texto, drop column actualizado_en;
--   drop index if exists usuarios_nombre_ci;
--   drop trigger if exists trg_auth_user_created on auth.users;
--   drop function if exists handle_new_user();

-- ============================================================
-- 1. Columnas nuevas
-- ============================================================
alter table usuarios
  -- v3 dejaba el radio de búsqueda fijo en 5 km dentro de scoring.ts. Ahora es
  -- del usuario, y el filtro duro de §17 lo usa como corte real.
  add column if not exists distancia_max_km numeric default 5,
  add column if not exists horario_predominante text default 'mixto',
  -- §26: un tercer estado de navegación que v3 no tenía — con sesión pero sin
  -- cuestionario. Antes se inferría de `universidad is not null`, que es una
  -- proxy frágil (alguien con universidad y sin presupuesto pasaba igual).
  add column if not exists cuestionario_completo boolean default false,
  -- §29: la marca de tiempo ES la evidencia del consentimiento. Sin columna no
  -- hay forma de demostrar que se aceptó, que es justo lo que exige la LFPDPPP.
  add column if not exists acepto_aviso_privacidad_en timestamptz,
  -- §29, AUD-23: consentimiento separado y NO premarcado para el análisis con
  -- IA. Sin él no se llama al modelo, no se genera vector, y el usuario recibe
  -- sugerencias de Nivel 1. Obliga a que el camino sin IA funcione de verdad.
  add column if not exists consiente_analisis_ia boolean default false,
  -- §30: el texto libre vuelve a texto plano. El cifrado de 0005 no protegía
  -- nada (la clave viajaba en la consulta, el vector derivado quedaba en claro
  -- y el resto de los datos sensibles nunca estuvo cifrado). Lo que protege es
  -- el control de acceso de 0013, no pgp_sym_encrypt.
  add column if not exists perfil_texto text,
  add column if not exists actualizado_en timestamptz default now();

-- ============================================================
-- 2. Restricciones que v3 no tenía
-- ============================================================
alter table usuarios
  alter column nombre_completo set default '',
  alter column nivel_ruido set default 'medio';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'usuarios_horario_valido') then
    alter table usuarios add constraint usuarios_horario_valido
      check (horario_predominante in ('diurno','nocturno','mixto'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'usuarios_distancia_positiva') then
    alter table usuarios add constraint usuarios_distancia_positiva
      check (distancia_max_km is null or distancia_max_km > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'presupuesto_coherente') then
    alter table usuarios add constraint presupuesto_coherente check (
      presupuesto_min is null or presupuesto_max is null or presupuesto_min <= presupuesto_max
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'usuarios_presupuesto_no_negativo') then
    alter table usuarios add constraint usuarios_presupuesto_no_negativo check (
      coalesce(presupuesto_min, 0) >= 0 and coalesce(presupuesto_max, 0) >= 0
    );
  end if;
end $$;

-- AUD-15: `unique` sobre texto distingue mayúsculas, así que `Damian` y `damian`
-- convivían como dos cuentas distintas. Se normaliza antes de crear el índice
-- porque si ya existen duplicados que solo difieren en capitalización, la
-- creación fallaría y dejaría la migración a medias.
update usuarios u set nombre_usuario = u.nombre_usuario || '_' || substr(u.id::text, 1, 4)
where exists (
  select 1 from usuarios o
  where lower(o.nombre_usuario) = lower(u.nombre_usuario)
    and o.creado_en < u.creado_en
);

create unique index if not exists usuarios_nombre_ci on usuarios (lower(nombre_usuario));

-- ============================================================
-- 3. Retiro del cifrado de perfil (§30)
-- ============================================================
-- El texto que ya estaba cifrado se recupera si la clave sigue configurada; si
-- no lo está, la columna nueva queda nula y el usuario reescribe su texto. No
-- se pierde nada que importe: el vector del perfil vive aparte.
do $$
begin
  perform current_setting('app.perfil_encryption_key');
  update usuarios
     set perfil_texto = pgp_sym_decrypt(perfil_texto_cifrado, current_setting('app.perfil_encryption_key'))
   where perfil_texto_cifrado is not null and perfil_texto is null;
exception when others then
  raise notice 'app.perfil_encryption_key no disponible: el texto cifrado previo no se recupera';
end $$;

drop function if exists guardar_perfil_texto(text);
alter table usuarios drop column if exists perfil_texto_cifrado;

-- ============================================================
-- 4. actualizado_en también en usuarios
-- ============================================================
drop trigger if exists trg_usr_actualizado on usuarios;
create trigger trg_usr_actualizado before update on usuarios
  for each row execute function actualizar_timestamp();

-- ============================================================
-- 5. §12 — el trigger de alta que v3 dibujaba en un diagrama y nunca escribía
-- ============================================================
-- Sin esto, la fila de `usuarios` la tenía que insertar el cliente después del
-- signUp (src/app/(auth)/registro.tsx). Eso deja una ventana en la que existe
-- la cuenta de Auth y no la fila del perfil: si la app se cierra entre las dos
-- llamadas, la cuenta queda rota y nada lo repara.
--
-- `coalesce` en ambos campos es deliberado: un metadato ausente NUNCA debe
-- tumbar el registro con el opaco "Database error saving new user".
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into usuarios (id, nombre_usuario, nombre_completo)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'nombre_usuario', ''),
      'usuario_' || substr(new.id::text, 1, 8)
    ),
    coalesce(new.raw_user_meta_data->>'nombre_completo', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_auth_user_created on auth.users;
create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
