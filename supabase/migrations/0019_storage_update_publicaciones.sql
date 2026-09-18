-- Documento maestro v5 · §14 · corrige una omisión de 0002.
--
-- El bug: `subirFotoPublicacion` en src/lib/storage.ts sube con `upsert: true`,
-- y su comentario dice "re-subir el mismo índice la reemplaza". Pero un upsert
-- sobre un objeto que YA existe es un UPDATE, y la 0002 solo creó policies de
-- INSERT y DELETE para `publicaciones/<uid>/...`. Nunca hubo una de UPDATE.
--
-- Consecuencia: editar una publicación y cambiar la foto de una posición que ya
-- tenía imagen falla con error de RLS. Subir una foto nueva funciona (INSERT) y
-- borrar funciona (DELETE); reemplazar, no. Es el caso que menos se prueba y el
-- que más se usa después de publicar.
--
-- Por qué una migración nueva y no arreglar la 0002: la 0002 ya está aplicada en
-- producción y su hash está en `supabase_migrations.schema_migrations`. Editarla
-- haría que el historial dejara de describir lo que realmente corrió.
--
-- Reversión:
--   drop policy if exists "el dueno reemplaza fotos de sus publicaciones" on storage.objects;

-- USING decide qué filas puede tocar; WITH CHECK, cómo pueden quedar. Se
-- escriben las dos aunque Postgres copiaría USING en WITH CHECK si se omitiera:
-- sin el WITH CHECK explícito, la policy dice "puedes modificar tus objetos"
-- pero no dice "y tienen que seguir siendo tuyos después", y eso es justo lo que
-- se quiere garantizar al renombrar un objeto.
drop policy if exists "el dueno reemplaza fotos de sus publicaciones" on storage.objects;
create policy "el dueno reemplaza fotos de sus publicaciones" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'fotos'
    and (storage.foldername(name))[1] = 'publicaciones'
    and (storage.foldername(name))[2] = auth.uid()::text
  )
  with check (
    bucket_id = 'fotos'
    and (storage.foldername(name))[1] = 'publicaciones'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- La de perfil (0002) tampoco declaraba WITH CHECK. Ahí Postgres sí lo deriva de
-- USING y el efecto es el correcto, pero se reescribe explícita para que las dos
-- se lean igual: una policy cuyo comportamiento depende de un valor por omisión
-- es una policy que alguien va a leer mal.
drop policy if exists "el dueno reemplaza su propia foto de perfil" on storage.objects;
create policy "el dueno reemplaza su propia foto de perfil" on storage.objects
  for update to authenticated
  using (bucket_id = 'fotos' and name = 'perfiles/' || auth.uid()::text || '.jpg')
  with check (bucket_id = 'fotos' and name = 'perfiles/' || auth.uid()::text || '.jpg');
