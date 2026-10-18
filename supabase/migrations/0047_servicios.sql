-- Servicios · Cuervo 360.
--
-- Negocios y servicios cerca de la universidad: comida, cafés, lavandería, reparaciones… Es un módulo
-- aparte de las publicaciones (depas y cuartos): sus datos no se parecen (horario, menú, rango de precio, sin
-- recámaras ni mascotas) y forzarlos dentro de `publicaciones` habría llenado esa tabla de columnas nulas.
--
-- ── Solo LECTURA, por ahora ─────────────────────────────────────────────────
-- Esta migración no concede ninguna escritura al cliente. Quién puede publicar un negocio (la función de
-- comerciante aprobada, 0043) y cómo se verifica llega en otra migración; hasta entonces los negocios que haya
-- los siembra el servicio, y se rotulan como de EJEMPLO.
--
-- ── De ejemplo, y dicho ─────────────────────────────────────────────────────
-- `origen = 'sembrado'` marca los negocios inventados para la demostración (sin dueño: `usuario_id` nulo). La
-- vista pública expone `origen` para que la app los rotule «Negocio de ejemplo». Un negocio inventado que se
-- ve como real es el mismo defecto que una insignia que no se ganó (0026, 0043).
--
-- ── Sin reseñas ni calificaciones ───────────────────────────────────────────
-- No hay tabla de reseñas, y a propósito: una calificación o un «64 reseñas» sin reseñas reales detrás sería un
-- dato fabricado. Cuando existan reseñas verificadas, entran con su propia migración.
--
-- ── Las tablas se cierran; se lee por VISTAS ────────────────────────────────
-- Invariante 3: RLS filtra filas, no columnas. Como `publicaciones_publicas` (0014), la app lee
-- `negocios_publicos` y `negocio_items_publicos`, con las columnas escritas una a una y solo lo visible
-- (activo y sin ocultar por reportes). `usuario_id` del dueño no sale en la vista.
--
-- ── Las categorías son DATOS ────────────────────────────────────────────────
-- No un enum: añadir «Papelería» es un `insert`, no una migración ni una versión de la app.
--
-- Reversión:
--   drop view if exists negocio_items_publicos, negocios_publicos;
--   drop table if exists negocio_items, negocios, categorias_servicio;

create table if not exists categorias_servicio (
  id     text primary key check (id ~ '^[a-z_]{2,30}$'),
  nombre text not null check (char_length(nombre) between 2 and 40),
  -- Nombre de un glifo de Ionicons. Es un dato de presentación; si el nombre no existe la app cae a uno genérico.
  icono  text not null,
  orden  smallint not null default 0,
  activa boolean not null default true
);

create table if not exists negocios (
  id            uuid primary key default gen_random_uuid(),
  -- Nulo = negocio de ejemplo sin dueño. Con dueño, se borra con su cuenta.
  usuario_id    uuid references usuarios(id) on delete cascade,
  categoria_id  text not null references categorias_servicio(id),
  nombre        text not null check (char_length(nombre) between 2 and 80),
  descripcion   text check (char_length(descripcion) <= 600),
  direccion     text not null check (char_length(direccion) between 3 and 200),
  latitud       numeric check (latitud between -90 and 90),
  longitud      numeric check (longitud between -180 and 180),
  -- 1 = $, 2 = $$, 3 = $$$. Nulo = sin dato.
  rango_precio  smallint check (rango_precio between 1 and 3),
  -- Texto libre para mostrar («Lun a sáb · 8 am a 9 pm»). Calcular «abierto ahora» exige un horario
  -- estructurado y llega cuando haga falta; aquí no se finge.
  horario       text check (char_length(horario) <= 120),
  -- Rutas del bucket privado `fotos`, como en `publicaciones`: se firman al leerlas.
  fotos         text[] not null default '{}' check (cardinality(fotos) <= 8),
  destacado     boolean not null default false,
  activo        boolean not null default true,
  oculto_por_reportes boolean not null default false,
  origen        text not null default 'solicitud' check (origen in ('solicitud', 'sembrado')),
  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  -- Un negocio de ejemplo no tiene dueño; uno de solicitud sí.
  constraint negocios_origen_dueno check ((origen = 'sembrado') = (usuario_id is null))
);

create index if not exists negocios_categoria_idx on negocios (categoria_id) where activo and not oculto_por_reportes;
create index if not exists negocios_usuario_idx on negocios (usuario_id) where usuario_id is not null;

create table if not exists negocio_items (
  id         uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  nombre     text not null check (char_length(nombre) between 1 and 80),
  -- Nulo = «consulta el precio». Nunca se inventa uno.
  precio     numeric(10, 2) check (precio >= 0),
  orden      smallint not null default 0
);

create index if not exists negocio_items_negocio_idx on negocio_items (negocio_id, orden);

alter table categorias_servicio enable row level security;
alter table negocios enable row level security;
alter table negocio_items enable row level security;

-- Privilegios cerrados (0036): ni anon ni authenticated tocan las tablas. Se lee por las vistas.
revoke all on categorias_servicio, negocios, negocio_items from public, anon, authenticated;

-- Las categorías son un catálogo público por diseño: se leen directo, solo las activas.
grant select on categorias_servicio to authenticated;
drop policy if exists categorias_servicio_select on categorias_servicio;
create policy categorias_servicio_select on categorias_servicio
  for select to authenticated using (activa);

-- Vistas con las columnas escritas una a una (invariante 3). `security_invoker = false` a propósito, como
-- `publicaciones_publicas` (AUD-14): las tablas están cerradas y una vista con la identidad de quien lee
-- devolvería cero filas sin error (AUD-01).
drop view if exists negocios_publicos;
create view negocios_publicos with (security_invoker = false) as
  select id, categoria_id, nombre, descripcion, direccion, latitud, longitud, rango_precio, horario,
         fotos, destacado, origen, creado_en
  from negocios
  where activo and not oculto_por_reportes;

drop view if exists negocio_items_publicos;
create view negocio_items_publicos with (security_invoker = false) as
  select i.id, i.negocio_id, i.nombre, i.precio, i.orden
  from negocio_items i
  join negocios n on n.id = i.negocio_id
  where n.activo and not n.oculto_por_reportes;

revoke all on negocios_publicos, negocio_items_publicos from public, anon, authenticated;
grant select on negocios_publicos, negocio_items_publicos to authenticated;

comment on view negocios_publicos is
  'security_invoker=false a propósito (AUD-14). No expone usuario_id: quién es el dueño no se publica. origen=sembrado se rotula «Negocio de ejemplo» en la app.';
