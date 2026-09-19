-- Documento maestro v5 · §25 · corrige un fallo de la 0013.
--
-- EL FALLO: "Ver contacto" estaba roto para todos los usuarios.
--
--   ERROR 42P10: there is no unique or exclusion constraint matching the
--                ON CONFLICT specification
--
-- `revelar_contacto` termina con:
--
--   insert into contactos (...) values (...)
--   on conflict (usuario_id, publicacion_id) do nothing;
--
-- y el índice que debería respaldarlo, creado en la propia 0013, es PARCIAL:
--
--   create unique index contactos_unico_publicacion
--     on contactos (usuario_id, publicacion_id) where publicacion_id is not null;
--
-- PostgreSQL no infiere un índice parcial a partir de la lista de columnas: para
-- usarlo hay que repetir su predicado en la cláusula. Sin eso no encuentra
-- ninguna restricción que coincida y aborta la función ENTERA — así que el
-- teléfono nunca se devolvía, la cuota nunca se consumía y no quedaba registro
-- del contacto. En la app se veía como "No pudimos obtener el contacto".
--
-- El índice es parcial a propósito: `contactos` sirve tanto a publicaciones como
-- a roomies, y una fila solo tiene una de las dos referencias. Un índice
-- completo sobre (usuario_id, publicacion_id) trataría todos los contactos de
-- roomie como duplicados entre sí, porque su publicacion_id es null.
--
-- Por qué una migración nueva y no editar la 0013: ya está aplicada y su hash
-- vive en supabase_migrations.schema_migrations. Editarla haría que el historial
-- dejara de describir lo que realmente corrió.
--
-- Reversión: volver a crear la función con el `on conflict` sin predicado —
-- aunque eso es exactamente el fallo, así que no hay razón para hacerlo.

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
  -- El predicado REPETIDO es lo que permite a Postgres inferir el índice
  -- parcial. Sin él: 42P10, y la función entera falla.
  on conflict (usuario_id, publicacion_id) where publicacion_id is not null
  do nothing;   -- no infla la métrica

  return v_whatsapp;
end;
$$;

revoke execute on function revelar_contacto(uuid, numeric) from public;
grant execute on function revelar_contacto(uuid, numeric) to authenticated;
