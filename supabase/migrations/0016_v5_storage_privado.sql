-- Documento maestro v5 · §14 (Supabase Storage).
--
-- v3 dejó el bucket PÚBLICO: cualquiera en internet con la URL —o adivinando el
-- patrón `perfiles/<uuid>.jpg`— lee las fotos de perfil de todo el padrón, sin
-- sesión. A partir de aquí el bucket es privado y las URLs se firman con
-- caducidad (en lote, ver src/lib/storage.ts).
--
-- Desviación consciente frente al §14: v5 propone rutas `<uid>/loquesea.jpg` y
-- aquí se conserva el layout de 0002 (`perfiles/<uid>.jpg`,
-- `publicaciones/<uid>/<pub>/<n>.jpg`). Renombrar filas de storage.objects no
-- mueve el objeto subyacente, así que un renombrado masivo desincroniza la
-- metadata del archivo real. La propiedad que importa —cada quien escribe solo
-- dentro de su propia carpeta— ya la cumplen las policies de 0002 con ese
-- layout, y es lo que se conserva.
--
-- Reversión:
--   update storage.buckets set public = true where id = 'fotos';
--   -- y recrear la policy "lectura publica de fotos" de 0002.

-- ============================================================
-- 1. El bucket deja de ser público
-- ============================================================
update storage.buckets set public = false where id = 'fotos';

drop policy if exists "lectura publica de fotos" on storage.objects;

drop policy if exists "leer fotos con sesion" on storage.objects;
create policy "leer fotos con sesion" on storage.objects
  for select to authenticated using (bucket_id = 'fotos');

-- Faltaba en 0002: sin DELETE sobre la propia foto de perfil, "quitar mi foto"
-- dejaba el objeto en el bucket para siempre.
drop policy if exists "el dueno borra su propia foto de perfil" on storage.objects;
create policy "el dueno borra su propia foto de perfil" on storage.objects
  for delete to authenticated
  using (bucket_id = 'fotos' and name = 'perfiles/' || auth.uid()::text || '.jpg');

-- ============================================================
-- 2. De URLs públicas a rutas
-- ============================================================
-- Con el bucket privado, guardar la URL pública en la base es guardar un enlace
-- roto. Lo que se guarda es la RUTA; la URL firmada se pide al mostrar.
update publicaciones
   set fotos = (
     select coalesce(array_agg(
              regexp_replace(
                regexp_replace(f, '^.*/storage/v1/object/public/fotos/', ''),
                '\?.*$', ''
              ) order by orden
            ), '{}')
       from unnest(fotos) with ordinality as t(f, orden)
   )
 where fotos is not null and array_length(fotos, 1) > 0;

update usuarios
   set foto_url = regexp_replace(
         regexp_replace(foto_url, '^.*/storage/v1/object/public/fotos/', ''),
         '\?.*$', ''
       )
 where foto_url like '%/storage/v1/object/public/fotos/%';

-- ============================================================
-- 3. AUD-10 — los archivos huérfanos
-- ============================================================
-- `on delete cascade` borra la fila de `publicaciones`. NO borra las fotos. Cada
-- publicación eliminada dejaba hasta ocho objetos en el bucket para siempre:
-- espacio que se paga, y fotos que el usuario creyó borradas y seguían
-- accesibles con una URL firmada previa.
--
-- Un borrado en cascada desde auth.users dispara este trigger por cada
-- publicación, así que la eliminación de cuenta de §29 también limpia el
-- almacenamiento. Eso no es higiene: es el derecho de cancelación cumpliéndose.
create or replace function limpiar_fotos_publicacion()
returns trigger language plpgsql security definer set search_path = public, storage as $$
begin
  if old.fotos is null or array_length(old.fotos, 1) is null then
    return old;
  end if;

  delete from storage.objects
   where bucket_id = 'fotos'
     and name = any (old.fotos);
  return old;
end;
$$;

drop trigger if exists trg_limpiar_fotos on publicaciones;
create trigger trg_limpiar_fotos
  after delete on publicaciones
  for each row execute function limpiar_fotos_publicacion();
