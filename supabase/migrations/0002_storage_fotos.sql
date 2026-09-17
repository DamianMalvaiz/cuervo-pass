-- Cuervo Pass — bucket de Storage para fotos de perfil y de publicaciones.
-- Corre esto en el SQL Editor de Supabase (igual que 0001_esquema_inicial.sql).
--
-- Estructura de rutas dentro del bucket "fotos":
--   perfiles/<user_id>.jpg              — foto de perfil (Semana 2)
--   publicaciones/<user_id>/<uuid>.jpg  — fotos de departamentos (Semana 3)
--
-- Lectura pública (las fotos se muestran a cualquier usuario logueado en la
-- app), escritura solo dentro de la propia carpeta <user_id> — mismo patrón
-- de "el dueño gestiona lo suyo" que ya usamos en las policies de la sección 8.

insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do nothing;

create policy "lectura publica de fotos" on storage.objects
  for select using (bucket_id = 'fotos');

create policy "el dueno sube su propia foto de perfil" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fotos'
    and name = 'perfiles/' || auth.uid()::text || '.jpg'
  );

create policy "el dueno reemplaza su propia foto de perfil" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'fotos'
    and name = 'perfiles/' || auth.uid()::text || '.jpg'
  );

create policy "el dueno sube fotos de sus publicaciones" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fotos'
    and (storage.foldername(name))[1] = 'publicaciones'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "el dueno borra fotos de sus publicaciones" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'fotos'
    and (storage.foldername(name))[1] = 'publicaciones'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
