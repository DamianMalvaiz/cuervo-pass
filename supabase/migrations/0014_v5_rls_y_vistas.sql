-- Documento maestro v5 · §13 (Row Level Security).
--
-- El error central de v3: RLS filtra FILAS, no COLUMNAS. Su policy
-- `select ... using (activo = true)` permitía que cualquier usuario autenticado
-- hiciera `select * from usuarios` y leyera el presupuesto, la universidad y el
-- vector de perfil de todo el padrón. Lo mismo con `publicaciones.whatsapp`: un
-- solo select bajaba la base de teléfonos completa.
--
-- La solución es cerrar las tablas y exponer VISTAS con las columnas seguras.
--
-- Reversión: recrear las policies de 0001 y `drop view perfiles_publicos,
-- publicaciones_publicas`. Ojo: eso reabre la fuga de columnas.

alter table usuarios       enable row level security;
alter table publicaciones  enable row level security;
alter table roomies        enable row level security;
alter table conversaciones enable row level security;
alter table mensajes       enable row level security;
alter table contactos      enable row level security;
alter table notificaciones enable row level security;
alter table reportes       enable row level security;

-- ============================================================
-- Retiro de las policies de v3
-- ============================================================
drop policy if exists "lectura de perfiles activos, solo logueados" on usuarios;
drop policy if exists "solo el dueno edita su perfil" on usuarios;
drop policy if exists "solo el dueno inserta su fila inicial" on usuarios;
drop policy if exists "lectura de publicaciones activas, solo logueados" on publicaciones;
drop policy if exists "el dueno gestiona su publicacion" on publicaciones;
drop policy if exists "lectura de roomings activos, solo logueados" on roomies;
drop policy if exists "el dueno gestiona su rooming" on roomies;
drop policy if exists "solo el dueno ve sus notificaciones" on notificaciones;
drop policy if exists "solo el dueno marca como leida" on notificaciones;
drop policy if exists "cualquiera autenticado reporta" on reportes;

-- ============================================================
-- USUARIOS: la tabla solo la ve su dueño
-- ============================================================
drop policy if exists usuarios_select_propio on usuarios;
create policy usuarios_select_propio on usuarios
  for select to authenticated using (auth.uid() = id);

drop policy if exists usuarios_update_propio on usuarios;
create policy usuarios_update_propio on usuarios
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists usuarios_insert_propio on usuarios;
create policy usuarios_insert_propio on usuarios
  for insert to authenticated with check (auth.uid() = id);

-- ============================================================
-- Vista pública de perfiles
-- ============================================================
-- Deliberadamente SIN security_invoker: la vista corre con los permisos de su
-- dueño y por eso puede saltarse el RLS de `usuarios`. Es lo que queremos, y es
-- seguro porque la lista de columnas está escrita a mano: aquí no hay
-- presupuesto, ni perfil_texto, ni perfil_vector, ni universidad.
--
-- AUD-14 — declararlo, no esconderlo. El analizador de Supabase va a reportar
-- esta vista como "security definer". No es un error: es LA decisión. Se
-- escribe `security_invoker = false` explícito aunque sea el valor por omisión,
-- para que dentro de tres meses se distinga una decisión de un descuido.
--
-- La regla que lo hace seguro: la lista de columnas se escribe a mano y se
-- revisa en cada cambio de esquema. Eso se verifica con pgTAP en
-- supabase/tests/rls.test.sql (§33), no con buena voluntad.
drop view if exists perfiles_publicos;
create view perfiles_publicos with (security_invoker = false) as
  select id, nombre_usuario, nombre_completo, foto_url, biografia,
         mascotas, fuma, nivel_ruido, horario_predominante, creado_en
  from usuarios
  where activo = true;

revoke all on perfiles_publicos from public;
revoke all on perfiles_publicos from anon;
grant select on perfiles_publicos to authenticated;

comment on view perfiles_publicos is
  'AUD-14: security_invoker=false a propósito — evade el RLS de usuarios para exponer '
  'SOLO las columnas de esta lista blanca. Al agregar una columna sensible a usuarios, '
  'NO se toca esta vista. Verificado por supabase/tests/rls.test.sql.';

-- ============================================================
-- PUBLICACIONES
-- ============================================================
drop policy if exists publicaciones_select_propias on publicaciones;
create policy publicaciones_select_propias on publicaciones
  for select to authenticated using (auth.uid() = usuario_id);

drop policy if exists publicaciones_todo_dueno on publicaciones;
create policy publicaciones_todo_dueno on publicaciones
  for all to authenticated
  using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

-- Vista pública de publicaciones: SIN el teléfono.
drop view if exists publicaciones_publicas;
create view publicaciones_publicas with (security_invoker = false) as
  select id, usuario_id, titulo, tipo, direccion, latitud, longitud,
         precio_renta, descripcion, permite_mascotas, amueblado,
         servicios_incluidos, recamaras, fotos, vector_embedding, creado_en
  from publicaciones
  where activa = true and oculta_por_reportes = false;

revoke all on publicaciones_publicas from public;
revoke all on publicaciones_publicas from anon;
grant select on publicaciones_publicas to authenticated;

comment on view publicaciones_publicas is
  'AUD-14: security_invoker=false a propósito. `whatsapp` NO está aquí: el número se '
  'entrega solo por revelar_contacto(), que aplica cuota y deja registro.';

-- ============================================================
-- ROOMIES
-- ============================================================
drop policy if exists roomies_select_activos on roomies;
create policy roomies_select_activos on roomies
  for select to authenticated using (estado = 'activo' or auth.uid() = usuario_id);

drop policy if exists roomies_todo_dueno on roomies;
create policy roomies_todo_dueno on roomies
  for all to authenticated
  using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

-- ============================================================
-- CONVERSACIONES
-- ============================================================
drop policy if exists conversaciones_participantes on conversaciones;
create policy conversaciones_participantes on conversaciones
  for select to authenticated
  using (auth.uid() in (usuario_a, usuario_b));

drop policy if exists conversaciones_crear on conversaciones;
create policy conversaciones_crear on conversaciones
  for insert to authenticated
  with check (auth.uid() in (usuario_a, usuario_b));

-- ============================================================
-- MENSAJES
-- ============================================================
drop policy if exists mensajes_select_participantes on mensajes;
create policy mensajes_select_participantes on mensajes
  for select to authenticated using (
    exists (
      select 1 from conversaciones c
      where c.id = mensajes.conversacion_id
        and auth.uid() in (c.usuario_a, c.usuario_b)
    )
  );

drop policy if exists mensajes_insert_remitente on mensajes;
create policy mensajes_insert_remitente on mensajes
  for insert to authenticated with check (
    auth.uid() = remitente_id
    and exists (
      select 1 from conversaciones c
      where c.id = conversacion_id and auth.uid() in (c.usuario_a, c.usuario_b)
    )
  );

-- El destinatario necesita poder marcar como leído — y solo eso. Qué columnas
-- puede tocar lo impone el trigger trg_mensaje_inmutable (migración 0012),
-- porque una policy de UPDATE solo puede limitar filas.
drop policy if exists mensajes_update_leido on mensajes;
create policy mensajes_update_leido on mensajes
  for update to authenticated using (
    auth.uid() <> remitente_id
    and exists (
      select 1 from conversaciones c
      where c.id = mensajes.conversacion_id
        and auth.uid() in (c.usuario_a, c.usuario_b)
    )
  );

-- ============================================================
-- CONTACTOS
-- ============================================================
-- Sin policy de INSERT para el cliente: los crea revelar_contacto() con
-- security definer, para que nadie invente contactos falsos y le infle la
-- métrica de "contactos recibidos" a su propia publicación.
drop policy if exists contactos_select_propios on contactos;
create policy contactos_select_propios on contactos
  for select to authenticated using (auth.uid() = usuario_id);

-- El dueño de una publicación necesita ver CUÁNTOS contactos recibió, sin ver
-- quién. Eso no cabe en una policy (son filas ajenas), así que va como función.
create or replace function contactos_de_mis_publicaciones()
returns table (publicacion_id uuid, total bigint)
language sql stable security definer set search_path = public as $$
  select c.publicacion_id, count(*)
    from contactos c
    join publicaciones p on p.id = c.publicacion_id
   where p.usuario_id = auth.uid()
   group by c.publicacion_id;
$$;

revoke execute on function contactos_de_mis_publicaciones() from public;
grant execute on function contactos_de_mis_publicaciones() to authenticated;

-- ============================================================
-- NOTIFICACIONES
-- ============================================================
-- Tampoco hay INSERT para el cliente: las crean los triggers de 0011 y 0012.
drop policy if exists notificaciones_select_propias on notificaciones;
create policy notificaciones_select_propias on notificaciones
  for select to authenticated using (auth.uid() = usuario_id);

drop policy if exists notificaciones_marcar_leida on notificaciones;
create policy notificaciones_marcar_leida on notificaciones
  for update to authenticated
  using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

-- ============================================================
-- REPORTES
-- ============================================================
-- Se puede crear, nadie los lee desde el cliente — ni quien reportó.
drop policy if exists reportes_insert on reportes;
create policy reportes_insert on reportes
  for insert to authenticated with check (auth.uid() = reportado_por);
