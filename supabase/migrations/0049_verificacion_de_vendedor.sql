-- Verificación de vendedor · Cuervo 360 (comerciante y arrendador).
--
-- Quien quiere publicar un negocio o un inmueble entrega una prueba de quién es: INE (frente y reverso), nombre legal,
-- dirección y fotos del local o del inmueble. Un admin la revisa A MANO y la aprueba o la rechaza. Hasta entonces la
-- función existe pero no da acceso (0043). Esta migración pone la base: dónde vive la evidencia, cómo se envía, cómo se
-- resuelve y quién puede verla. El borrado programado de la INE y la regla de «solo un vendedor aprobado publica»
-- llegan en migraciones siguientes.
--
-- ── Una sola fuente de verdad para el estado ────────────────────────────────
-- El estado de una verificación vive en `roles_usuario.estado` (sin_verificar → pendiente → aprobado | rechazado) y NO
-- se copia aquí: un segundo lugar donde vive un dato que ya existe es el defecto que la 0026 evitó con el correo. Esta
-- tabla guarda la EVIDENCIA y el rastro de la revisión (quién, cuándo, por qué), no el estado.
--
-- ── La evidencia es lo más sensible de la base ──────────────────────────────
-- · Bucket PRIVADO propio (`verificacion`), separado de `fotos`: ninguna política de lectura de fotos puede abrirlo por
--   descuido. Solo la dueña sube y lee lo suyo; nadie actualiza ni borra desde el cliente (lo borra el servicio).
--   Tamaño y tipos acotados en el propio bucket.
-- · La tabla se cierra: la dueña solo LEE su fila; escribir pasa por funciones. Un admin la ve desde el Dashboard
--   (service_role); no hay una policy de «admin lee todo» que algún día se pueda suplantar.
-- · Las rutas guardadas deben estar DENTRO de la carpeta de la propia cuenta (`<usuario>/...`): sin esa condición una
--   cuenta podría apuntar su verificación a un archivo ajeno.
-- · El consentimiento se registra con la hora del SERVIDOR y la versión del aviso que se aceptó.
--
-- ── Funciones (invariante 9: revoke explícito por nombre) ───────────────────
-- · enviar_verificacion(...)  → la dueña. Solo si la función está sin_verificar o rechazada. Pasa a pendiente.
-- · resolver_verificacion(...) → SOLO service_role (Dashboard o script). Exige un admin aprobado como responsable: el
--   «quién aprobó» queda escrito. Al aprobar fija cuándo se borra la INE: 30 días después.
-- · tiene_rol_aprobado(rol)   → la regla que usan las políticas y la app para decidir si alguien puede publicar.
--
-- Códigos propios, junto a CP001 a CP004: CP005 (no se puede enviar), CP006 (falta el motivo de un rechazo), CP007 (el
-- responsable no es un admin aprobado).
--
-- Reversión:
--   drop function if exists verif_rutas_propias(uuid, text[]), tiene_rol_aprobado(text), resolver_verificacion(uuid, text, boolean, text, uuid),
--     enviar_verificacion(text, text, text, text, text, text[], text);
--   drop policy if exists "verificacion: subir lo propio" on storage.objects;
--   drop policy if exists "verificacion: leer lo propio" on storage.objects;
--   delete from storage.buckets where id = 'verificacion';   -- vacío el bucket antes
--   drop table if exists verificaciones_vendedor;

-- Un CHECK no admite subconsultas, así que la comprobación «todas las rutas empiezan por la carpeta de la cuenta» vive
-- en una función inmutable. Nadie la ejecuta desde fuera (invariante 9): la llama la tabla y las funciones de abajo.
create or replace function verif_rutas_propias(p_uid uuid, p_rutas text[])
returns boolean language sql immutable as $$
  select coalesce(bool_and(r like p_uid::text || '/%'), false) from unnest(p_rutas) r;
$$;
revoke execute on function verif_rutas_propias(uuid, text[]) from public, anon, authenticated;

create table if not exists verificaciones_vendedor (
  usuario_id        uuid not null,
  rol               text not null check (rol in ('comerciante', 'arrendador')),
  nombre_legal      text not null check (char_length(nombre_legal) between 3 and 120),
  direccion         text not null check (char_length(direccion) between 5 and 200),
  ine_frente        text not null,
  ine_reverso       text not null,
  -- Fotos del local o del inmueble. Al menos una.
  fotos             text[] not null check (cardinality(fotos) between 1 and 6),
  consentimiento_en timestamptz not null default now(),
  version_aviso     text not null check (char_length(version_aviso) between 1 and 20),
  enviada_en        timestamptz not null default now(),
  revisada_en       timestamptz,
  revisada_por      uuid references usuarios(id) on delete set null,
  motivo_rechazo    text check (char_length(motivo_rechazo) <= 400),
  -- Se fija al aprobar (30 días). La INE se borra cuando llega esa fecha; el estado «verificado» y quién aprobó se quedan.
  ine_borrar_en     timestamptz,
  ine_borrada_en    timestamptz,
  primary key (usuario_id, rol),
  foreign key (usuario_id, rol) references roles_usuario(usuario_id, rol) on delete cascade,
  -- Las rutas, dentro de la carpeta de la propia cuenta.
  constraint verif_rutas_propias check (
    verif_rutas_propias(usuario_id, array[ine_frente, ine_reverso] || fotos)
  )
);

alter table verificaciones_vendedor enable row level security;
revoke all on verificaciones_vendedor from public, anon, authenticated;
grant select on verificaciones_vendedor to authenticated;

drop policy if exists verif_select_propia on verificaciones_vendedor;
create policy verif_select_propia on verificaciones_vendedor
  for select to authenticated
  using (usuario_id = (select auth.uid()));

-- ── Bucket privado ──────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('verificacion', 'verificacion', false, 6291456, array['image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "verificacion: subir lo propio" on storage.objects;
create policy "verificacion: subir lo propio" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'verificacion' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "verificacion: leer lo propio" on storage.objects;
create policy "verificacion: leer lo propio" on storage.objects
  for select to authenticated
  using (bucket_id = 'verificacion' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ── Enviar ──────────────────────────────────────────────────────────────────
create or replace function enviar_verificacion(
  p_rol text, p_nombre_legal text, p_direccion text,
  p_ine_frente text, p_ine_reverso text, p_fotos text[], p_version_aviso text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_estado text;
begin
  if v_uid is null then
    raise exception 'sin sesion' using errcode = '28000';
  end if;

  select estado into v_estado from roles_usuario where usuario_id = v_uid and rol = p_rol;
  -- Sin la función, o con la verificación ya pendiente o aprobada, no hay nada que enviar. Un mismo código para los tres:
  -- no sirve para averiguar el estado de otra cuenta (aquí solo se mira la propia, pero no se distingue de más).
  if v_estado is null or v_estado not in ('sin_verificar', 'rechazado') then
    raise exception 'verificacion no enviable' using errcode = 'CP005';
  end if;

  insert into verificaciones_vendedor
    (usuario_id, rol, nombre_legal, direccion, ine_frente, ine_reverso, fotos, version_aviso)
  values
    (v_uid, p_rol, p_nombre_legal, p_direccion, p_ine_frente, p_ine_reverso, p_fotos, p_version_aviso)
  on conflict (usuario_id, rol) do update set
    nombre_legal = excluded.nombre_legal, direccion = excluded.direccion,
    ine_frente = excluded.ine_frente, ine_reverso = excluded.ine_reverso, fotos = excluded.fotos,
    version_aviso = excluded.version_aviso, consentimiento_en = now(), enviada_en = now(),
    revisada_en = null, revisada_por = null, motivo_rechazo = null, ine_borrar_en = null, ine_borrada_en = null;

  update roles_usuario set estado = 'pendiente' where usuario_id = v_uid and rol = p_rol;
end;
$$;

revoke execute on function enviar_verificacion(text, text, text, text, text, text[], text) from public, anon, authenticated;
grant execute on function enviar_verificacion(text, text, text, text, text, text[], text) to authenticated;

-- ── Resolver (solo servicio) ────────────────────────────────────────────────
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
  -- El responsable debe ser un admin APROBADO: «quién aprobó» queda escrito y no es un uuid cualquiera.
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

-- ── La regla ────────────────────────────────────────────────────────────────
create or replace function tiene_rol_aprobado(p_rol text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from roles_usuario
     where usuario_id = (select auth.uid()) and rol = p_rol and estado = 'aprobado'
  );
$$;

revoke execute on function tiene_rol_aprobado(text) from public, anon, authenticated;
grant execute on function tiene_rol_aprobado(text) to authenticated;
