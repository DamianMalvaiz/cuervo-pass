-- Cuántas personas guardaron una publicación · Cuervo 360.
--
-- Se ve el NÚMERO y nunca quién. Un favorito sigue siendo privado (0044): nadie lee las filas de otra
-- cuenta. Esta función devuelve, para una lista de publicaciones, solo `(id, total)`: no hay columna
-- que apunte a una persona, y una prueba lo fija mirando la firma de la función.
--
-- ── Por qué una función y no un contador ────────────────────────────────────
-- Lo evidente sería una columna `favoritos_count` en `publicaciones`, mantenida por un trigger. Sería
-- un segundo lugar donde vive un dato que se puede calcular, con su ventana de desincronización: el
-- mismo defecto que la 0026 evitó con el correo verificado. El conteo se deriva al preguntar y no
-- puede desincronizarse porque no se copia. Tampoco entra a `publicaciones_publicas`: esa vista la
-- leen las listas completas, y calcularle una subconsulta a cada fila las encarecería a todas para
-- un número que solo muestran dos pantallas.
--
-- ── Qué cuenta, y por qué no sirve de sonda ─────────────────────────────────
-- Devuelve una fila por cada publicación que es VISIBLE (activa y sin ocultar) o PROPIA de quien
-- pregunta. Una publicación ajena y oculta y una que no existe dan exactamente lo mismo —ninguna
-- fila—, así que preguntar el conteo no revela qué publicaciones fueron ocultadas por reportes. Una
-- visible que nadie guardó devuelve `total = 0` (una fila): sin esa fila, el cliente no podría
-- distinguir «nadie la guardó» de «no puedes verla».
--
-- ── Límites ─────────────────────────────────────────────────────────────────
-- Máximo 50 ids por llamada (54000): sin tope, la función serviría para barrer la base entera de
-- publicaciones de una sola petición. Exige sesión (28000). `security definer` porque el cliente no
-- puede leer las filas de `favoritos` de otras cuentas; por eso mismo la función hace sola todas las
-- comprobaciones, y no devuelve nada más que el id y el número.
--
-- Reversión:
--   drop function if exists favoritos_por_publicacion(uuid[]);

create or replace function favoritos_por_publicacion(p_ids uuid[])
returns table (publicacion_id uuid, total integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'sin sesion' using errcode = '28000';
  end if;

  if coalesce(cardinality(p_ids), 0) > 50 then
    raise exception 'demasiados ids' using errcode = '54000';
  end if;

  return query
    select p.id,
           (select count(*)::integer from favoritos f where f.publicacion_id = p.id)
      from publicaciones p
     where p.id = any(p_ids)
       and ((p.activa and not p.oculta_por_reportes) or p.usuario_id = auth.uid());
end;
$$;

-- Explícito sobre las TRES concesiones por defecto (0036): anon no tiene nada que hacer aquí.
revoke execute on function favoritos_por_publicacion(uuid[]) from public, anon;
grant execute on function favoritos_por_publicacion(uuid[]) to authenticated;
