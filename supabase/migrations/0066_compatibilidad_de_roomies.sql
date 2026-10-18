-- Roomies: compatibilidad por reglas con razones legibles, y afinidad calibrada. Mejora del 18/10/2026 (cierra la brecha de explicabilidad de docs/algoritmos.md).
--
-- ── Lo que se medió en producción (solo lectura) ────────────────────────────
--   · El orden era SOLO el coseno entre el perfil y la búsqueda del roomie: no podía decir por qué (un embedding no se descompone en razones).
--   · Los cosenos reales de 150 pares (5 perfiles × 30 roomies) van de 0.16 a 0.56 (mediana 0.39). La tarjeta etiquetaba «Alta» desde 0.75: nunca ocurría.
--   · En los 30 roomies de demostración `nivel_ruido` es nulo en todos, el horario es «mixto» en todos y `presupuesto_aportacion` es nulo en todos:
--     lo que no tiene dato NO puede puntuar ni dar razones, y aquí se trata así (se ignora), no se inventa.
--
-- ── Qué hace ────────────────────────────────────────────────────────────────
--   compatibilidad = promedio ponderado de lo que SÍ se puede comparar (cada componente en [0, 1], nulo si falta el dato de alguno de los dos):
--       ruido 0.30  ordinal: igual 1 · contiguo (bajo–medio, medio–alto) 0.5 · bajo–alto 0
--       tabaco 0.25 igual 1 · distinto 0
--       horario 0.15 igual 1 · alguno «mixto» 0.5 · diurno–nocturno 0
--       mascotas 0.15 igual 1 · distinto 0.4
--       aportación 0.15 dentro de TU presupuesto 1 · fuera, decae con la distancia relativa al máximo
--   Los pesos se re-normalizan sobre los componentes presentes. Sin ningún dato: nula (y vale 0.5 en el puntaje, neutro).
--   afinidad  = coseno reescalado a [0, 1] con una banda FIJA [0.15, 0.60] (la observada), para que su peso declarado se cumpla en la práctica.
--   puntaje   = 0.5·compatibilidad + 0.5·afinidad. Sin vector, la afinidad aporta 0: baja en la lista, no desaparece (lo que ya hacía `nulls last`).
--   coincidencias / diferencias: frases legibles de los componentes comparados.
--
-- ── Lo que NO es ────────────────────────────────────────────────────────────
--   Los pesos, la banda y las frases son decisiones de producto, NO validadas con personas ni calibradas con datos de convivencia real.
--   La banda sale de 150 pares de demostración. No predice que dos personas se lleven bien: ordena por señales declaradas y dice cuáles.
--
-- ── Seguridad ───────────────────────────────────────────────────────────────
--   Sigue `security definer` (necesita `roomies.vector_busqueda`, que no sale). Del otro lado solo usa lo que ya es público: la vista `perfiles_publicos`
--   (ruido, tabaco, mascotas, horario) y la aportación que el propio anuncio ya expone. Del lado de quien llama, su propia fila. La lista blanca
--   es la firma de retorno; no se devuelve ningún vector ni dato privado ajeno.
--
-- Reversión: volver a crear la función con el cuerpo de la 0024.

drop function if exists sugerencias_roomies(int);

create function sugerencias_roomies(p_limite int default 30)
returns table (id uuid, usuario_id uuid, descripcion_busqueda text,
               presupuesto_aportacion int, estado text, creado_en timestamptz,
               nombre_completo text, foto_url text, biografia text,
               similitud numeric, compatibilidad numeric, puntaje numeric,
               coincidencias text[], diferencias text[])
language sql stable security definer set search_path = public as $$
  with yo as (
    select perfil_vector, nivel_ruido, fuma, mascotas, horario_predominante, presupuesto_min, presupuesto_max
      from usuarios where id = auth.uid()
  ),
  base as (
    select r.id, r.usuario_id, r.descripcion_busqueda, r.presupuesto_aportacion, r.estado, r.creado_en,
           u.nombre_completo, u.foto_url, u.biografia,
           case when yo.perfil_vector is null or r.vector_busqueda is null then null
                else round((1 - (r.vector_busqueda <=> yo.perfil_vector))::numeric, 4)
           end as sim,
           u.nivel_ruido as o_ruido, u.fuma as o_fuma, u.mascotas as o_mascotas, u.horario_predominante as o_horario,
           yo.nivel_ruido as y_ruido, yo.fuma as y_fuma, yo.mascotas as y_mascotas, yo.horario_predominante as y_horario,
           yo.presupuesto_min as y_min, yo.presupuesto_max as y_max
      from roomies r
      join perfiles_publicos u on u.id = r.usuario_id
      cross join yo
     where r.estado = 'activo' and r.usuario_id <> auth.uid()
  ),
  comp as (
    select b.*,
      case when b.y_ruido is null or b.o_ruido is null then null
           else (case abs(array_position(array['bajo','medio','alto'], b.y_ruido) - array_position(array['bajo','medio','alto'], b.o_ruido))
                   when 0 then 1.0 when 1 then 0.5 else 0.0 end)
      end as c_ruido,
      case when b.y_fuma is null or b.o_fuma is null then null else (b.y_fuma = b.o_fuma)::int::numeric end as c_fuma,
      case when b.y_horario is null or b.o_horario is null then null
           when b.y_horario = b.o_horario then 1.0
           when b.y_horario = 'mixto' or b.o_horario = 'mixto' then 0.5
           else 0.0 end as c_horario,
      case when b.y_mascotas is null or b.o_mascotas is null then null
           when b.y_mascotas = b.o_mascotas then 1.0 else 0.4 end as c_mascotas,
      case when b.presupuesto_aportacion is null or b.y_min is null or b.y_max is null then null
           when b.presupuesto_aportacion between b.y_min and b.y_max then 1.0
           else greatest(0.0, 1.0 - (case when b.presupuesto_aportacion < b.y_min then b.y_min - b.presupuesto_aportacion
                                         else b.presupuesto_aportacion - b.y_max end)::numeric
                                    / greatest(0.5 * b.y_max, 1.0))
      end as c_aporte
      from base b
  ),
  puntuado as (
    select c.*,
      case when (c.c_ruido is null and c.c_fuma is null and c.c_horario is null and c.c_mascotas is null and c.c_aporte is null) then null
           else round((coalesce(0.30 * c.c_ruido, 0) + coalesce(0.25 * c.c_fuma, 0) + coalesce(0.15 * c.c_horario, 0)
                     + coalesce(0.15 * c.c_mascotas, 0) + coalesce(0.15 * c.c_aporte, 0))
                    / (case when c.c_ruido is null then 0 else 0.30 end + case when c.c_fuma is null then 0 else 0.25 end
                     + case when c.c_horario is null then 0 else 0.15 end + case when c.c_mascotas is null then 0 else 0.15 end
                     + case when c.c_aporte is null then 0 else 0.15 end), 3)
      end as compat
      from comp c
  )
  select p.id, p.usuario_id, p.descripcion_busqueda, p.presupuesto_aportacion, p.estado, p.creado_en,
         p.nombre_completo, p.foto_url, p.biografia,
         p.sim as similitud,
         p.compat as compatibilidad,
         round((0.5 * coalesce(p.compat, 0.5)
              + 0.5 * coalesce(least(1.0, greatest(0.0, (p.sim - 0.15) / 0.45)), 0))::numeric, 4) as puntaje,
         array_remove(array[
           case when p.c_ruido = 1 then 'Mismo nivel de ruido' end,
           case when p.c_fuma = 1 then (case when p.o_fuma then 'Ambos fuman' else 'Ninguno fuma' end) end,
           case when p.c_mascotas = 1 then (case when p.o_mascotas then 'Ambos tienen mascotas' else 'Ninguno tiene mascotas' end) end,
           case when p.c_horario = 1 then 'Mismo horario' end,
           case when p.c_aporte = 1 then 'Su aportación entra en tu presupuesto' end
         ]::text[], null) as coincidencias,
         array_remove(array[
           case when p.c_ruido = 0 then 'Nivel de ruido muy distinto' end,
           case when p.c_fuma = 0 then 'Uno fuma y el otro no' end,
           case when p.c_mascotas < 1 then 'Uno tiene mascotas y el otro no' end,
           case when p.c_horario = 0 then 'Horarios opuestos' end,
           case when p.c_aporte < 1 then 'Su aportación queda fuera de tu presupuesto' end
         ]::text[], null) as diferencias
    from puntuado p
   order by puntaje desc, p.creado_en desc
   limit p_limite;
$$;
revoke execute on function sugerencias_roomies(int) from public, anon, authenticated;
grant execute on function sugerencias_roomies(int) to authenticated;

comment on function sugerencias_roomies(int) is
  'security definer a proposito: necesita roomies.vector_busqueda, que roomies_publicos '
  'oculta. El vector entra en el calculo y NO sale — la lista blanca es la firma de '
  'retorno. Al anadir una columna al RETURNS, revisala contra roomies_publicos.';
