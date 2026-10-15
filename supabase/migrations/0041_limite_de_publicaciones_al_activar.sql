-- El tope de 15 publicaciones activas también se aplica al ACTIVAR.
--
-- `trg_limitar_publicaciones` (0010, redefinido en la 0032) era BEFORE INSERT y
-- contaba solo las filas activas. Un `update ... set activa = true` no pasaba por
-- él, y de ahí salían dos defectos:
--
--   · SE SALTABA CON LA API. Con 14 activas, un cliente podía insertar filas
--     INACTIVAS —que el tope no cuenta— y activarlas con updates. Medido en pgTAP
--     antes de esta migración: 14 activas + 2 activaciones = 16 activas.
--   · REACTIVAR NO ESTABA LIMITADO, aunque `publicaciones.tsx` (AUD-26) afirma que
--     «el límite de 15 activas por cuenta se aplica al reactivar igual que al
--     crear». Con 15 activas y una inactiva vieja, reactivarla daba 16. La rama de
--     la app que explica el límite al reactivar no se podía alcanzar nunca.
--
-- ── Qué cambia ──────────────────────────────────────────────────────────────
-- El trigger pasa a `before insert or update of activa` y su función distingue:
--
--   · INSERT: igual que antes. Cuenta las activas YA existentes y rechaza con 15,
--     sea la fila nueva activa o no. Esto importa a la app: `crearPublicacion` (el
--     arreglo del hallazgo 6) inserta la fila INACTIVA y la activa al final; con el
--     tope lleno debe fallar aquí, ANTES de subir fotos, y no al activar.
--   · UPDATE: solo cuando la fila PASA de no activa a activa. Cuenta las demás
--     activas de la cuenta y rechaza con 15. Desactivar nunca se rechaza, y un
--     update que deja `activa = true` en una fila que ya lo estaba no cuenta como
--     activar.
--
-- Mismo código que el insert, CP002: la app ya lo reconoce por código (END-27).
--
-- ── Carreras ────────────────────────────────────────────────────────────────
-- Dos peticiones paralelas de la misma cuenta, ambas con 14 activas, ven 14 las
-- dos y activan las dos: 16. El bloqueo consultivo por cuenta las serializa; se
-- libera solo al terminar la transacción.
--
-- ── Lo que NO cambia ────────────────────────────────────────────────────────
-- La función es `security invoker` como antes: cuenta con la identidad de quien
-- escribe, y `publicaciones_select_propias` le deja ver sus filas. No añade ni
-- abre ninguna función (la aserción 75 sigue valiendo), y `create or replace
-- trigger` sustituye el trigger sin que deje de existir en ningún momento.
--
-- ── Lo que NO resuelve ──────────────────────────────────────────────────────
-- Las filas INACTIVAS no tienen tope: una cuenta puede acumularlas sin límite, cada
-- una con hasta ocho fotos. Es un riesgo de almacenamiento distinto, y queda fuera.
--
-- Reversión: volver a la definición de la 0032 y al trigger solo de insert.
--   create or replace function limitar_publicaciones() returns trigger
--   language plpgsql as $f$ begin
--     if (select count(*) from publicaciones
--          where usuario_id = new.usuario_id and activa) >= 15 then
--       raise exception 'límite de publicaciones activas alcanzado' using errcode = 'CP002';
--     end if; return new; end; $f$;
--   create or replace trigger trg_limitar_publicaciones
--     before insert on publicaciones
--     for each row execute function limitar_publicaciones();

create or replace function limitar_publicaciones()
returns trigger language plpgsql as $$
begin
  -- Solo activar cuenta. Desactivar, o dejar activa una fila que ya lo estaba, no
  -- puede subir el número de activas y no se comprueba.
  if tg_op = 'UPDATE' and not (new.activa and old.activa is distinct from true) then
    return new;
  end if;

  -- Serializa las escrituras de la MISMA cuenta que llegan a la vez; sin esto, dos
  -- peticiones paralelas con 14 activas pasan las dos.
  perform pg_advisory_xact_lock(hashtextextended(new.usuario_id::text, 0));

  -- En un UPDATE la fila de `new` todavía figura como inactiva en la tabla, así que
  -- no se cuenta a sí misma; `id <> new.id` lo deja explícito.
  if (select count(*) from publicaciones
       where usuario_id = new.usuario_id and activa and id <> new.id) >= 15 then
    raise exception 'límite de publicaciones activas alcanzado'
      using errcode = 'CP002';
  end if;
  return new;
end;
$$;

-- Invariante 9: la función ya existía con su ACL cerrada, pero se declara por
-- nombre. Un trigger no necesita EXECUTE concedido para dispararse.
revoke execute on function limitar_publicaciones() from public, anon, authenticated;

create or replace trigger trg_limitar_publicaciones
  before insert or update of activa on publicaciones
  for each row execute function limitar_publicaciones();
