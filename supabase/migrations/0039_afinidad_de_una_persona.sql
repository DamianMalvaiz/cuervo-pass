-- La afinidad de una PERSONA, en su perfil.
--
-- `sugerencias_roomies` ordena la lista por afinidad semántica y `TarjetaRoomie`
-- la enseña —«afinidad 0.87»—. Al tocar esa tarjeta y abrir el perfil, el número
-- DESAPARECÍA. La pantalla donde de verdad se decide si escribirle a alguien era
-- la única sin el dato por el que esa persona salió en la lista.
--
-- Es el mismo defecto que END-21 cerró para publicaciones: el desglose se
-- esfumaba según por dónde entraras a la ficha. Seguía vivo para personas.
--
-- ── Qué número es, y por qué ESE ────────────────────────────────────────────
-- El coseno entre MI `perfil_vector` y el `vector_busqueda` de la otra persona:
-- exactamente el mismo que calcula `sugerencias_roomies`. No es una elección
-- estética, es la única defendible. Mostrar aquí un número distinto —la
-- compatibilidad perfil contra perfil, por ejemplo, que estaría definida para
-- más gente— haría que tocar una tarjeta CAMBIARA el dato por el que la tocaste.
-- Dos decisiones correctas por separado que se contradicen al correr juntas.
--
-- Consecuencia asumida: quien no tiene ficha de roomie no tiene con qué
-- comparar, y su perfil no muestra afinidad. Es la verdad, y la pantalla lo dice
-- con palabras en vez de pintar un hueco.
--
-- ── Una sola función, no dos ────────────────────────────────────────────────
-- `afinidad_de` se partió en dos (`afinidad_de_para` + envoltura) y la 0036
-- demostró que esa separación no protegía nada mientras la envoltura fuera
-- `security invoker`. Aquí no hay a quién separar: `auth.uid()` se fija DENTRO y
-- la función no acepta un id de «yo». No se puede pedir la afinidad entre otras
-- dos personas porque no hay firma que lo permita.
--
-- Reversión: `drop function if exists afinidad_roomie_de(uuid);`

create or replace function afinidad_roomie_de(p_usuario_id uuid)
returns table (similitud numeric, nivel int)
language sql
stable
security definer
set search_path = public
as $$
  with yo as (select perfil_vector from usuarios where id = auth.uid()),
  otro as (
    -- `roomies` y no `roomies_publicos` porque hace falta `vector_busqueda`,
    -- que la vista no trae — la misma razón por la que `sugerencias_roomies` es
    -- definer. El join contra `perfiles_publicos` es el que descarta a quien
    -- está desactivado o suspendido (0023): sin él, un perfil suspendido seguiría
    -- devolviendo afinidad.
    select r.vector_busqueda
      from roomies r
      join perfiles_publicos u on u.id = r.usuario_id
     where r.usuario_id = p_usuario_id
       and r.estado = 'activo'
  )
  select
    case
      when yo.perfil_vector is null or otro.vector_busqueda is null then null
      else round((1 - (otro.vector_busqueda <=> yo.perfil_vector))::numeric, 4)
    end as similitud,
    case
      when yo.perfil_vector is null or otro.vector_busqueda is null then 1
      else 2
    end as nivel
  from yo
  -- `left join` y no `cross join`: sin ficha de roomie la consulta tiene que
  -- devolver UNA fila con similitud null, no cero filas. Cero filas obligaría a
  -- la pantalla a distinguir «no hay afinidad» de «la consulta no devolvió
  -- nada», que son lo mismo para quien mira y distinto para quien programa.
  left join otro on true;
$$;

-- Invariante 9: revoke explícito a los tres, y grant solo a quien llama.
revoke execute on function afinidad_roomie_de(uuid) from public, anon, authenticated;
grant execute on function afinidad_roomie_de(uuid) to authenticated;
