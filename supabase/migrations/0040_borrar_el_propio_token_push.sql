-- Poder borrar el PROPIO token push, para quitarlo al cerrar sesión.
--
-- `push_tokens` tenía policies de select, insert y update y ninguna de delete.
-- `authenticated` sí tiene el privilegio DELETE a nivel de tabla (la concesión
-- por omisión de Supabase), así que un `delete` no daba error: afectaba CERO
-- filas, en silencio. Es el mismo modo de fallo de siempre con RLS.
--
-- Consecuencia: al cerrar sesión el token del teléfono seguía ligado a la cuenta
-- anterior. `crear_notificacion_mensaje` manda el push al token guardado para
-- ese usuario, así que los mensajes de la cuenta que ya salió —con los primeros
-- 100 caracteres del texto— seguían llegando a un teléfono que otra persona ya
-- estaba usando.
--
-- ── Lo que añade y lo que NO ────────────────────────────────────────────────
-- Una sola policy, solo para `authenticated`, y solo sobre la fila propia. No
-- toca el privilegio de tabla (ya existía) ni las otras tres policies, y no abre
-- ninguna función: no hay nada que añadir a la lista blanca de la aserción 75.
--
-- Mismo patrón que la 0038: `(select auth.uid())` para que se evalúe una sola
-- vez por consulta y no una por fila.
--
-- ── Verificación ────────────────────────────────────────────────────────────
-- Aserciones 87 a 89 de `supabase/tests/rls.test.sql`: A borra el suyo, A no
-- puede borrar el de B ni con un `delete` sin `where`.
--   npx supabase test db
--
-- Reversión:
--   drop policy if exists "solo el dueno borra su token push" on push_tokens;

drop policy if exists "solo el dueno borra su token push" on push_tokens;

create policy "solo el dueno borra su token push" on push_tokens
  for delete to authenticated
  using ((select auth.uid()) = usuario_id);
