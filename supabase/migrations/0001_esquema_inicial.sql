-- Cuervo de Paz — esquema inicial
-- Fuente: documento maestro, secciones 7 (modelo de datos) y 8 (Row Level Security).
-- Corre con `supabase db push` (CLI vinculado a tu proyecto) o pegado en el SQL editor de Supabase.

-- ============================================================
-- Extensiones
-- ============================================================
create extension if not exists vector;
create extension if not exists pgcrypto;

-- ============================================================
-- Tablas
-- ============================================================
create table usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre_usuario text unique not null,
  nombre_completo text not null,
  foto_url text,
  biografia text,
  perfil_texto_cifrado bytea,       -- texto libre cifrado con pgcrypto (ver sección 18)
  perfil_vector vector(384),         -- embedding generado a partir del perfil + cuestionario
  presupuesto_min int,
  presupuesto_max int,
  mascotas boolean default false,
  fuma boolean default false,
  nivel_ruido text check (nivel_ruido in ('bajo','medio','alto')),
  universidad text,
  latitud_universidad double precision,
  longitud_universidad double precision,
  activo boolean default true,       -- para "desactivar" una cuenta sin borrarla
  creado_en timestamptz default now()
);

create table publicaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references usuarios(id) on delete cascade,
  direccion text not null,
  latitud double precision,
  longitud double precision,
  precio_renta numeric not null check (precio_renta > 0),
  descripcion text,
  fotos text[],                      -- urls de Supabase Storage
  whatsapp text not null,
  vector_embedding vector(384),
  activa boolean default true,
  reportes int default 0,            -- contador simple de moderación
  creado_en timestamptz default now(),
  actualizado_en timestamptz default now()
);

create table roomings (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references usuarios(id) on delete cascade,
  descripcion_busqueda text,
  perfil_busqueda_vector vector(384),
  estado text check (estado in ('activo','pausado','cerrado')) default 'activo',
  creado_en timestamptz default now()
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references usuarios(id) on delete cascade,
  publicacion_id uuid references publicaciones(id) on delete cascade,
  usuario_id_2 uuid references usuarios(id) on delete cascade,  -- null si el match es con una publicación
  score numeric,
  creado_en timestamptz default now()
);

create table mensajes (
  id uuid primary key default gen_random_uuid(),
  remitente_id uuid references usuarios(id) on delete cascade,
  destinatario_id uuid references usuarios(id) on delete cascade,
  contenido text not null,
  leido boolean default false,
  creado_en timestamptz default now()
);

create table notificaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references usuarios(id) on delete cascade,
  tipo text check (tipo in ('nuevo_mensaje','nuevo_match','contacto_publicacion')),
  contenido text,
  leida boolean default false,
  creado_en timestamptz default now()
);

create table reportes (
  id uuid primary key default gen_random_uuid(),
  reportado_por uuid references usuarios(id) on delete cascade,
  publicacion_id uuid references publicaciones(id) on delete cascade,
  usuario_reportado_id uuid references usuarios(id) on delete cascade,
  motivo text,
  creado_en timestamptz default now()
);

-- ============================================================
-- Índices
-- ============================================================
-- Índices de similitud vectorial (clave para que el matching no sea lento)
create index on publicaciones using ivfflat (vector_embedding vector_cosine_ops) with (lists = 100);
create index on usuarios using ivfflat (perfil_vector vector_cosine_ops) with (lists = 100);
create index on roomings using ivfflat (perfil_busqueda_vector vector_cosine_ops) with (lists = 100);

-- Índices normales para consultas frecuentes
create index on publicaciones (activa, precio_renta);
create index on mensajes (remitente_id, destinatario_id, creado_en);
create index on notificaciones (usuario_id, leida);

-- ============================================================
-- Funciones y triggers
-- ============================================================
create or replace function actualizar_timestamp()
returns trigger as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_publicaciones_actualizado
before update on publicaciones
for each row execute function actualizar_timestamp();

-- Distancia Haversine, para no depender de otra llamada a Mapbox por búsqueda
create or replace function distancia_km(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision)
returns double precision as $$
declare
  r double precision := 6371; -- radio de la Tierra en km
  dlat double precision;
  dlon double precision;
  a double precision;
  c double precision;
begin
  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);
  a := sin(dlat/2)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)^2;
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  return r * c;
end;
$$ language plpgsql immutable;

-- ============================================================
-- Row Level Security (sección 8)
-- ============================================================
alter table usuarios enable row level security;
alter table publicaciones enable row level security;
alter table roomings enable row level security;
alter table mensajes enable row level security;
alter table matches enable row level security;
alter table notificaciones enable row level security;
alter table reportes enable row level security;

-- USUARIOS: lectura pública de perfiles activos, solo el dueño edita el suyo
-- "to authenticated" es deliberado: nadie sin sesión (rol anon) puede leer datos
-- de usuarios (presupuesto, biografía, universidad), aunque tenga la anon key.
create policy "lectura de perfiles activos, solo logueados" on usuarios
  for select to authenticated using (activo = true);
create policy "solo el dueno edita su perfil" on usuarios
  for update to authenticated using (auth.uid() = id);
create policy "solo el dueno inserta su fila inicial" on usuarios
  for insert to authenticated with check (auth.uid() = id);

-- PUBLICACIONES: lectura pública de activas, escritura solo del dueño
create policy "lectura de publicaciones activas, solo logueados" on publicaciones
  for select to authenticated using (activa = true);
create policy "el dueno gestiona su publicacion" on publicaciones
  for all to authenticated using (auth.uid() = usuario_id);

-- ROOMINGS: mismo patrón
create policy "lectura de roomings activos, solo logueados" on roomings
  for select to authenticated using (estado = 'activo');
create policy "el dueno gestiona su rooming" on roomings
  for all to authenticated using (auth.uid() = usuario_id);

-- MENSAJES: solo remitente o destinatario pueden leer/escribir
create policy "solo participantes ven sus mensajes" on mensajes
  for select to authenticated using (auth.uid() = remitente_id or auth.uid() = destinatario_id);
create policy "solo el remitente crea el mensaje" on mensajes
  for insert to authenticated with check (auth.uid() = remitente_id);
create policy "solo el destinatario marca como leido" on mensajes
  for update to authenticated using (auth.uid() = destinatario_id);

-- MATCHES: aquí se registra cuando un usuario contacta una publicación o inicia
-- chat con un roomie (score guardado en el momento del contacto).
create policy "solo usuarios del match lo ven" on matches
  for select to authenticated using (auth.uid() = usuario_id or auth.uid() = usuario_id_2);
create policy "el usuario registra su propio match" on matches
  for insert to authenticated with check (auth.uid() = usuario_id);

-- NOTIFICACIONES: cada usuario ve solo las suyas. Sin policy de INSERT para el
-- cliente a propósito: las notificaciones las crea el trigger de abajo (security definer).
create policy "solo el dueno ve sus notificaciones" on notificaciones
  for select to authenticated using (auth.uid() = usuario_id);
create policy "solo el dueno marca como leida" on notificaciones
  for update to authenticated using (auth.uid() = usuario_id);

-- REPORTES: cualquiera autenticado puede crear, nadie lee reportes de otros
-- (ni siquiera el que reportó) — solo admin, vía service_role.
create policy "cualquiera autenticado reporta" on reportes
  for insert to authenticated with check (auth.uid() = reportado_por);

-- Trigger: notificación automática al llegar un mensaje.
-- Corre con security definer, así que se salta RLS igual que el service_role,
-- sin exponer una policy de escritura directa al cliente.
create or replace function crear_notificacion_mensaje()
returns trigger as $$
begin
  insert into notificaciones (usuario_id, tipo, contenido)
  values (new.destinatario_id, 'nuevo_mensaje', left(new.contenido, 80));
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_notificacion_nuevo_mensaje
after insert on mensajes
for each row execute function crear_notificacion_mensaje();
