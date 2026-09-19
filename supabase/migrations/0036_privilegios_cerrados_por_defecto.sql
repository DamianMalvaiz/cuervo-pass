-- El `revoke ... from public` de doce migraciones no revocaba nada.
--
-- ── EL DIAGNÓSTICO ──────────────────────────────────────────────────────────
-- Supabase trae configurado `alter default privileges ... grant execute on
-- functions to anon, authenticated, service_role`. Cada función nueva nace con
-- esas tres concesiones ESCRITAS en su propia ACL, y `revoke ... from public` no
-- las quita porque no vienen de PUBLIC. Comprobado en la ACL real de una función
-- recién creada, inmediatamente después del revoke:
--
--   {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
--
-- Lo destapó la aserción 72 de la 0035, que era la primera del proyecto que
-- comprobaba un revoke en vez de escribirlo.
--
-- ── LO QUE ESTABA ABIERTO ───────────────────────────────────────────────────
-- Dos cosas explotables hoy, sin herramientas y con la anon key:
--
-- 1. `devolver_cuota('revelar_contacto')` decrementaba la cuota del PROPIO
--    llamante. Veinticinco llamadas la devolvían a cero y permitían revelar
--    veinticinco teléfonos más. En bucle, la base de teléfonos entera. Es
--    exactamente el scraping que AUD-04 existe para impedir, y lo introdujo la
--    0029 al conceder la función a `authenticated` — que la necesitaba, porque
--    `ai-proxy` la llamaba con el token del usuario.
--
-- 2. `afinidad_de_para(usuario, publicacion)` acepta el uuid de cualquiera. La
--    0031 la separó de `afinidad_de` precisamente para que nadie pudiera pedir
--    la afinidad de OTRA persona. La separación no existía: además de estar
--    concedida, la envoltura era `security invoker`, así que llamaba a la
--    interna CON LA IDENTIDAD DEL CLIENTE y el cliente NECESITABA poder
--    ejecutarla. Una envoltura invoker no encapsula nada.
--
-- Menores, del mismo origen: `barrer_fotos_programado` y
-- `limpiar_cuotas_antiguas` (tareas de pg_cron), `enviar_notificacion_push`
-- —que acepta destinatario, título y cuerpo arbitrarios, o sea mandar un aviso
-- con el nombre de la app a quien sea— y ocho funciones de trigger.
--
-- ── LA FORMA DE LA CORRECCIÓN ───────────────────────────────────────────────
-- No se revoca función por función: se CIERRA TODO y se abre por lista. Una
-- lista de lo que se cierra hay que acordarse de ampliarla; una lista de lo que
-- se abre se revisa entera cada vez que se lee. Y la aserción 75 la fija.
--
-- Reversión: `grant execute on all functions in schema public to anon, authenticated;`
-- y reinstalar `devolver_cuota(text)` con el cuerpo de la 0029.

-- ── 1 · cerrar todo lo del proyecto ─────────────────────────────────────────
-- Se excluyen las funciones que pertenecen a una extensión (pgvector aporta más
-- de cien): no son nuestras, y revocarlas rompería los operadores de vector.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as firma
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.firma);
  end loop;
end $$;

-- ── 2 · que las futuras nazcan con menos ────────────────────────────────────
-- Esto quita las concesiones EXPLÍCITAS a `anon` y `authenticated` que Supabase
-- pone a cada función nueva. Es necesario y NO es suficiente, y conviene que
-- quede escrito para que nadie lo dé por resuelto:
--
-- PostgreSQL concede además EXECUTE a PUBLIC de fábrica, y
-- `alter default privileges ... revoke execute on functions from public` NO lo
-- quita. Medido aquí mismo: con el revoke a PUBLIC aplicado y el catálogo
-- diciendo `{postgres=X/postgres,service_role=X/postgres}`, una función recién
-- creada seguía naciendo con `{=X/postgres,...}` — esa primera entrada sin
-- nombre es PUBLIC, y `anon` y `authenticated` son miembros de PUBLIC. Se
-- descartó que hubiera un event trigger reconcediendo: los seis que existen son
-- de pg_cron, pg_net y graphql.
--
-- Conclusión operativa, y es una regla nueva del proyecto: **cada función nueva
-- lleva su `revoke ... from public, anon, authenticated` explícito.** Lo que
-- garantiza que no se olvide no es esta línea: es la aserción 75, que compara la
-- lista de funciones ejecutables por `authenticated` contra una lista blanca y
-- se rompe sola en cuanto aparece una de más.
--
-- Este mismo arreglo estuvo a medias por la misma razón que el error que viene a
-- corregir, y lo atrapó la prueba, no la lectura.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ── 3 · abrir por lista, solo lo que el cliente usa ─────────────────────────
-- Doce funciones. Todas dependen de `auth.uid()`, así que ninguna se concede a
-- `anon`: antes de iniciar sesión no hay nada que preguntar.
grant execute on function abrir_conversacion(uuid) to authenticated;
grant execute on function afinidad_de(uuid) to authenticated;
grant execute on function consumir_cuota(text, int) to authenticated;
grant execute on function contactos_de_mis_publicaciones() to authenticated;
grant execute on function exportar_mis_datos() to authenticated;
grant execute on function resumen_conversaciones(int) to authenticated;
grant execute on function revelar_contacto(uuid) to authenticated;
grant execute on function sugerencias_con_ranking(int, text) to authenticated;
grant execute on function sugerencias_publicaciones(int, text) to authenticated;
grant execute on function sugerencias_roomies(int) to authenticated;
-- Estas dos no las llama la app directamente: las llaman desde dentro
-- `sugerencias_publicaciones` y `afinidad_de_para`, que son `security invoker`
-- la primera. Una función invoker se ejecuta con la identidad de quien llama, así
-- que el cliente necesita poder ejecutar todo lo que ella use.
grant execute on function distancia_km(double precision, double precision, double precision, double precision) to authenticated;
grant execute on function score_ajuste(numeric, numeric, numeric, numeric, numeric, boolean, boolean, text, text, timestamptz) to authenticated;

-- ── 4 · las de servicio, al rol de servicio ─────────────────────────────────
grant execute on function afinidad_de_para(uuid, uuid) to service_role;
grant execute on function barrer_fotos_programado() to service_role;
grant execute on function limpiar_cuotas_antiguas() to service_role;
grant execute on function enviar_notificacion_push(uuid, text, text, jsonb) to service_role;

-- ── 5 · la envoltura de afinidad pasa a DEFINER ─────────────────────────────
-- Es lo que hace que cerrar la interna sea posible. Siendo `invoker`, esta
-- función se ejecutaba como el cliente y necesitaba que el cliente pudiera
-- llamar a `afinidad_de_para` — o sea que la encapsulación que la 0031 describía
-- no podía existir mientras la envoltura fuera invoker.
--
-- Como definer no recibe ningún id: lo fija a `auth.uid()` dentro. Ese es el
-- punto entero de la separación.
create or replace function afinidad_de(p_publicacion_id uuid)
returns table (score numeric, similitud numeric, score_final numeric, nivel int)
language sql
stable
security definer
set search_path = public
as $$
  select * from afinidad_de_para(auth.uid(), p_publicacion_id);
$$;

revoke execute on function afinidad_de(uuid) from public, anon;
grant execute on function afinidad_de(uuid) to authenticated;

-- ── 6 · devolver_cuota deja de ser una RPC del cliente ──────────────────────
-- La firma vieja desaparece. Revocarla bastaría hoy, pero deja en el esquema una
-- función que un `grant` escrito sin pensar reabriría; sin la firma no hay nada
-- que reabrir. El usuario llega ahora por parámetro, igual que en
-- `afinidad_de_para`, y solo `service_role` puede llamarla: `ai-proxy` pasa a
-- usar su cliente de servicio para devolver la cuota.
drop function if exists devolver_cuota(text);

create or replace function devolver_cuota(p_usuario uuid, p_recurso text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_usuario is null then
    raise exception 'devolver_cuota exige un usuario';
  end if;

  -- El piso en 0 se conserva: sin él, devoluciones repetidas dejarían el consumo
  -- en negativo y regalarían cuota futura.
  update cuotas_uso
     set consumo = greatest(0, consumo - 1)
   where usuario_id = p_usuario
     and recurso = p_recurso
     and dia = current_date;
end;
$$;

revoke execute on function devolver_cuota(uuid, text) from public, anon, authenticated;
grant execute on function devolver_cuota(uuid, text) to service_role;
