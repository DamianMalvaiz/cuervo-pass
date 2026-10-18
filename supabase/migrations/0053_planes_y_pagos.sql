-- Planes, prueba gratis y pagos (simulados) · Cuervo 360 (fase 3).
--
-- Un vendedor aprobado (0049) tiene un PLAN que fija cuánto puede tener activo y si aparece destacado. Hay una prueba
-- gratis de 15 días que EMPIEZA CUANDO EL ADMIN APRUEBA (no al registrarse), y después se paga por periodos prepagados.
--
-- ── Periodos prepagados, sin cobros recurrentes ─────────────────────────────
-- Cada pago aprobado extiende `vigente_hasta` en 30 días. El estado «vigente» NO se guarda: se calcula al leer
-- (`vigente_hasta > now()`), así que no depende de un cron que pueda fallar. Si vence, el plan efectivo vuelve al gratuito.
--
-- ── Qué pasa al vencer ──────────────────────────────────────────────────────
-- Se baja al límite gratuito y lo que exceda se OCULTA, nunca se borra: la vista pública `negocios_publicos` solo deja
-- ver los primeros N negocios activos de cada dueño (por antigüedad), con N = el límite del plan efectivo. Al volver a
-- pagar, reaparecen. «Destacado» deja de ser una columna que alguien fije: sale del plan efectivo (el cliente ya no
-- podía escribirla, 0052).
--
-- ── Solo el servidor escribe ────────────────────────────────────────────────
-- `suscripciones` y `pagos` se leen (las propias) y nada más: ningún privilegio de escritura para el cliente.
--
-- ── Pagos: SIMULADOS por ahora ──────────────────────────────────────────────
-- `simular_pago` existe para la demostración y para cuando no haya internet en vivo, y se enseña como tal. Solo funciona
-- con `configuracion_app.demo_mode = 'true'` (por defecto 'false', y no hay forma de encenderlo desde el cliente): con
-- el modo apagado RECHAZA con CP010. Los pagos reales con Mercado Pago quedan en el roadmap; `pagos.origen` y
-- `mp_payment_id` (único, para idempotencia) ya existen para cuando llegue.
--
-- ── Precios y límites ───────────────────────────────────────────────────────
-- Son los ILUSTRATIVOS de la orden maestra ($99 y $199 al mes) y los límites propuestos, pendientes de aprobación. Viven
-- en la tabla `planes`: cambiarlos es un `update`, no una migración.
--
-- Códigos propios: CP010 (demo_mode apagado), CP011 (plan inválido o sin función aprobada), CP012 (más fotos de las que
-- permite el plan).
--
-- Reversión: ver el final de este archivo.

-- ── Catálogo de planes ──────────────────────────────────────────────────────
create table if not exists planes (
  id               text primary key check (id ~ '^[a-z_]{3,40}$'),
  rol              text not null check (rol in ('comerciante', 'arrendador')),
  nombre           text not null,
  precio_centavos  integer not null check (precio_centavos >= 0),
  -- Negocios activos (comerciante) o anuncios activos (arrendador) que permite.
  limite_principal integer not null check (limite_principal >= 0),
  max_fotos        integer not null check (max_fotos >= 0),
  destaca          boolean not null default false,
  -- El plan cuyos límites se disfrutan durante la prueba gratis.
  es_prueba        boolean not null default false,
  orden            smallint not null default 0
);

-- Exactamente un plan gratuito y a lo más uno de prueba por función.
create unique index if not exists planes_un_gratuito on planes (rol) where precio_centavos = 0;
create unique index if not exists planes_una_prueba on planes (rol) where es_prueba;

insert into planes (id, rol, nombre, precio_centavos, limite_principal, max_fotos, destaca, es_prueba, orden) values
  ('comerciante_gratis',     'comerciante', 'Sin plan',   0,     0, 2, false, false, 0),
  ('comerciante_basico',     'comerciante', 'Básico',     9900,  1, 4, false, true,  1),
  ('comerciante_destacado',  'comerciante', 'Destacado',  19900, 3, 8, true,  false, 2),
  ('arrendador_gratis',      'arrendador',  'Gratis',     0,     1, 8, false, false, 0),
  ('arrendador_plus',        'arrendador',  'Plus',       9900,  15, 8, true,  true,  1)
on conflict (id) do nothing;

-- ── Suscripciones y pagos ───────────────────────────────────────────────────
create table if not exists suscripciones (
  usuario_id    uuid not null,
  rol           text not null check (rol in ('comerciante', 'arrendador')),
  plan_id       text references planes(id),
  -- Se fija UNA vez, al aprobar la verificación. No se vuelve a dar.
  prueba_hasta  timestamptz,
  vigente_hasta timestamptz,
  creada_en     timestamptz not null default now(),
  primary key (usuario_id, rol),
  foreign key (usuario_id, rol) references roles_usuario(usuario_id, rol) on delete cascade
);

create table if not exists pagos (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null,
  rol             text not null,
  plan_id         text not null references planes(id),
  monto_centavos  integer not null check (monto_centavos >= 0),
  origen          text not null check (origen in ('simulado', 'mercadopago')),
  -- Único: un mismo pago de Mercado Pago no se registra dos veces (idempotencia del webhook futuro).
  mp_payment_id   text unique,
  periodo_inicio  timestamptz not null,
  periodo_fin     timestamptz not null,
  creado_en       timestamptz not null default now(),
  foreign key (usuario_id, rol) references roles_usuario(usuario_id, rol) on delete cascade,
  check (periodo_fin > periodo_inicio)
);
create index if not exists pagos_usuario_idx on pagos (usuario_id, creado_en desc);

-- Configuración de servicio: nadie la toca desde el cliente.
create table if not exists configuracion_app (
  clave text primary key,
  valor text not null
);
insert into configuracion_app (clave, valor) values ('demo_mode', 'false') on conflict (clave) do nothing;

alter table planes enable row level security;
alter table suscripciones enable row level security;
alter table pagos enable row level security;
alter table configuracion_app enable row level security;

revoke all on planes, suscripciones, pagos, configuracion_app from public, anon, authenticated;
grant select on planes, suscripciones, pagos to authenticated;

drop policy if exists planes_select on planes;
create policy planes_select on planes for select to authenticated using (true);
drop policy if exists suscripciones_select_propia on suscripciones;
create policy suscripciones_select_propia on suscripciones
  for select to authenticated using (usuario_id = (select auth.uid()));
drop policy if exists pagos_select_propios on pagos;
create policy pagos_select_propios on pagos
  for select to authenticated using (usuario_id = (select auth.uid()));

-- ── El plan efectivo de una cuenta ──────────────────────────────────────────
-- 1. un periodo pagado vigente; 2. la prueba gratis, con los límites del plan de prueba; 3. el plan gratuito.
--
-- UNA sola definición, en una vista INTERNA (nadie la lee desde el cliente). Las funciones de abajo y la vista pública
-- leen de aquí. Va en una vista y no en una función porque `negocios_publicos` la necesita: el permiso EXECUTE de una
-- función llamada dentro de una vista se revisa con el usuario que consulta (no con el dueño de la vista), y estas
-- funciones no son ejecutables por el cliente (invariante 9). Las TABLAS sí se revisan como dueño de la vista.
create or replace view planes_efectivos with (security_invoker = false) as
  select r.usuario_id, r.rol, p.id as plan_id, p.limite_principal, p.max_fotos, p.destaca
    from roles_usuario r
    join planes p on p.id = coalesce(
      (select s.plan_id from suscripciones s
        where s.usuario_id = r.usuario_id and s.rol = r.rol and s.plan_id is not null and s.vigente_hasta > now()),
      (select pp.id from planes pp
        where pp.rol = r.rol and pp.es_prueba
          and exists (select 1 from suscripciones s
                       where s.usuario_id = r.usuario_id and s.rol = r.rol and s.prueba_hasta > now())),
      (select pg.id from planes pg where pg.rol = r.rol and pg.precio_centavos = 0)
    )
   where r.rol in ('comerciante', 'arrendador');
revoke all on planes_efectivos from public, anon, authenticated;

create or replace function plan_efectivo(p_usuario uuid, p_rol text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select plan_id from planes_efectivos where usuario_id = p_usuario and rol = p_rol;
$$;
revoke execute on function plan_efectivo(uuid, text) from public, anon, authenticated;

-- Reemplaza el cuerpo de la 0052 (que devolvía 1 para todos): ahora sale del plan efectivo.
create or replace function limite_negocios(p_usuario uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select limite_principal from planes where id = plan_efectivo(p_usuario, 'comerciante');
$$;
revoke execute on function limite_negocios(uuid) from public, anon, authenticated;

-- Más fotos de las que permite el plan: se rechaza (CP012). Se suma a la comprobación de rutas de la 0052.
create or replace function validar_fotos_negocio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max integer;
begin
  if exists (select 1 from unnest(new.fotos) r where r not like 'negocios/' || new.id::text || '/%') then
    raise exception 'ruta de foto fuera de la carpeta del negocio' using errcode = '23514';
  end if;
  if new.usuario_id is not null then
    select max_fotos into v_max from planes where id = plan_efectivo(new.usuario_id, 'comerciante');
    if cardinality(new.fotos) > coalesce(v_max, 0) then
      raise exception 'mas fotos de las que permite el plan' using errcode = 'CP012';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function validar_fotos_negocio() from public, anon, authenticated;

-- ── La prueba gratis empieza al APROBAR ─────────────────────────────────────
-- Misma función de la 0049, más el alta de la prueba. `on conflict do nothing`: una segunda aprobación (o la de otro rol)
-- no reinicia la prueba de quien ya la tuvo.
create or replace function resolver_verificacion(
  p_usuario uuid, p_rol text, p_aprobar boolean, p_motivo text, p_admin uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado text;
begin
  if p_admin is null or not exists (
    select 1 from roles_usuario where usuario_id = p_admin and rol = 'admin' and estado = 'aprobado'
  ) then
    raise exception 'responsable no es admin' using errcode = 'CP007';
  end if;

  select estado into v_estado from roles_usuario where usuario_id = p_usuario and rol = p_rol for update;
  if v_estado is distinct from 'pendiente' then
    raise exception 'no hay verificacion pendiente' using errcode = 'CP005';
  end if;

  if p_aprobar then
    update roles_usuario set estado = 'aprobado' where usuario_id = p_usuario and rol = p_rol;
    update verificaciones_vendedor
       set revisada_en = now(), revisada_por = p_admin, motivo_rechazo = null,
           ine_borrar_en = now() + interval '30 days'
     where usuario_id = p_usuario and rol = p_rol;
    insert into suscripciones (usuario_id, rol, prueba_hasta)
    values (p_usuario, p_rol, now() + interval '15 days')
    on conflict (usuario_id, rol) do nothing;
  else
    if p_motivo is null or char_length(btrim(p_motivo)) < 3 then
      raise exception 'falta el motivo del rechazo' using errcode = 'CP006';
    end if;
    update roles_usuario set estado = 'rechazado' where usuario_id = p_usuario and rol = p_rol;
    update verificaciones_vendedor
       set revisada_en = now(), revisada_por = p_admin, motivo_rechazo = btrim(p_motivo), ine_borrar_en = null
     where usuario_id = p_usuario and rol = p_rol;
  end if;
end;
$$;
revoke execute on function resolver_verificacion(uuid, text, boolean, text, uuid) from public, anon, authenticated;
grant execute on function resolver_verificacion(uuid, text, boolean, text, uuid) to service_role;

-- ── Lo que ve la app: «mi suscripción» ──────────────────────────────────────
create or replace function mi_suscripcion(p_rol text)
returns table (
  plan_id text, plan_nombre text, estado text, hasta timestamptz,
  limite_principal integer, max_fotos integer, destaca boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with efectivo as (select plan_efectivo(auth.uid(), p_rol) as id),
       s as (select * from suscripciones where usuario_id = auth.uid() and rol = p_rol)
  select p.id, p.nombre,
         case
           when exists (select 1 from s where vigente_hasta > now() and plan_id = p.id) then 'vigente'
           when p.precio_centavos = 0 then 'gratis'
           else 'prueba'
         end,
         case
           when exists (select 1 from s where vigente_hasta > now() and plan_id = p.id) then (select vigente_hasta from s)
           when p.precio_centavos = 0 then null
           else (select prueba_hasta from s)
         end,
         p.limite_principal, p.max_fotos, p.destaca
    from efectivo e join planes p on p.id = e.id
   where auth.uid() is not null;
$$;
revoke execute on function mi_suscripcion(text) from public, anon, authenticated;
grant execute on function mi_suscripcion(text) to authenticated;

-- ── Pago simulado (solo con demo_mode) ──────────────────────────────────────
create or replace function simular_pago(p_plan text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_plan   planes%rowtype;
  v_inicio timestamptz;
  v_fin    timestamptz;
begin
  if v_uid is null then
    raise exception 'sin sesion' using errcode = '28000';
  end if;

  -- Falla CERRADO: sin la fila, o con cualquier valor que no sea exactamente 'true', está apagado.
  if coalesce((select valor from configuracion_app where clave = 'demo_mode'), 'false') <> 'true' then
    raise exception 'modo demostracion apagado' using errcode = 'CP010';
  end if;

  select * into v_plan from planes where id = p_plan;
  -- Plan inexistente, gratuito, o de una función que esta cuenta no tiene APROBADA: un mismo código para los tres.
  if not found or v_plan.precio_centavos = 0 or not exists (
    select 1 from roles_usuario where usuario_id = v_uid and rol = v_plan.rol and estado = 'aprobado'
  ) then
    raise exception 'plan no disponible' using errcode = 'CP011';
  end if;

  -- El periodo se SUMA al que aún queda: pagar antes de vencer no pierde días.
  select greatest(coalesce(vigente_hasta, now()), now()) into v_inicio
    from suscripciones where usuario_id = v_uid and rol = v_plan.rol;
  v_inicio := coalesce(v_inicio, now());
  v_fin := v_inicio + interval '30 days';

  insert into suscripciones (usuario_id, rol, plan_id, vigente_hasta)
  values (v_uid, v_plan.rol, v_plan.id, v_fin)
  on conflict (usuario_id, rol) do update set plan_id = excluded.plan_id, vigente_hasta = excluded.vigente_hasta;

  insert into pagos (usuario_id, rol, plan_id, monto_centavos, origen, periodo_inicio, periodo_fin)
  values (v_uid, v_plan.rol, v_plan.id, v_plan.precio_centavos, 'simulado', v_inicio, v_fin);

  return v_fin;
end;
$$;
revoke execute on function simular_pago(text) from public, anon, authenticated;
grant execute on function simular_pago(text) to authenticated;

-- ── La vista pública respeta el plan ────────────────────────────────────────
-- Mismas columnas y tipos que en la 0047 (por eso `create or replace`: la política de Storage de la 0048 depende de
-- esta vista). Cambia QUÉ filas salen —solo los primeros N activos de cada dueño— y cómo se calcula `destacado`.
create or replace view negocios_publicos with (security_invoker = false) as
  select n.id, n.categoria_id, n.nombre, n.descripcion, n.direccion, n.latitud, n.longitud, n.rango_precio, n.horario,
         n.fotos,
         case when n.usuario_id is null then n.destacado else coalesce(pe.destaca, false) end as destacado,
         n.origen, n.creado_en
    from (
      select n0.*, row_number() over (partition by n0.usuario_id order by n0.creado_en, n0.id) as pos
        from negocios n0
       where n0.activo and not n0.oculto_por_reportes
    ) n
    left join planes_efectivos pe on pe.usuario_id = n.usuario_id and pe.rol = 'comerciante'
   where n.usuario_id is null or n.pos <= coalesce(pe.limite_principal, 0);

create or replace view negocio_items_publicos with (security_invoker = false) as
  select i.id, i.negocio_id, i.nombre, i.precio, i.orden
    from negocio_items i
    join negocios_publicos n on n.id = i.negocio_id;

-- Reversión (no se usa, pero se escribe):
--   restaurar `limite_negocios` (select 1), `validar_fotos_negocio` (0052) y `resolver_verificacion` (0049);
--   create or replace view negocios_publicos / negocio_items_publicos como en la 0047;
--   drop function if exists simular_pago(text), mi_suscripcion(text), plan_efectivo(uuid, text); drop view if exists planes_efectivos;
--   drop table if exists pagos, suscripciones, planes, configuracion_app;
