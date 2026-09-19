-- END-09 · El score de mascotas hacía lo contrario de su propio comentario.
--
-- El término suave de la 0015 era:
--
--   case when p.permite_mascotas = yo.mascotas then 0.5 else 0 end
--
-- Sin mascota + departamento que SÍ las acepta → `true <> false` → cero puntos.
-- Penalizaba los alojamientos pet friendly a quien no tiene mascota, con un peso
-- de 0.25 × 0.5 = 0.125 sobre un score que va de 0 a 1. Es mucho: mueve una
-- publicación varios puestos.
--
-- Y treinta líneas más abajo, el propio archivo afirmaba lo contrario:
--
--   «Mascotas es eliminatorio en UN solo sentido — si tienes mascota, un lugar
--    que no las permite no te sirve; si no tienes, uno que las permite no te
--    estorba. Asimetría deliberada.»
--
-- Ese comentario describe el FILTRO DURO, que sí implementaba la asimetría bien.
-- El score suave, treinta líneas más arriba, la implementaba simétrica. Dos
-- piezas correctas por separado que se contradicen al correr juntas — la misma
-- forma que AUD-01 y que END-01.
--
-- La regla, ahora en las dos capas:
--   · CON mascota  → aceptar mascotas suma; no aceptarlas ya ni siquiera
--                     aparece, porque el filtro duro lo eliminó antes.
--   · SIN mascota  → da igual. Punto completo en ambos casos: no es una
--                     preferencia, es una condición que no le aplica.
--
-- Solo cambia ese `case`. El resto del cuerpo se reproduce tal cual para no
-- tocar lo que no toca esta corrección.
--
-- Reversión: reinstalar el cuerpo de 0015 con `create or replace`.

create or replace function sugerencias_publicaciones(p_limite int default 30)
returns table (
  id uuid, titulo text, tipo text, direccion text,
  precio_renta numeric, descripcion text, fotos text[],
  permite_mascotas boolean, amueblado boolean,
  latitud double precision, longitud double precision,
  distancia numeric, score numeric, vector_embedding vector(384)
)
language sql stable security invoker as $$
  with yo as (
    select * from usuarios where id = auth.uid()
  )
  select
    p.id, p.titulo, p.tipo, p.direccion,
    p.precio_renta, p.descripcion, p.fotos,
    p.permite_mascotas, p.amueblado,
    p.latitud, p.longitud,
    round(d.km::numeric, 2) as distancia,
    round((
        0.30 * coalesce(greatest(0, 1 - (d.km / coalesce(yo.distancia_max_km, 5))), 0.5)
      + 0.30 * case
                 when yo.presupuesto_max is null or yo.presupuesto_min is null then 0.5
                 when yo.presupuesto_max = yo.presupuesto_min then 1
                 else greatest(0, least(1, 1 - ((p.precio_renta - yo.presupuesto_min)
                           / nullif(yo.presupuesto_max - yo.presupuesto_min, 0))))
               end
      -- ── END-09 · la misma asimetría que el filtro duro ──
      + 0.25 * ( case
                   when yo.mascotas then (case when p.permite_mascotas then 0.5 else 0 end)
                   else 0.5
                 end
               + case when du.nivel_ruido = yo.nivel_ruido then 0.5 else 0 end )
      + 0.15 * greatest(0, 1 - (extract(epoch from now() - p.creado_en) / 86400 / 30))
    )::numeric, 4) as score,
    p.vector_embedding
  from publicaciones_publicas p
  join perfiles_publicos du on du.id = p.usuario_id
  cross join yo
  cross join lateral (
    select distancia_km(p.latitud, p.longitud,
                        yo.latitud_universidad, yo.longitud_universidad) as km
  ) d
  where p.usuario_id <> auth.uid()
    and (yo.presupuesto_max is null or p.precio_renta <= yo.presupuesto_max * 1.10)
    and (d.km is null or d.km <= coalesce(yo.distancia_max_km, 5))
    and (yo.mascotas = false or p.permite_mascotas = true)
  order by score desc
  limit p_limite;
$$;

revoke execute on function sugerencias_publicaciones(int) from public;
grant execute on function sugerencias_publicaciones(int) to authenticated;
