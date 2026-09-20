-- «Auth RLS Initialization Plan» · Security Advisor de Supabase, 20/09/2026.
--
-- Con `auth.uid()` suelto dentro de un USING, Postgres lo trata como volátil y
-- lo evalúa UNA VEZ POR FILA. Envuelto en `(select auth.uid())` se convierte en
-- un InitPlan: se calcula una sola vez y el filtro compara contra su resultado.
--
-- MEDIDO, no citado. Mismo dato, misma policy, 50 000 filas, en esta base:
--
--   using (dueno = auth.uid())            94.16 ms   Seq Scan + filtro por fila
--   using (dueno = (select auth.uid()))   12.32 ms   InitPlan 1 · Result
--
-- 7.6x. Conviene decir también lo que NO es: con las 114 publicaciones de hoy la
-- diferencia son décimas de milisegundo. Lo que importa es que el coste crece
-- LINEAL con las filas, y `mensajes` es la tabla que más va a crecer — un chat
-- activo de un semestre son miles de filas por conversación.
--
-- ── Por qué `alter policy` y no `drop` + `create` ───────────────────────────
-- Un `drop` deja la tabla SIN esa policy hasta que el `create` corre. Dentro de
-- una transacción nadie más lo ve, pero si algo falla a mitad y la migración se
-- aplica parcialmente, el estado intermedio de una tabla con RLS es «nadie ve
-- nada» o —peor, con otra policy permisiva— «se ve de más». `alter policy`
-- sustituye la expresión sin que la policy deje de existir en ningún momento.
--
-- ── Lo que NO cambia ────────────────────────────────────────────────────────
-- Ni una sola condición. `(select auth.uid())` devuelve exactamente lo mismo que
-- `auth.uid()`; lo único que cambia es CUÁNTAS VECES se calcula. La aserción 83
-- comprueba la forma, y las 82 anteriores más las 19 barreras contra producción
-- comprueban que el comportamiento es idéntico.
--
-- Reversión: `alter policy` de vuelta quitando el `select` de cada expresión.

-- ── contactos ──────────────────────────────────────────────────────────────
alter policy contactos_select_propios on contactos
  using ((select auth.uid()) = usuario_id);

-- ── conversaciones ─────────────────────────────────────────────────────────
alter policy conversaciones_crear on conversaciones
  with check (((select auth.uid()) = usuario_a) or ((select auth.uid()) = usuario_b));

alter policy conversaciones_participantes on conversaciones
  using (((select auth.uid()) = usuario_a) or ((select auth.uid()) = usuario_b));

-- ── mensajes ───────────────────────────────────────────────────────────────
alter policy mensajes_insert_remitente on mensajes
  with check (
    ((select auth.uid()) = remitente_id)
    and exists (
      select 1 from conversaciones c
       where c.id = mensajes.conversacion_id
         and (((select auth.uid()) = c.usuario_a) or ((select auth.uid()) = c.usuario_b))
    )
  );

alter policy mensajes_select_participantes on mensajes
  using (
    exists (
      select 1 from conversaciones c
       where c.id = mensajes.conversacion_id
         and (((select auth.uid()) = c.usuario_a) or ((select auth.uid()) = c.usuario_b))
    )
  );

-- El `<>` se conserva tal cual: es lo que impide marcar como leídos los mensajes
-- PROPIOS, y sin él el contador de no leídos se vaciaría solo.
alter policy mensajes_update_leido on mensajes
  using (
    ((select auth.uid()) <> remitente_id)
    and exists (
      select 1 from conversaciones c
       where c.id = mensajes.conversacion_id
         and (((select auth.uid()) = c.usuario_a) or ((select auth.uid()) = c.usuario_b))
    )
  );

-- ── notificaciones ─────────────────────────────────────────────────────────
alter policy notificaciones_marcar_leida on notificaciones
  using ((select auth.uid()) = usuario_id)
  with check ((select auth.uid()) = usuario_id);

alter policy notificaciones_select_propias on notificaciones
  using ((select auth.uid()) = usuario_id);

-- ── publicaciones ──────────────────────────────────────────────────────────
alter policy publicaciones_select_propias on publicaciones
  using ((select auth.uid()) = usuario_id);

alter policy publicaciones_todo_dueno on publicaciones
  using ((select auth.uid()) = usuario_id)
  with check ((select auth.uid()) = usuario_id);

-- ── push_tokens ────────────────────────────────────────────────────────────
alter policy "solo el dueno actualiza su token push" on push_tokens
  using ((select auth.uid()) = usuario_id);

alter policy "solo el dueno registra su token push" on push_tokens
  with check ((select auth.uid()) = usuario_id);

alter policy "solo el dueno ve su token push" on push_tokens
  using ((select auth.uid()) = usuario_id);

-- ── reportes ───────────────────────────────────────────────────────────────
alter policy reportes_insert on reportes
  with check ((select auth.uid()) = reportado_por);

-- ── roomies ────────────────────────────────────────────────────────────────
alter policy roomies_select_propio on roomies
  using ((select auth.uid()) = usuario_id);

alter policy roomies_todo_dueno on roomies
  using ((select auth.uid()) = usuario_id)
  with check ((select auth.uid()) = usuario_id);

-- ── usuarios ───────────────────────────────────────────────────────────────
alter policy usuarios_insert_propio on usuarios
  with check ((select auth.uid()) = id);

alter policy usuarios_select_propio on usuarios
  using ((select auth.uid()) = id);

alter policy usuarios_update_propio on usuarios
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
