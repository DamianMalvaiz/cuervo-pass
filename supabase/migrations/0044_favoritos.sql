-- Favoritos · Cuervo 360.
--
-- Una cuenta guarda las publicaciones (depas y cuartos) que le interesan para volver a ellas.
-- Los negocios se suman cuando existan, en otra migración: no se adivina hoy la forma de una
-- tabla que todavía no está.
--
-- ── Un favorito es PRIVADO ──────────────────────────────────────────────────
-- Solo su dueña lo lee. Nadie —ni el dueño de la publicación— ve cuántos favoritos tiene ni
-- quién la guardó: es una señal de interés personal y no hay razón para publicarla. RLS acota
-- las filas a las propias, y los privilegios se cierran además (0036): sin `update` (un favorito
-- se guarda o se quita; no hay nada que editar) ni `truncate`.
--
-- ── Solo se puede guardar lo VISIBLE ────────────────────────────────────────
-- La policy de insert exige que la publicación aparezca en `publicaciones_publicas` (activa y
-- sin ocultar por reportes). Importa por dos razones:
--
--   · No se guarda lo que nadie puede ver.
--   · NO HAY SONDA. Sin esta condición, el error de clave foránea (23503) distinguiría una
--     publicación que no existe de una que existe pero está oculta, y guardar serviría para
--     averiguar qué publicaciones fueron reportadas. Con ella, las dos dan el mismo 42501.
--
-- ── Tope: 200 por cuenta ────────────────────────────────────────────────────
-- Sin tope, una cuenta acumula filas sin límite (mismo riesgo de almacenamiento que dejó abierto
-- la 0041 con las publicaciones inactivas). Se aplica en la base y no en el cliente (invariante
-- 6), con bloqueo consultivo por cuenta para que dos peticiones paralelas con 199 no pasen las
-- dos. Código propio CP004, junto a CP001 a CP003: la app lo lee por código (END-27).
--
-- ── Qué pasa cuando una publicación deja de ser visible ─────────────────────
-- La fila del favorito se CONSERVA: si el dueño la reactiva, vuelve a aparecer. La app lee las
-- publicaciones por la vista pública, así que las ocultas desaparecen de la lista sin filtrarse,
-- y puede decir cuántas ya no están disponibles. Borrar la publicación o la cuenta borra sus
-- favoritos en cascada (`eliminar-cuenta` borra auth.users y todo cae).
--
-- Reversión:
--   drop trigger if exists trg_limitar_favoritos on favoritos;
--   drop function if exists limitar_favoritos();
--   drop table if exists favoritos;

create table if not exists favoritos (
  usuario_id     uuid not null references usuarios(id) on delete cascade,
  publicacion_id uuid not null references publicaciones(id) on delete cascade,
  creado_en      timestamptz not null default now(),
  primary key (usuario_id, publicacion_id)
);

-- La clave primaria cubre las búsquedas por cuenta; este índice cubre el borrado en cascada
-- cuando se elimina una publicación (si no, cada borrado recorrería la tabla entera).
create index if not exists favoritos_publicacion_idx on favoritos (publicacion_id);

alter table favoritos enable row level security;

-- Privilegios cerrados: Supabase concede todo a anon y authenticated por defecto (0036).
revoke all on favoritos from public, anon, authenticated;
grant select, insert, delete on favoritos to authenticated;

drop policy if exists favoritos_select_propios on favoritos;
create policy favoritos_select_propios on favoritos
  for select to authenticated
  using (usuario_id = (select auth.uid()));

drop policy if exists favoritos_insert_propios on favoritos;
create policy favoritos_insert_propios on favoritos
  for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    and exists (select 1 from publicaciones_publicas p where p.id = publicacion_id)
  );

drop policy if exists favoritos_delete_propios on favoritos;
create policy favoritos_delete_propios on favoritos
  for delete to authenticated
  using (usuario_id = (select auth.uid()));

-- El tope. `security invoker` como `limitar_publicaciones`: cuenta con la identidad de quien
-- escribe, y la policy de select le deja ver sus filas.
create or replace function limitar_favoritos()
returns trigger language plpgsql as $$
begin
  -- Serializa las escrituras de la MISMA cuenta que llegan a la vez.
  perform pg_advisory_xact_lock(hashtextextended('favoritos:' || new.usuario_id::text, 0));

  if (select count(*) from favoritos where usuario_id = new.usuario_id) >= 200 then
    raise exception 'tope de favoritos alcanzado'
      using errcode = 'CP004';
  end if;
  return new;
end;
$$;

-- Invariante 9: un trigger no necesita EXECUTE concedido para dispararse, y concederlo lo
-- volvería una RPC. Se declara por nombre.
revoke execute on function limitar_favoritos() from public, anon, authenticated;

create or replace trigger trg_limitar_favoritos
  before insert on favoritos
  for each row execute function limitar_favoritos();
