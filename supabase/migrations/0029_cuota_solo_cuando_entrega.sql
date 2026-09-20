-- END-13 · La cuota se cobraba cuando no se entregaba nada.
--
-- `revelar_contacto` llamaba a `consumir_cuota` ANTES del `on conflict do
-- nothing`. Volver a abrir una publicación que ya habías revelado cobraba otra
-- vez, aunque no hubiera nada nuevo que entregar: el teléfono ya lo tenías, y
-- de hecho la fila de `contactos` ni siquiera se insertaba.
--
-- Reabrir cinco publicaciones cinco veces agota las 25 diarias usando la app
-- con NORMALIDAD. Y en una demostración se toca mucho más que con normalidad.
--
-- La cuota existe para acotar el coste de revelar contactos NUEVOS (AUD-04), no
-- para cobrar por mirar dos veces lo mismo. El orden correcto es: comprobar si
-- ya está entregado, y solo cobrar si hay algo que entregar.
--
-- Reversión: reinstalar el cuerpo de 0020 con `create or replace`, y
-- `drop function devolver_cuota(text)`.

create or replace function revelar_contacto(p_publicacion_id uuid, p_score numeric default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_whatsapp text;
  v_ya_revelado boolean;
begin
  select whatsapp into v_whatsapp
  from publicaciones
  where id = p_publicacion_id and activa and not oculta_por_reportes;

  if v_whatsapp is null then
    raise exception 'publicacion no disponible';
  end if;

  -- Antes de cobrar: ¿ya se entregó? Se consulta la tabla directamente y no la
  -- vista porque `contactos` es de esta persona y la policy ya la acota a sus
  -- propias filas.
  select exists (
    select 1 from contactos
     where usuario_id = auth.uid()
       and publicacion_id = p_publicacion_id
  ) into v_ya_revelado;

  if v_ya_revelado then
    -- Ni cuota ni insert. Devolver el teléfono que ya era suyo no consume nada
    -- nuevo, y el `do nothing` de abajo tampoco iba a escribir.
    return v_whatsapp;
  end if;

  perform consumir_cuota('revelar_contacto', 25);

  insert into contactos (usuario_id, publicacion_id, score_mostrado)
  values (auth.uid(), p_publicacion_id, p_score)
  -- El predicado REPETIDO es lo que permite a Postgres inferir el índice
  -- parcial. Sin él: 42P10, y la función entera falla. Se conserva aunque el
  -- `exists` de arriba ya cubra el caso normal: dos llamadas simultáneas pueden
  -- pasar ambas por el `exists` antes de que ninguna inserte.
  on conflict (usuario_id, publicacion_id) where publicacion_id is not null
  do nothing;   -- no infla la métrica

  return v_whatsapp;
end;
$$;

revoke execute on function revelar_contacto(uuid, numeric) from public;
grant execute on function revelar_contacto(uuid, numeric) to authenticated;

-- ============================================================
-- END-14 · Devolver lo cobrado cuando el servicio no entregó
-- ============================================================
-- `ai-proxy` consume cuota y luego hace el `fetch`. Si el microservicio no
-- responde, la cuota ya se cobró: con el túnel muerto, treinta reintentos
-- agotaban el día entero SIN UNA SOLA llamada al modelo. La persona se queda
-- sin servicio por un fallo que no es suyo.
--
-- El piso en cero no es defensivo por gusto: un `catch` que se dispare de más
-- —o dos devoluciones para un mismo cobro— dejaría el consumo en negativo, y
-- eso regala cuota del día siguiente.
create or replace function devolver_cuota(p_recurso text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'sin sesión';
  end if;

  update cuotas_uso
     set consumo = greatest(0, consumo - 1)
   where usuario_id = auth.uid()
     and recurso = p_recurso
     and dia = current_date;
end;
$$;

-- `revoke from public` y no `from anon`: Postgres concede EXECUTE a PUBLIC en
-- cada función nueva, y `anon` hereda ese permiso. Revocárselo solo a `anon` no
-- toca la concesión de PUBLIC y la función seguiría siendo invocable con la
-- anon key (misma nota que 0015).
revoke execute on function devolver_cuota(text) from public;
grant execute on function devolver_cuota(text) to authenticated;
