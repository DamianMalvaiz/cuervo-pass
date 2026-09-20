-- END-15 · La cola de geocodificación no existía.
--
-- `supabase/functions/geocodificar/index.ts` afirmaba en su encabezado que se
-- geocodifica «desde el SERVIDOR, en cola, nunca desde el cliente», y lo
-- presentaba como una de las tres obligaciones que la licencia ODbL impone a
-- cambio de permitir ALMACENAR las coordenadas.
--
-- No había cola ni límite de ritmo. Solo caché. La única serialización vivía en
-- un `for` de `publicaciones.service.ts` que además no esperaba nada entre
-- vueltas: iba tan rápido como respondiera cada ida y vuelta. Y aunque hubiera
-- esperado, dos teléfonos publicando a la vez habrían duplicado el ritmo, porque
-- todas las peticiones salen de la IP de Supabase y Nominatim las ve como una
-- sola fuente. Una obligación de licencia que depende de que cada cliente se
-- porte bien no es una obligación cumplida: es una intención.
--
-- ── Por qué un turno y no un `pg_sleep` ──────────────────────────────────────
-- La forma obvia es `select ... for update` y dormir dentro de la transacción
-- hasta que toque. Funciona y es fácil de leer, pero retiene una conexión de la
-- base durante toda la espera, y con diez publicaciones simultáneas retiene diez
-- conexiones de un pool que también sirve a la app.
--
-- Aquí la base solo REPARTE el turno —una escritura atómica, sin bloqueo
-- sostenido— y devuelve cuántos milisegundos faltan. Quien espera es la Edge
-- Function, que para eso es efímera y no cuesta nada mientras duerme. El
-- `greatest(now(), proximo_turno + 1s)` es lo que hace que dos llamadas en el
-- mismo milisegundo reciban turnos distintos en vez del mismo.
--
-- ── Cuota ───────────────────────────────────────────────────────────────────
-- La geocodificación era la única Edge Function sin `consumir_cuota`. Se le
-- añade el recurso al CHECK de `cuotas_uso`; el límite (40/día) lo aplica la
-- función, no esta migración.
--
-- Reversión:
--   drop function if exists reservar_turno_geocodificacion();
--   drop table if exists geocodificaciones_ritmo;
--   alter table cuotas_uso drop constraint cuotas_uso_recurso_check;
--   alter table cuotas_uso add constraint cuotas_uso_recurso_check
--     check (recurso in ('revelar_contacto','parseo_llm','embedding'));

-- ── 1 · el recurso nuevo ────────────────────────────────────────────────────
-- Se nombra la constraint explícitamente en vez de confiar en el nombre que
-- Postgres generó: un `drop constraint` sobre un nombre adivinado falla, y el
-- invariante 6 lo pide por escrito.
alter table cuotas_uso drop constraint if exists cuotas_uso_recurso_check;
alter table cuotas_uso add constraint cuotas_uso_recurso_check
  check (recurso in ('revelar_contacto','parseo_llm','embedding','geocodificacion'));

-- ── 2 · el repartidor de turnos ─────────────────────────────────────────────
-- Una sola fila, y el esquema lo garantiza: la clave primaria es booleana y el
-- CHECK solo admite `true`, así que no hay forma de insertar una segunda. Un
-- limitador de ritmo con dos filas no limita nada.
create table if not exists geocodificaciones_ritmo (
  unica         boolean primary key default true check (unica),
  proximo_turno timestamptz not null default now()
);

insert into geocodificaciones_ritmo (unica) values (true) on conflict do nothing;

-- Sin policies, igual que `cuotas_uso`: es una tabla de servicio. Con RLS activo
-- y cero policies nadie la lee ni la escribe desde el cliente.
alter table geocodificaciones_ritmo enable row level security;

create or replace function reservar_turno_geocodificacion()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_turno timestamptz;
begin
  -- Un solo `update ... returning`: es atómico, así que dos llamadas
  -- simultáneas se serializan en el bloqueo de fila y salen con turnos
  -- distintos. Leer primero y escribir después, con la lectura fuera del
  -- bloqueo, es la versión rota de esto mismo: las dos leerían el mismo valor.
  update geocodificaciones_ritmo
     set proximo_turno = greatest(now(), proximo_turno + interval '1 second')
   where unica
  returning proximo_turno into v_turno;

  -- Milisegundos que faltan. Nunca negativo: un turno ya vencido se atiende ya.
  return greatest(0, ceil(extract(epoch from (v_turno - now())) * 1000))::int;
end;
$$;

-- El turno lo pide el SERVIDOR. Si `authenticated` pudiera llamarla, un bucle
-- desde cualquier teléfono empujaría `proximo_turno` horas hacia adelante y
-- dejaría la geocodificación inservible para todos los demás, sin publicar nada
-- y sin gastar cuota. La cuota limita cuántas veces geocodificas; esto limita
-- que puedas estropeárselo al resto.
--
-- Y se revoca a `anon` y `authenticated` POR NOMBRE, no solo a `public`.
-- Supabase trae `alter default privileges ... grant execute on functions to
-- anon, authenticated, service_role`, asi que cada funcion nueva nace con esas
-- tres concesiones ESCRITAS en su ACL. `revoke ... from public` no las toca:
-- no vienen de PUBLIC. Comprobado en la ACL real de esta misma funcion, que
-- decia `{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,
-- service_role=X/postgres}` despues del revoke.
--
-- La asercion 72 es la que lo destapo. Sin ella esta funcion habria quedado
-- abierta a cualquiera con la anon key, con un `revoke` justo encima que
-- afirmaba lo contrario.
revoke execute on function reservar_turno_geocodificacion() from public, anon, authenticated;
grant execute on function reservar_turno_geocodificacion() to service_role;
