-- Documento maestro v5 · §11 (modelo de datos), §13 (límite de publicaciones),
-- §16 (índices vectoriales), §17 (distancia).
--
-- Reversión:
--   alter table publicaciones drop column titulo, drop column tipo, ... ;
--   alter table publicaciones rename column reportes_count to reportes;
--   drop trigger if exists trg_limitar_publicaciones on publicaciones;

-- ============================================================
-- 1. Atributos explícitos en vez de adivinados con ilike
-- ============================================================
-- v3 infería "permite mascotas" buscando la palabra en la descripción
-- (src/lib/scoring.ts). Eso hace que "NO acepto mascotas" cuente como que sí.
-- Un filtro duro no se puede construir sobre una heurística de subcadenas.
alter table publicaciones
  add column if not exists titulo text,
  add column if not exists tipo text,
  add column if not exists permite_mascotas boolean default false,
  add column if not exists amueblado boolean default false,
  add column if not exists servicios_incluidos boolean default false,
  add column if not exists recamaras int default 1,
  -- §27: el geocoding falló y hay que reintentarlo, en vez de perder la
  -- publicación o guardarla en silencio sin coordenadas para siempre.
  add column if not exists pendiente_geocoding boolean default false,
  -- AUD-02: qué proveedor y bajo qué licencia produjo estas coordenadas. El día
  -- que cambie hay que poder decir cuáles vinieron de dónde.
  add column if not exists geocodificado_por text,
  add column if not exists oculta_por_reportes boolean default false;

-- Relleno de las filas que ya existen, antes de poner los NOT NULL.
update publicaciones
   set titulo = coalesce(nullif(trim(titulo), ''),
                         'Publicación en ' || split_part(direccion, ',', 1))
 where titulo is null or trim(titulo) = '';

update publicaciones set tipo = 'depa' where tipo is null;

-- La heurística de v3, aplicada UNA vez para no perder la información que ya
-- estaba en las descripciones. A partir de aquí el dato es explícito.
update publicaciones
   set permite_mascotas = true
 where permite_mascotas = false
   and (lower(coalesce(descripcion, '')) like '%mascota%'
     or lower(coalesce(descripcion, '')) like '%pet friendly%')
   and lower(coalesce(descripcion, '')) not like '%no mascota%'
   and lower(coalesce(descripcion, '')) not like '%sin mascota%';

update publicaciones
   set amueblado = true
 where amueblado = false and lower(coalesce(descripcion, '')) like '%amueblad%';

update publicaciones
   set servicios_incluidos = true
 where servicios_incluidos = false and lower(coalesce(descripcion, '')) like '%incluye servicio%';

alter table publicaciones
  alter column titulo set not null,
  alter column tipo set not null;

-- AUD-11 / integridad: v3 dejaba usuario_id nullable, y seed.sql se aprovechaba
-- de eso para insertar publicaciones sin dueño. Una publicación sin dueño no
-- puede aparecer en sugerencias (el join con perfiles_publicos la descarta) ni
-- puede revelar contacto. Se limpian antes de exigir el NOT NULL.
delete from publicaciones where usuario_id is null;
alter table publicaciones alter column usuario_id set not null;

-- AUD-16: el contador se llamaba `reportes`, igual que la tabla de reportes.
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_name = 'publicaciones' and column_name = 'reportes') then
    alter table publicaciones rename column reportes to reportes_count;
  end if;
end $$;

-- ============================================================
-- 2. Restricciones
-- ============================================================
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'publicaciones_tipo_valido') then
    alter table publicaciones add constraint publicaciones_tipo_valido
      check (tipo in ('depa','cuarto','casa_compartida'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'publicaciones_recamaras_positivas') then
    alter table publicaciones add constraint publicaciones_recamaras_positivas
      check (recamaras is null or recamaras > 0);
  end if;
  -- AUD-27: `fotos text[]` sin cota superior. Ocho es el tope de producto y el
  -- tope de costo de Storage al mismo tiempo.
  if not exists (select 1 from pg_constraint where conname = 'publicaciones_max_fotos') then
    alter table publicaciones add constraint publicaciones_max_fotos
      check (coalesce(array_length(fotos, 1), 0) <= 8);
  end if;
end $$;

alter table publicaciones alter column fotos set default '{}';
update publicaciones set fotos = '{}' where fotos is null;

-- AUD-17: el formato de diez dígitos fija México. Es una decisión de alcance
-- declarada (docs/modelo-amenazas.md y README), no un descuido.
-- Los datos de demo de seed.sql traen '52' al frente; se normalizan antes del
-- check para que la restricción pueda entrar sin borrar filas.
update publicaciones
   set whatsapp = right(regexp_replace(whatsapp, '\D', '', 'g'), 10)
 where whatsapp !~ '^[0-9]{10}$';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'publicaciones_whatsapp_mx') then
    alter table publicaciones add constraint publicaciones_whatsapp_mx
      check (whatsapp ~ '^[0-9]{10}$');
  end if;
end $$;

-- ============================================================
-- 3. Índices · AUD-16, §16
-- ============================================================
-- Los tres índices IVFFlat de 0001 se crearon sobre tablas VACÍAS. Un IVFFlat
-- se construye agrupando los vectores que ya existen; con cero filas no hay
-- nada que agrupar y el índice queda inservible sin que Postgres se queje.
-- Peor: con `lists = 100` y diez publicaciones, la búsqueda revisa una sola
-- lista y puede devolver CERO resultados en la pantalla que se va a presentar.
--
-- A esta escala la respuesta correcta es no tener índice vectorial: un recorrido
-- secuencial sobre vector(384) con unos cientos de filas es instantáneo y, a
-- diferencia de cualquier índice aproximado, EXACTO. Cuando haya miles de filas,
-- la respuesta es HNSW (no requiere entrenamiento previo) — ver §16.
drop index if exists publicaciones_vector_embedding_idx;
drop index if exists usuarios_perfil_vector_idx;
drop index if exists roomings_perfil_busqueda_vector_idx;

create index if not exists publicaciones_catalogo_idx
  on publicaciones (activa, oculta_por_reportes, precio_renta);
create index if not exists publicaciones_usuario_idx on publicaciones (usuario_id);

-- ============================================================
-- 4. distancia_km en SQL puro · §11
-- ============================================================
-- `language sql` en vez de `plpgsql`: una función SQL simple el planificador la
-- incorpora directamente a la consulta (inlining). Una en plpgsql es una caja
-- negra que se invoca fila por fila, y esta se invoca sobre cada publicación.
--
-- `strict` = si algún argumento es nulo devuelve nulo sin ejecutarse, que es
-- exactamente lo que queremos para publicaciones cuyo geocoding falló.
create or replace function distancia_km(
  lat1 double precision, lon1 double precision,
  lat2 double precision, lon2 double precision
) returns double precision
language sql immutable strict parallel safe as $$
  select 6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians(lon2 - lon1) / 2), 2)
  ));
$$;

-- ============================================================
-- 5. AUD-26 — límite de publicaciones activas por cuenta
-- ============================================================
-- Nada impedía que un bucle creara doscientas publicaciones y sepultara el
-- catálogo. Quince es holgado para alguien con tres departamentos y suficiente
-- para que un bucle choque antes de hacer daño.
create or replace function limitar_publicaciones()
returns trigger language plpgsql as $$
begin
  if (select count(*) from publicaciones
       where usuario_id = new.usuario_id and activa) >= 15 then
    raise exception 'límite de publicaciones activas alcanzado'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_limitar_publicaciones on publicaciones;
create trigger trg_limitar_publicaciones
  before insert on publicaciones
  for each row execute function limitar_publicaciones();
