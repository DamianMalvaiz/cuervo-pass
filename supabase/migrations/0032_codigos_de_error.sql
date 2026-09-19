-- END-27 · La app distinguía sus errores leyendo el TEXTO del mensaje.
--
--   mensaje.includes('duplicate') || mensaje.includes('unique')
--   e.message.includes('límite')
--   mensaje.includes('cuota')
--
-- Eso depende del texto que produce Postgres, que cambia por versión y por
-- **locale**. En un servidor con locale en español, «duplicate key value» ya no
-- dice «duplicate»: la app mostraría «intenta de nuevo en un momento» ante algo
-- que no va a funcionar nunca. Y basta con que alguien reescriba el mensaje de
-- un `raise` para romper una rama de la interfaz sin tocarla.
--
-- Pero el diagnóstico completo es más incómodo: **no había código que leer**.
-- Las dos excepciones propias usaban `check_violation` (23514), el mismo que
-- devuelve cualquier CHECK de cualquier tabla. La subcadena no era pereza, era
-- lo único disponible. La corrección no es leer el código: es DARLES uno.
--
-- ── La convención ──
--
-- Clase `CP` (Cuervo Pass). Postgres permite SQLSTATEs definidos por la
-- aplicación y garantiza no usar clases que empiecen por letras fuera de su
-- propio catálogo, así que `CP` no va a colisionar con un código del motor.
--
--   CP001  cuota diaria agotada
--   CP002  límite de publicaciones activas alcanzado
--
-- Reservados para cuando se toquen las funciones que hoy los lanzan sin código
-- propio —ninguna la distingue el cliente todavía, y cambiarlas ahora sería
-- reescribir seis funciones sin que nada lo pida:
--
--   CP003  publicación no disponible
--   CP004  usuario no disponible / destinatario inválido
--   CP005  sin sesión
--   CP006  la suspensión no se modifica desde la aplicación
--
-- Los errores que Postgres ya distingue bien NO se reetiquetan: una violación
-- de unicidad es `23505` en todas partes, y darle un código propio sería
-- inventar un dialecto donde ya hay un estándar.
--
-- Reversión: reinstalar los cuerpos de 0010 y 0013 con `create or replace`.

-- ============================================================
-- CP001 · cuota diaria agotada
-- ============================================================
create or replace function consumir_cuota(p_recurso text, p_limite int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_consumo int;
begin
  if auth.uid() is null then
    raise exception 'sin sesión';
  end if;

  insert into cuotas_uso (usuario_id, recurso, dia, consumo)
  values (auth.uid(), p_recurso, current_date, 1)
  on conflict (usuario_id, recurso, dia)
    do update set consumo = cuotas_uso.consumo + 1
  returning consumo into v_consumo;

  if v_consumo > p_limite then
    raise exception 'cuota diaria agotada para %', p_recurso
      using errcode = 'CP001';
  end if;
end;
$$;

revoke execute on function consumir_cuota(text, int) from public;
grant execute on function consumir_cuota(text, int) to authenticated;

-- ============================================================
-- CP002 · límite de publicaciones activas
-- ============================================================
-- Nada impedía que un bucle creara doscientas publicaciones y sepultara el
-- catálogo. Quince es holgado para alguien con tres departamentos y suficiente
-- para que un bucle choque antes de hacer daño.
create or replace function limitar_publicaciones()
returns trigger language plpgsql as $$
begin
  if (select count(*) from publicaciones
       where usuario_id = new.usuario_id and activa) >= 15 then
    raise exception 'límite de publicaciones activas alcanzado'
      using errcode = 'CP002';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_limitar_publicaciones on publicaciones;
create trigger trg_limitar_publicaciones
  before insert on publicaciones
  for each row execute function limitar_publicaciones();
