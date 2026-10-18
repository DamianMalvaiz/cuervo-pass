-- Lectura de las fotos de los negocios de Servicios · Cuervo 360.
--
-- La 0022 cerró la lectura del bucket `fotos` por rutas: `perfiles/` y `publicaciones/`. Las fotos de los
-- negocios (`negocios/<id>/<n>.jpg`, 0047) quedaron sin ninguna política de SELECT, así que firmar su URL desde la
-- app fallaba para todo el mundo y la lista de Servicios se veía sin fotos. Se detectó al preparar la prueba en el
-- teléfono, no en una prueba automática: la 0047 probaba las tablas y las vistas, no el bucket.
--
-- La regla se DERIVA de `negocios_publicos` y no se reescribe (como en la 0022): un negocio inactivo o oculto por
-- reportes no sirve su foto. Duplicar la condición en dos sitios garantiza que algún día cambie en uno solo.
--
-- Solo SELECT. Subir, reemplazar y borrar fotos de negocios llega con la publicación de negocios y su dueño.
--
-- Reversión:
--   drop policy if exists "leer foto de negocio visible" on storage.objects;

drop policy if exists "leer foto de negocio visible" on storage.objects;
create policy "leer foto de negocio visible" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'fotos'
    and (storage.foldername(name))[1] = 'negocios'
    and exists (
      select 1 from public.negocios_publicos n
       where n.id::text = (storage.foldername(storage.objects.name))[2]
    )
  );

comment on policy "leer foto de negocio visible" on storage.objects is
  'La visibilidad del objeto se deriva de negocios_publicos (activo y sin ocultar por reportes).';
