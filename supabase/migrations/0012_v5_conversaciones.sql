-- Documento maestro v5 · §11 (conversaciones y mensajes), §13 (abrir_conversacion,
-- inmutabilidad), §15 (realtime y paginación).
--
-- v3 guardaba mensajes sueltos con remitente/destinatario. Listar "mis chats con
-- el último mensaje de cada uno" con ese modelo exige un DISTINCT ON sobre pares
-- ordenados, y el índice (remitente, destinatario) no sirve porque la consulta
-- real lleva un OR — que es exactamente por qué mensajes.service.ts terminaba
-- trayéndose TODOS los mensajes del usuario y agrupándolos en el cliente.
--
-- Reversión:
--   alter table mensajes drop column conversacion_id;
--   drop table conversaciones;  -- destruye el hilo, no el contenido

-- ============================================================
-- 1. La tabla
-- ============================================================
create table if not exists conversaciones (
  id                uuid primary key default gen_random_uuid(),
  usuario_a         uuid not null references usuarios(id) on delete cascade,
  usuario_b         uuid not null references usuarios(id) on delete cascade,
  ultimo_mensaje_en timestamptz default now(),
  creado_en         timestamptz default now(),
  -- El orden canónico es lo que hace que A→B y B→A sean la MISMA fila. Sin él,
  -- la restricción única no sirve de nada: (a,b) y (b,a) son pares distintos.
  constraint orden_canonico check (usuario_a < usuario_b),
  unique (usuario_a, usuario_b)
);

alter table mensajes add column if not exists conversacion_id uuid references conversaciones(id) on delete cascade;

-- ============================================================
-- 2. Migración de los mensajes que ya existen
-- ============================================================
insert into conversaciones (usuario_a, usuario_b, ultimo_mensaje_en, creado_en)
select least(remitente_id, destinatario_id),
       greatest(remitente_id, destinatario_id),
       max(creado_en),
       min(creado_en)
  from mensajes
 where destinatario_id is not null
   and remitente_id is not null
   and remitente_id <> destinatario_id
 group by 1, 2
on conflict (usuario_a, usuario_b) do nothing;

update mensajes m
   set conversacion_id = c.id
  from conversaciones c
 where m.conversacion_id is null
   and c.usuario_a = least(m.remitente_id, m.destinatario_id)
   and c.usuario_b = greatest(m.remitente_id, m.destinatario_id);

-- Mensajes que no pudieron asociarse (destinatario borrado, o un mensaje a uno
-- mismo) no tienen hilo posible. Son basura de pruebas, no datos del usuario.
delete from mensajes where conversacion_id is null;

alter table mensajes
  alter column conversacion_id set not null,
  alter column remitente_id set not null;

-- El trigger de 0001 leía destinatario_id; se reemplaza más abajo antes de
-- borrar la columna, o el DROP falla por dependencia.
drop trigger if exists trg_notificacion_nuevo_mensaje on mensajes;
drop function if exists crear_notificacion_mensaje();

-- Las policies de 0001 nombran destinatario_id, y Postgres no deja borrar una
-- columna de la que depende una policy. Se retiran aquí; las de v5 se crean
-- completas en 0013.
drop policy if exists "solo participantes ven sus mensajes" on mensajes;
drop policy if exists "solo el remitente crea el mensaje" on mensajes;
drop policy if exists "solo el destinatario marca como leido" on mensajes;

alter table mensajes drop column if exists destinatario_id;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'mensajes_contenido_acotado') then
    -- Cota inferior y superior en la base, no solo en el cliente: un mensaje
    -- vacío no es un mensaje, y 2000 caracteres es el techo del troll.
    alter table mensajes add constraint mensajes_contenido_acotado
      check (length(trim(contenido)) between 1 and 2000);
  end if;
end $$;

-- ============================================================
-- 3. Índices · AUD-09
-- ============================================================
-- El índice de 0001 era (remitente_id, destinatario_id, creado_en), inútil para
-- la consulta real. Estos dos son exactamente los de la paginación por cursor
-- (§15) y los de la lista de chats.
drop index if exists mensajes_remitente_id_destinatario_id_creado_en_idx;
create index if not exists mensajes_conversacion_idx on mensajes (conversacion_id, creado_en desc);
create index if not exists conversaciones_a_idx on conversaciones (usuario_a, ultimo_mensaje_en desc);
create index if not exists conversaciones_b_idx on conversaciones (usuario_b, ultimo_mensaje_en desc);

-- ============================================================
-- 4. Triggers de servicio · §13
-- ============================================================
-- ⚠ Esta función SUSTITUYE a `crear_notificacion_mensaje()` de la migración
-- 0008 (notificaciones push, Semana 11), que leía `new.destinatario_id` — una
-- columna que esta misma migración elimina. Si 0008 ya está aplicada, el push
-- se seguiría enviando solo si se reimplementa aquí; por eso se reimplementa.
--
-- Sin esto, las notificaciones push dejarían de llegar sin un solo error en los
-- logs: el trigger viejo desaparece con su función y nadie se entera hasta que
-- alguien pregunta por qué ya no suena el teléfono.
create or replace function al_insertar_mensaje()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_destinatario uuid;
begin
  update conversaciones set ultimo_mensaje_en = new.creado_en
   where id = new.conversacion_id
  returning case when usuario_a = new.remitente_id then usuario_b else usuario_a end
  into v_destinatario;

  -- Notificación dentro de la app.
  insert into notificaciones (usuario_id, tipo, contenido)
  values (v_destinatario, 'nuevo_mensaje', left(new.contenido, 80));

  -- Notificación push, solo si la migración 0008 está aplicada. El `if exists`
  -- permite que esta migración corra igual en una base que todavía no tiene el
  -- trabajo de push; sin él, fallaría con "function does not exist".
  --
  -- `conversacion_id` en los datos, no `remitente_id`: la ruta de la app ahora
  -- es chat/[conversacionId] (§26). Con el id del remitente, tocar la
  -- notificación abriría una ruta que ya no existe.
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'enviar_notificacion_push'
  ) then
    perform enviar_notificacion_push(
      v_destinatario,
      'Nuevo mensaje',
      left(new.contenido, 100),
      jsonb_build_object(
        'tipo', 'nuevo_mensaje',
        'conversacion_id', new.conversacion_id,
        'remitente_id', new.remitente_id
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_al_insertar_mensaje on mensajes;
create trigger trg_al_insertar_mensaje
  after insert on mensajes
  for each row execute function al_insertar_mensaje();

-- Una policy de UPDATE no puede limitar QUÉ columnas se modifican, solo qué
-- filas. v3 le daba UPDATE al destinatario para que pudiera marcar "leído", y
-- con eso le daba también la capacidad de reescribir el mensaje que recibió.
-- El candado real es este trigger.
create or replace function proteger_contenido_mensaje()
returns trigger language plpgsql as $$
begin
  if new.contenido       is distinct from old.contenido
  or new.remitente_id    is distinct from old.remitente_id
  or new.conversacion_id is distinct from old.conversacion_id
  or new.creado_en       is distinct from old.creado_en then
    raise exception 'un mensaje enviado no se puede modificar';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_mensaje_inmutable on mensajes;
create trigger trg_mensaje_inmutable
  before update on mensajes
  for each row execute function proteger_contenido_mensaje();

-- ============================================================
-- 5. AUD-07 — abrir una conversación sin carreras
-- ============================================================
-- v4 diseñó la restricción única y nunca escribió cómo se crea una fila. Si dos
-- personas se escriben con segundos de diferencia —o alguien toca dos veces el
-- botón— el segundo insert choca contra el índice y el usuario ve un error
-- crudo justo al iniciar el chat, en el minuto 2:30 de la demo.
--
-- `on conflict do nothing` + relectura es el patrón correcto de "obtener o
-- crear" concurrente: no lanza, no bloquea y converge al mismo id para ambos.
create or replace function abrir_conversacion(p_otro uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_a uuid; v_b uuid; v_id uuid;
begin
  if auth.uid() is null or p_otro is null or p_otro = auth.uid() then
    raise exception 'destinatario inválido';
  end if;

  if not exists (select 1 from usuarios where id = p_otro and activo) then
    raise exception 'usuario no disponible';
  end if;

  v_a := least(auth.uid(), p_otro);
  v_b := greatest(auth.uid(), p_otro);

  insert into conversaciones (usuario_a, usuario_b)
  values (v_a, v_b)
  on conflict (usuario_a, usuario_b) do nothing
  returning id into v_id;

  if v_id is null then           -- ya existía: esta llamada perdió la carrera
    select id into v_id from conversaciones
     where usuario_a = v_a and usuario_b = v_b;
  end if;

  return v_id;
end;
$$;

-- Nota sobre los `revoke`: el documento maestro escribe `revoke execute ... from
-- anon`, pero eso no basta. Postgres concede EXECUTE a **PUBLIC** por omisión en
-- cada función nueva, y `anon` hereda ese permiso de PUBLIC — revocárselo a
-- `anon` en particular no toca la concesión de PUBLIC, así que la función sigue
-- siendo invocable con la sola anon key. Lo que cierra la puerta es revocar a
-- PUBLIC y conceder explícitamente a `authenticated`.

revoke execute on function abrir_conversacion(uuid) from public;
grant execute on function abrir_conversacion(uuid) to authenticated;

-- ============================================================
-- 6. Realtime · §15
-- ============================================================
-- Una tabla no emite eventos hasta que se agrega explícitamente a la
-- publicación. `mensajes` ya entró en 0004; `conversaciones` hace falta para
-- que la lista de chats se reordene en vivo sin recargar.
do $$
begin
  alter publication supabase_realtime add table conversaciones;
exception when duplicate_object then
  null;
end $$;
