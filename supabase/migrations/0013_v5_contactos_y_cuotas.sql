-- Documento maestro v5 · §11 (contactos, cuotas_uso, notificaciones, reportes),
-- §13 (revelar_contacto, al_reportar).
--
-- Reversión:
--   drop function if exists revelar_contacto(uuid, numeric);
--   drop function if exists consumir_cuota(text, int);
--   drop table if exists cuotas_uso;
--   alter table contactos rename to matches;

-- ============================================================
-- 1. `matches` pasa a `contactos`
-- ============================================================
-- "match" sugiere reciprocidad tipo Tinder. Aquí es un registro unidireccional:
-- este usuario pidió el contacto de esta publicación. El nombre importaba
-- porque la métrica que se presenta en la demo se llama "contactos recibidos".
do $$
begin
  if exists (select 1 from information_schema.tables
              where table_schema = 'public' and table_name = 'matches') then
    -- La policy de 0001 nombra usuario_id_2 y Postgres no deja borrar una
    -- columna de la que depende una policy. Las de v5 se crean en 0013.
    drop policy if exists "solo usuarios del match lo ven" on matches;
    drop policy if exists "el usuario registra su propio match" on matches;

    alter table matches rename to contactos;
    alter table contactos rename column score to score_mostrado;
    alter table contactos add column if not exists roomie_id uuid references roomies(id) on delete cascade;
    -- usuario_id_2 apuntaba a "match con otro usuario"; ahora el objetivo es
    -- una publicación o un roomie, nunca una persona suelta.
    alter table contactos drop column if exists usuario_id_2;
  end if;
end $$;

create table if not exists contactos (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references usuarios(id) on delete cascade,
  publicacion_id uuid references publicaciones(id) on delete cascade,
  roomie_id      uuid references roomies(id) on delete cascade,
  score_mostrado numeric,
  creado_en      timestamptz default now()
);

alter table contactos alter column usuario_id set not null;

-- Filas heredadas sin objetivo válido: no representan nada.
delete from contactos where publicacion_id is null and roomie_id is null;
delete from contactos where publicacion_id is not null and roomie_id is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'un_solo_objetivo') then
    alter table contactos add constraint un_solo_objetivo
      check (num_nonnulls(publicacion_id, roomie_id) = 1);
  end if;
end $$;

-- AUD-11: sin unicidad, cada toque repetido en "Ver contacto" inserta otra fila
-- y la métrica que se le enseña al evaluador se infla sola. Índices PARCIALES
-- porque un contacto apunta a una publicación o a un roomie, nunca a ambos.
-- Se deduplica antes, o la creación del índice falla.
delete from contactos c using contactos otro
 where c.publicacion_id is not null
   and c.publicacion_id = otro.publicacion_id
   and c.usuario_id = otro.usuario_id
   and c.creado_en > otro.creado_en;

create unique index if not exists contactos_unico_publicacion
  on contactos (usuario_id, publicacion_id) where publicacion_id is not null;
create unique index if not exists contactos_unico_roomie
  on contactos (usuario_id, roomie_id) where roomie_id is not null;

-- ============================================================
-- 2. Cuotas de uso · AUD-03, AUD-04
-- ============================================================
-- Un contador en memoria del contenedor se pierde al reiniciar y no existe si
-- hay más de una réplica. El único lugar donde una cuota por usuario sobrevive
-- a ambas cosas es la base de datos.
create table if not exists cuotas_uso (
  usuario_id uuid not null references usuarios(id) on delete cascade,
  recurso    text not null check (recurso in ('revelar_contacto','parseo_llm','embedding')),
  dia        date not null default current_date,
  consumo    int  not null default 0,
  primary key (usuario_id, recurso, dia)
);

-- Sin policy de lectura a propósito: es una tabla de servicio. Con RLS activo y
-- cero policies, nadie la lee desde el cliente — ni su propio dueño.
alter table cuotas_uso enable row level security;

create or replace function consumir_cuota(p_recurso text, p_limite int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_consumo int;
begin
  if auth.uid() is null then
    raise exception 'sin sesión';
  end if;

  insert into cuotas_uso (usuario_id, recurso, dia, consumo)
  values (auth.uid(), p_recurso, current_date, 1)
  on conflict (usuario_id, recurso, dia)
    do update set consumo = cuotas_uso.consumo + 1
  returning consumo into v_consumo;

  if v_consumo > p_limite then
    raise exception 'cuota diaria agotada para %', p_recurso
      using errcode = 'check_violation';
  end if;
end;
$$;

revoke execute on function consumir_cuota(text, int) from public;
grant execute on function consumir_cuota(text, int) to authenticated;

-- ============================================================
-- 3. AUD-04 — revelar_contacto: preventivo, no solo detectivo
-- ============================================================
-- v4 presentó esta función como la solución a los teléfonos expuestos. Lo que
-- hacía era dejar rastro: sin cuota, un bucle sobre todos los identificadores
-- baja la base completa igual que antes, solo que con bitácora. Una bitácora es
-- un control DETECTIVO; el límite es lo que lo vuelve PREVENTIVO.
--
-- Veinticinco al día es holgado para alguien buscando departamento y ridículo
-- para un raspador.
create or replace function revelar_contacto(p_publicacion_id uuid, p_score numeric default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_whatsapp text;
begin
  select whatsapp into v_whatsapp
  from publicaciones
  where id = p_publicacion_id and activa and not oculta_por_reportes;

  if v_whatsapp is null then
    raise exception 'publicacion no disponible';
  end if;

  perform consumir_cuota('revelar_contacto', 25);

  insert into contactos (usuario_id, publicacion_id, score_mostrado)
  values (auth.uid(), p_publicacion_id, p_score)
  on conflict (usuario_id, publicacion_id) do nothing;   -- no infla la métrica

  return v_whatsapp;
end;
$$;

revoke execute on function revelar_contacto(uuid, numeric) from public;
grant execute on function revelar_contacto(uuid, numeric) to authenticated;

-- ============================================================
-- 4. Notificaciones y reportes
-- ============================================================
-- AUD-16: `publicacion_oculta` estaba declarado en el CHECK de v4 y no lo
-- emitía nadie — un valor muerto, que es la clase de detalle que delata que el
-- esquema y la lógica se escribieron por separado. Aquí sí se emite (abajo).
alter table notificaciones drop constraint if exists notificaciones_tipo_check;
update notificaciones set tipo = 'nuevo_contacto' where tipo in ('nuevo_match','contacto_publicacion');
alter table notificaciones add constraint notificaciones_tipo_check
  check (tipo in ('nuevo_mensaje','nuevo_contacto','publicacion_oculta'));

alter table reportes alter column motivo set not null;

delete from reportes where publicacion_id is null and usuario_reportado_id is null;
delete from reportes where publicacion_id is not null and usuario_reportado_id is not null;

delete from reportes r using reportes otro
 where r.reportado_por = otro.reportado_por
   and r.creado_en > otro.creado_en
   and (r.publicacion_id = otro.publicacion_id or r.usuario_reportado_id = otro.usuario_reportado_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'un_solo_reportado') then
    alter table reportes add constraint un_solo_reportado
      check (num_nonnulls(publicacion_id, usuario_reportado_id) = 1);
  end if;
end $$;

create unique index if not exists reportes_unico_publicacion
  on reportes (reportado_por, publicacion_id) where publicacion_id is not null;
create unique index if not exists reportes_unico_usuario
  on reportes (reportado_por, usuario_reportado_id) where usuario_reportado_id is not null;

-- v3 prometía "a los tres reportes se oculta" y no había nada que lo hiciera:
-- el conteo y el ocultamiento eran manuales (ver el TODO que este commit borra
-- de src/services/publicaciones.service.ts).
create or replace function al_reportar()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_dueno uuid; v_total int;
begin
  if new.publicacion_id is null then
    return new;
  end if;

  update publicaciones
     set reportes_count = reportes_count + 1,
         oculta_por_reportes = (reportes_count + 1) >= 3
   where id = new.publicacion_id
  returning usuario_id, reportes_count into v_dueno, v_total;

  if v_total = 3 then
    insert into notificaciones (usuario_id, tipo, contenido)
    values (v_dueno, 'publicacion_oculta',
            'Tu publicación se ocultó tras varios reportes y está en revisión.');
  end if;

  return new;
end;
$$;

drop trigger if exists trg_al_reportar on reportes;
create trigger trg_al_reportar
  after insert on reportes
  for each row execute function al_reportar();
