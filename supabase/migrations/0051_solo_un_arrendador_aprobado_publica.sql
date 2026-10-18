-- Solo un arrendador APROBADO puede publicar · regla en la base.
--
-- Hasta aquí «Publicar» solo se escondía en la app (`puedePublicar` en el cliente, 0043). Una regla de interfaz no es
-- una regla: cualquiera con la llave anónima y su sesión podía insertar en `publicaciones` saltándose la pantalla.
-- Ahora la política de INSERT exige `tiene_rol_aprobado('arrendador')` (0049), y la subida de fotos de una publicación,
-- lo mismo.
--
-- ── Quién no pierde nada ────────────────────────────────────────────────────
-- Las cuentas que ya publicaban recibieron la función `arrendador` aprobada con origen `migracion` en la 0043, así
-- que siguen publicando. Esa aprobación NO es una revisión y la app lo dice así (0043); aquí solo se respeta.
--
-- ── Qué NO cambia ───────────────────────────────────────────────────────────
-- Leer, editar, activar y borrar lo propio siguen igual: la política «todo para el dueño» se parte en tres (select ya
-- existía aparte) para poder pedir el rol solo al INSERT. Quien deja de estar aprobado puede seguir editando y
-- borrando lo que ya tiene; lo que se le quita es crear nuevo. (Ocultar lo excedente al vencer un plan llega con los
-- planes.)
--
-- Reversión:
--   drop policy if exists publicaciones_insert_aprobado on publicaciones;
--   drop policy if exists publicaciones_update_dueno on publicaciones;
--   drop policy if exists publicaciones_delete_dueno on publicaciones;
--   create policy publicaciones_todo_dueno on publicaciones for all to authenticated
--     using ((select auth.uid()) = usuario_id) with check ((select auth.uid()) = usuario_id);
--   (y recrear «el dueno sube fotos de sus publicaciones» como en 0002)

drop policy if exists publicaciones_todo_dueno on publicaciones;

create policy publicaciones_insert_aprobado on publicaciones
  for insert to authenticated
  with check ((select auth.uid()) = usuario_id and tiene_rol_aprobado('arrendador'));

create policy publicaciones_update_dueno on publicaciones
  for update to authenticated
  using ((select auth.uid()) = usuario_id)
  with check ((select auth.uid()) = usuario_id);

create policy publicaciones_delete_dueno on publicaciones
  for delete to authenticated
  using ((select auth.uid()) = usuario_id);

drop policy if exists "el dueno sube fotos de sus publicaciones" on storage.objects;
create policy "el dueno sube fotos de sus publicaciones" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fotos'
    and (storage.foldername(name))[1] = 'publicaciones'
    and (storage.foldername(name))[2] = auth.uid()::text
    and tiene_rol_aprobado('arrendador')
  );
