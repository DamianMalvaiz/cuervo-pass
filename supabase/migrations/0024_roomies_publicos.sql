-- Documento maestro v5 · §13 · cierra la tabla que la 0014 se saltó.
--
-- EL FALLO: el README afirma, sobre el modelo de datos:
--
--   «Las tablas están CERRADAS: cada usuario solo ve sus propias filas. Lo que
--    otros pueden ver sale de dos vistas con lista blanca de columnas […] que
--    deliberadamente no incluyen presupuesto, universidad, vector de perfil ni
--    teléfono.»
--
-- No era cierto para `roomies`. La 0014 hizo la cirugía de vistas en `usuarios`
-- y en `publicaciones`, y en la tercera tabla dejó:
--
--   create policy roomies_select_activos on roomies
--     for select to authenticated using (estado = 'activo' or auth.uid() = usuario_id);
--
-- Un `select * from roomies` bajaba TODAS las columnas de toda fila activa.
-- Lo grave no es `presupuesto_aportacion` —ver la nota de abajo— sino
-- `vector_busqueda`: 384 flotantes derivados del texto libre que esa persona
-- escribió sobre cómo quiere vivir. Un embedding no es anónimo; existe
-- literatura de inversión que reconstruye buena parte del texto original. Es
-- exactamente la columna que `perfiles_publicos` excluye a propósito en
-- `usuarios`, expuesta sin barrera en la tabla de al lado.
--
-- ═══ Sobre `presupuesto_aportacion`, y rectifico ═══
--
-- En la primera lectura lo agrupé con `usuarios.presupuesto_max` como dato
-- sensible filtrado. No son lo mismo y conviene distinguirlo:
--   · `usuarios.presupuesto_max` es lo que puedes pagar. Privado.
--   · `roomies.presupuesto_aportacion` es lo que OFRECES aportar en un anuncio
--     que publicaste para que te contacten. Es el contenido del anuncio.
-- Ocultarlo dejaría la pantalla de roomies sin el dato que la hace útil. Se
-- queda expuesto, y queda escrito por qué.
--
-- ═══ Por qué `sugerencias_roomies` pasa a `security definer` ═══
--
-- Cerrar la tabla sin tocar la función la deja devolviendo CERO filas, sin
-- error y sin log: es `security invoker`, corre con los permisos de quien
-- llama, y sobre una tabla cerrada no ve nada. AUD-01, tercera aparición.
--
-- Para publicaciones la solución fue consultar la vista. Aquí no alcanza: el
-- ranking necesita `vector_busqueda`, y la vista existe precisamente para NO
-- exponerlo. La función tiene que leer una columna que su llamador no puede
-- leer, y eso es lo que `security definer` significa.
--
-- La 0015 rechazó `security definer` para publicaciones con un argumento
-- correcto: «salta RLS por completo y obliga a auditar a mano cada columna
-- devuelta». Ese argumento se sostiene aquí porque la auditoría es trivial y
-- está en la propia firma: la función declara sus diez columnas de retorno y
-- `vector_busqueda` no es ninguna de ellas. El vector entra en el cálculo y no
-- sale. Lo verifica la aserción 35 de supabase/tests/rls.test.sql.
--
-- Reversión:
--   drop view if exists roomies_publicos;
--   drop policy if exists roomies_select_propio on roomies;
--   create policy roomies_select_activos on roomies
--     for select to authenticated using (estado = 'activo' or auth.uid() = usuario_id);
--   -- y recrear sugerencias_roomies de la 0015 como `security invoker`.

-- ============================================================
-- 1. La vista con lista blanca
-- ============================================================
drop view if exists roomies_publicos;
create view roomies_publicos with (security_invoker = false) as
  select id, usuario_id, descripcion_busqueda, presupuesto_aportacion,
         estado, creado_en
  from roomies
  where estado = 'activo';

revoke all on roomies_publicos from public;
revoke all on roomies_publicos from anon;
grant select on roomies_publicos to authenticated;

comment on view roomies_publicos is
  'AUD-14, misma decision que perfiles_publicos: security_invoker=false a proposito '
  'para evadir el RLS de roomies y exponer SOLO esta lista blanca. `vector_busqueda` '
  'NO esta aqui. Al agregar una columna a roomies, NO se toca esta vista. '
  'Verificado por supabase/tests/rls.test.sql.';

-- ============================================================
-- 2. La tabla se cierra, como usuarios y publicaciones
-- ============================================================
drop policy if exists roomies_select_activos on roomies;

drop policy if exists roomies_select_propio on roomies;
create policy roomies_select_propio on roomies
  for select to authenticated using (auth.uid() = usuario_id);

-- `roomies_todo_dueno` (0014) sigue cubriendo insert/update/delete.

-- La vista de compatibilidad `roomings` de la 0011 es `security_invoker = true`,
-- así que hereda el cierre automáticamente y deja de servir filas ajenas. Su
-- retiro estaba previsto para la semana 12; esto no lo adelanta, solo lo
-- vuelve inofensivo.

-- ============================================================
-- 3. La función, que ahora lee lo que su llamador no puede
-- ============================================================
create or replace function sugerencias_roomies(p_limite int default 30)
returns table (id uuid, usuario_id uuid, descripcion_busqueda text,
               presupuesto_aportacion int, estado text, creado_en timestamptz,
               nombre_completo text, foto_url text, biografia text,
               similitud numeric)
language sql stable security definer set search_path = public as $$
  with yo as (select perfil_vector from usuarios where id = auth.uid())
  select r.id, r.usuario_id, r.descripcion_busqueda, r.presupuesto_aportacion,
         r.estado, r.creado_en,
         u.nombre_completo, u.foto_url, u.biografia,
         case
           when yo.perfil_vector is null or r.vector_busqueda is null then null
           else round((1 - (r.vector_busqueda <=> yo.perfil_vector))::numeric, 4)
         end as similitud
    -- `roomies` y no `roomies_publicos` porque hace falta `vector_busqueda`,
    -- que la vista no trae. Es la razon entera del security definer.
    from roomies r
    -- El join contra la vista publica es el que descarta a quien esta
    -- desactivado o suspendido (0023): perfiles_publicos filtra por activo.
    join perfiles_publicos u on u.id = r.usuario_id
    cross join yo
   where r.estado = 'activo'
     and r.usuario_id <> auth.uid()
   order by similitud desc nulls last, r.creado_en desc
   limit p_limite;
$$;

revoke execute on function sugerencias_roomies(int) from public;
grant execute on function sugerencias_roomies(int) to authenticated;

comment on function sugerencias_roomies(int) is
  'security definer a proposito: necesita roomies.vector_busqueda, que roomies_publicos '
  'oculta. El vector entra en el calculo y NO sale — la lista blanca es la firma de '
  'retorno. Al anadir una columna al RETURNS, revisala contra roomies_publicos.';
