-- Publicar y administrar un negocio · Cuervo 360 (fase 2).
--
-- Hasta aquí `negocios` era de solo lectura para el cliente (0047): los negocios de ejemplo los sembraba el servicio.
-- Ahora un COMERCIANTE APROBADO (0049) puede crear, editar y borrar su negocio y su menú, y subir las fotos.
--
-- ── Qué puede escribir el cliente, columna por columna ──────────────────────
-- Los privilegios se conceden POR COLUMNA. `destacado`, `oculto_por_reportes`, `origen`, `id`, `usuario_id` (al editar) y
-- las marcas de tiempo NO se pueden escribir desde el cliente: «destacado» lo decidirá el plan (fase 3), la ocultación
-- por reportes es moderación, y `origen` distingue lo sembrado de lo real. Una política de RLS filtra FILAS, no
-- COLUMNAS (invariante 3); el `grant` por columna es lo que cierra esto.
--
-- ── Quién ───────────────────────────────────────────────────────────────────
-- Insertar exige `tiene_rol_aprobado('comerciante')` (la regla de la 0051 para publicar, ahora para negocios). Leer,
-- editar y borrar lo propio no la exige: quien deja de estar aprobado puede seguir gestionando lo que ya tiene.
--
-- ── Tope: 1 negocio activo por cuenta (plan Básico) ─────────────────────────
-- `limite_negocios(usuario)` devuelve hoy 1; la fase de planes cambia SU CUERPO (Básico 1, Destacado más) sin tocar el
-- trigger. Se aplica en la base, con bloqueo consultivo por cuenta (como la 0041 y la 0044), y solo cuenta activar:
-- desactivar nunca sube el número. Código CP008. Productos del menú: tope de 40 por negocio, CP009.
--
-- ── Fotos ───────────────────────────────────────────────────────────────────
-- Las rutas de `fotos` deben vivir en `negocios/<id del negocio>/` (lo comprueba un trigger; ver abajo por qué no un CHECK). En Storage, subir, reemplazar y borrar bajo `negocios/<id>/` exige ser DUEÑA de ese negocio; y la dueña
-- lee sus fotos aunque el negocio esté inactivo (la política pública de la 0048 solo sirve las visibles).
--
-- Reversión:
--   drop policy if exists "negocio: subir foto propia" on storage.objects;  (y las otras tres de este archivo)
--   drop trigger if exists trg_limitar_items_negocio on negocio_items; drop trigger if exists trg_limitar_negocios on negocios;
--   drop trigger if exists trg_negocios_actualizado on negocios;
--   drop trigger if exists trg_validar_fotos_negocio on negocios;
--   drop function if exists limitar_items_negocio(), limitar_negocios(), limite_negocios(uuid), validar_fotos_negocio();
--   revoke select, insert, update, delete on negocios, negocio_items from authenticated;  (más las políticas de tablas)

-- ── Funciones auxiliares (invariante 9: nadie las ejecuta desde fuera) ──────
-- Las rutas de `fotos` deben vivir en `negocios/<id>/`. Se comprueba en un TRIGGER y no en un CHECK: un CHECK se evalúa
-- con los privilegios de quien escribe, y esta función no puede ser ejecutable por el cliente (invariante 9), así que un
-- CHECK que la llamara rechazaría TODA escritura con «permission denied». El trigger es `security definer`.
create or replace function validar_fotos_negocio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from unnest(new.fotos) r where r not like 'negocios/' || new.id::text || '/%') then
    raise exception 'ruta de foto fuera de la carpeta del negocio' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke execute on function validar_fotos_negocio() from public, anon, authenticated;

alter table negocios drop constraint if exists negocios_fotos_propias;
drop function if exists rutas_de_negocio(uuid, text[]);
drop trigger if exists trg_validar_fotos_negocio on negocios;
create trigger trg_validar_fotos_negocio
  before insert or update of fotos on negocios
  for each row execute function validar_fotos_negocio();

-- Hoy todas las cuentas tienen el plan Básico: 1 negocio activo. La fase de planes cambia este cuerpo.
create or replace function limite_negocios(p_usuario uuid)
returns integer language sql stable as $$ select 1 $$;
revoke execute on function limite_negocios(uuid) from public, anon, authenticated;

create or replace function limitar_negocios()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Solo ACTIVAR. Desactivar, o dejar activa una fila que ya lo estaba, no sube el número de activos.
  if tg_op = 'UPDATE' and not (new.activo and old.activo is distinct from true) then
    return new;
  end if;
  if new.usuario_id is null then
    return new;  -- negocios de ejemplo (sembrados): sin dueño, sin tope por cuenta
  end if;

  perform pg_advisory_xact_lock(hashtextextended('negocios:' || new.usuario_id::text, 0));

  if new.activo and (select count(*) from negocios
                      where usuario_id = new.usuario_id and activo and id <> new.id) >= limite_negocios(new.usuario_id) then
    raise exception 'limite de negocios activos alcanzado' using errcode = 'CP008';
  end if;
  return new;
end;
$$;
revoke execute on function limitar_negocios() from public, anon, authenticated;

drop trigger if exists trg_limitar_negocios on negocios;
create trigger trg_limitar_negocios
  before insert or update of activo on negocios
  for each row execute function limitar_negocios();

drop trigger if exists trg_negocios_actualizado on negocios;
create trigger trg_negocios_actualizado
  before update on negocios
  for each row execute function actualizar_timestamp();

create or replace function limitar_items_negocio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('items:' || new.negocio_id::text, 0));
  if (select count(*) from negocio_items where negocio_id = new.negocio_id) >= 40 then
    raise exception 'tope de productos del menu alcanzado' using errcode = 'CP009';
  end if;
  return new;
end;
$$;
revoke execute on function limitar_items_negocio() from public, anon, authenticated;

drop trigger if exists trg_limitar_items_negocio on negocio_items;
create trigger trg_limitar_items_negocio
  before insert on negocio_items
  for each row execute function limitar_items_negocio();

-- ── Privilegios por columna ─────────────────────────────────────────────────
grant select, delete on negocios to authenticated;
grant insert (usuario_id, categoria_id, nombre, descripcion, direccion, latitud, longitud, rango_precio, horario, fotos, activo)
  on negocios to authenticated;
grant update (categoria_id, nombre, descripcion, direccion, latitud, longitud, rango_precio, horario, fotos, activo)
  on negocios to authenticated;

grant select, delete on negocio_items to authenticated;
grant insert (negocio_id, nombre, precio, orden) on negocio_items to authenticated;
grant update (nombre, precio, orden) on negocio_items to authenticated;

-- ── Políticas de las tablas ─────────────────────────────────────────────────
drop policy if exists negocios_select_propios on negocios;
create policy negocios_select_propios on negocios
  for select to authenticated using (usuario_id = (select auth.uid()));

drop policy if exists negocios_insert_aprobado on negocios;
create policy negocios_insert_aprobado on negocios
  for insert to authenticated
  with check (usuario_id = (select auth.uid()) and tiene_rol_aprobado('comerciante'));

drop policy if exists negocios_update_dueno on negocios;
create policy negocios_update_dueno on negocios
  for update to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));

drop policy if exists negocios_delete_dueno on negocios;
create policy negocios_delete_dueno on negocios
  for delete to authenticated using (usuario_id = (select auth.uid()));

drop policy if exists items_select_dueno on negocio_items;
create policy items_select_dueno on negocio_items
  for select to authenticated
  using (exists (select 1 from negocios n where n.id = negocio_id and n.usuario_id = (select auth.uid())));

drop policy if exists items_insert_aprobado on negocio_items;
create policy items_insert_aprobado on negocio_items
  for insert to authenticated
  with check (
    tiene_rol_aprobado('comerciante')
    and exists (select 1 from negocios n where n.id = negocio_id and n.usuario_id = (select auth.uid()))
  );

drop policy if exists items_update_dueno on negocio_items;
create policy items_update_dueno on negocio_items
  for update to authenticated
  using (exists (select 1 from negocios n where n.id = negocio_id and n.usuario_id = (select auth.uid())))
  with check (exists (select 1 from negocios n where n.id = negocio_id and n.usuario_id = (select auth.uid())));

drop policy if exists items_delete_dueno on negocio_items;
create policy items_delete_dueno on negocio_items
  for delete to authenticated
  using (exists (select 1 from negocios n where n.id = negocio_id and n.usuario_id = (select auth.uid())));

-- ── Storage: las fotos del negocio ──────────────────────────────────────────
drop policy if exists "negocio: leer foto propia" on storage.objects;
create policy "negocio: leer foto propia" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'fotos' and (storage.foldername(name))[1] = 'negocios'
    and exists (select 1 from public.negocios n
                 where n.id::text = (storage.foldername(storage.objects.name))[2] and n.usuario_id = (select auth.uid()))
  );

drop policy if exists "negocio: subir foto propia" on storage.objects;
create policy "negocio: subir foto propia" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fotos' and (storage.foldername(name))[1] = 'negocios'
    and tiene_rol_aprobado('comerciante')
    and exists (select 1 from public.negocios n
                 where n.id::text = (storage.foldername(storage.objects.name))[2] and n.usuario_id = (select auth.uid()))
  );

drop policy if exists "negocio: reemplazar foto propia" on storage.objects;
create policy "negocio: reemplazar foto propia" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'fotos' and (storage.foldername(name))[1] = 'negocios'
    and exists (select 1 from public.negocios n
                 where n.id::text = (storage.foldername(storage.objects.name))[2] and n.usuario_id = (select auth.uid()))
  );

drop policy if exists "negocio: borrar foto propia" on storage.objects;
create policy "negocio: borrar foto propia" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'fotos' and (storage.foldername(name))[1] = 'negocios'
    and exists (select 1 from public.negocios n
                 where n.id::text = (storage.foldername(storage.objects.name))[2] and n.usuario_id = (select auth.uid()))
  );
