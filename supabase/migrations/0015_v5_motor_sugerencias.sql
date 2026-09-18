-- Documento maestro v5 · §17 (Nivel 1: retrieval y scoring), §18 (Nivel 2: ranking).
--
-- ═══ AUD-01, el hallazgo más grave del proyecto ═══
--
-- v4 cerró `publicaciones` con `select ... using (auth.uid() = usuario_id)`
-- —correcto— y dos secciones después definió la función de sugerencias como
-- `security invoker` sobre `from publicaciones p join usuarios du`.
--
-- Una función `security invoker` corre con los permisos de quien la llama, así
-- que RLS se aplica DENTRO de la función: el usuario ve exactamente sus propias
-- publicaciones y ninguna más, y el `where p.usuario_id <> auth.uid()` las
-- descarta acto seguido. Resultado: lista vacía. Sin error. Sin log. Sin pista.
--
-- Ninguna de las dos secciones estaba mal por separado. La combinación no
-- funcionaba. La pregunta que lo detecta es una sola: ¿con qué identidad se
-- evalúa esta línea?
--
-- La corrección: la función consulta las VISTAS públicas (0013), que ya evaden
-- RLS a propósito y exponen solo columnas seguras. No se toca ninguna policy.
--
-- Alternativas rechazadas:
--   · `security definer` sobre las tablas → salta RLS por completo y obliga a
--     auditar a mano cada columna devuelta: repite el error de columnas de v3.
--   · Abrir lectura pública en `publicaciones` → reexpone el teléfono.
--
-- Reversión:
--   drop function if exists sugerencias_con_ranking(int), sugerencias_publicaciones(int);
--   -- y recrear ordenar_por_similitud / ordenar_roomings_por_similitud de 0006 y 0007.

-- Las de 0006 y 0007 hacían el Nivel 2 sobre una lista de candidatos que el
-- cliente calculaba en JavaScript. Ahora el Nivel 1 vive en la base, así que
-- el cliente ya no arma esa lista.
drop function if exists ordenar_por_similitud(vector, uuid[]);
drop function if exists ordenar_roomings_por_similitud(vector, uuid[]);

-- ============================================================
-- Nivel 1 · §17
-- ============================================================
-- Pesos: 0.30 distancia · 0.30 presupuesto · 0.25 compatibilidad · 0.15 frescura.
-- La frescura bajó de 0.20 a 0.15 y la compatibilidad subió a 0.25 porque con
-- datos de demo cargados el mismo día la frescura es prácticamente constante y
-- por lo tanto no ordena nada: pesarla al 20% era regalar un quinto del score a
-- una señal muerta.
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
    -- `usuarios` sí se puede leer aquí: la policy permite la fila propia, y
    -- esta es la fila propia.
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
      + 0.25 * ( case when p.permite_mascotas = yo.mascotas then 0.5 else 0 end
               + case when du.nivel_ruido = yo.nivel_ruido  then 0.5 else 0 end )
      + 0.15 * greatest(0, 1 - (extract(epoch from now() - p.creado_en) / 86400 / 30))
    )::numeric, 4) as score,
    p.vector_embedding
  -- ── AUD-01: las VISTAS, no las tablas ──
  from publicaciones_publicas p
  join perfiles_publicos du on du.id = p.usuario_id
  cross join yo
  cross join lateral (
    select distancia_km(p.latitud, p.longitud,
                        yo.latitud_universidad, yo.longitud_universidad) as km
  ) d
  where p.usuario_id <> auth.uid()                       -- no te sugieras a ti mismo
    -- ── FILTRO DURO. Esta es la parte que v3 no tenía ──
    -- v3 iba a defender en la demo que "el filtro duro va primero porque los
    -- embeddings no garantizan restricciones como el presupuesto", y su SQL
    -- solo tenía `where p.activa = true`. El presupuesto entraba como término
    -- suave, así que un depa al doble de tu máximo aparecía con buen score.
    and (yo.presupuesto_max is null or p.precio_renta <= yo.presupuesto_max * 1.10)
    and (d.km is null or d.km <= coalesce(yo.distancia_max_km, 5))
    and (yo.mascotas = false or p.permite_mascotas = true)
  order by score desc
  limit p_limite;
$$;
-- Tres decisiones dentro de ese `where` que hay que poder explicar:
--   · `* 1.10` — un tope rígido esconde el depa que cuesta cien pesos más que tu
--     máximo y que sí considerarías. Es decisión de producto, con el precio real
--     siempre visible en la tarjeta.
--   · `d.km is null` pasa el filtro — una publicación cuyo geocoding falló se
--     muestra sin distancia en vez de desaparecer. §27 resuelto en la consulta,
--     no en un `if` del frontend.
--   · Mascotas es eliminatorio en UN solo sentido — si tienes mascota, un lugar
--     que no las permite no te sirve; si no tienes, uno que las permite no te
--     estorba. Asimetría deliberada.
--
-- `p.activa` y `not p.oculta_por_reportes` no aparecen porque ya están dentro de
-- la definición de la vista. Duplicar una regla de negocio en dos lugares es
-- garantizar que algún día se cambie en uno solo.

-- Nota sobre los `revoke`: el documento maestro escribe `revoke execute ... from
-- anon`, pero eso no basta. Postgres concede EXECUTE a **PUBLIC** por omisión en
-- cada función nueva, y `anon` hereda ese permiso de PUBLIC — revocárselo a
-- `anon` en particular no toca la concesión de PUBLIC, así que la función sigue
-- siendo invocable con la sola anon key. Lo que cierra la puerta es revocar a
-- PUBLIC y conceder explícitamente a `authenticated`.

revoke execute on function sugerencias_publicaciones(int) from public;
grant execute on function sugerencias_publicaciones(int) to authenticated;

-- ============================================================
-- Nivel 2 · §18
-- ============================================================
-- Hereda la corrección de AUD-01: como se alimenta de sugerencias_publicaciones,
-- que ya consulta las vistas, no vuelve a tocar tablas con RLS. Si algún día
-- alguien la reescribe contra `publicaciones`, el síntoma será el mismo —cero
-- filas, cero errores— y por eso la prueba de pgTAP verifica que un usuario sin
-- publicaciones propias reciba resultados NO vacíos.
create or replace function sugerencias_con_ranking(p_limite int default 10)
returns table (id uuid, titulo text, tipo text, direccion text,
               precio_renta numeric, descripcion text, fotos text[],
               permite_mascotas boolean, amueblado boolean,
               latitud double precision, longitud double precision,
               distancia numeric, score numeric,
               similitud numeric, score_final numeric)
language sql stable security invoker as $$
  with candidatos as (
    select * from sugerencias_publicaciones(30)
  ),
  yo as (select perfil_vector from usuarios where id = auth.uid())
  select c.id, c.titulo, c.tipo, c.direccion, c.precio_renta, c.descripcion,
         c.fotos, c.permite_mascotas, c.amueblado, c.latitud, c.longitud,
         c.distancia, c.score,
         round((1 - (c.vector_embedding <=> yo.perfil_vector))::numeric, 4) as similitud,
         round((0.6 * c.score
              + 0.4 * (1 - (c.vector_embedding <=> yo.perfil_vector)))::numeric, 4) as score_final
  from candidatos c cross join yo
  where yo.perfil_vector is not null
    and c.vector_embedding is not null
  order by score_final desc
  limit p_limite;
$$;

revoke execute on function sugerencias_con_ranking(int) from public;
grant execute on function sugerencias_con_ranking(int) to authenticated;

-- ============================================================
-- Roomies ordenados por afinidad · §18 aplicado a personas
-- ============================================================
-- Aquí no hay Nivel 1 de filtros duros: ambos lados ya buscan cerca de la misma
-- universidad. El orden es directamente similitud de coseno.
--
-- La afinidad se calcula contra `roomies.vector_busqueda` —lo que la otra
-- persona escribió que busca— y NO contra su `usuarios.perfil_vector`, que la
-- vista pública deliberadamente no expone. Es la misma señal semántica sin
-- abrir una columna sensible.
create or replace function sugerencias_roomies(p_limite int default 30)
returns table (id uuid, usuario_id uuid, descripcion_busqueda text,
               presupuesto_aportacion int, estado text, creado_en timestamptz,
               nombre_completo text, foto_url text, biografia text,
               similitud numeric)
language sql stable security invoker as $$
  with yo as (select perfil_vector from usuarios where id = auth.uid())
  select r.id, r.usuario_id, r.descripcion_busqueda, r.presupuesto_aportacion,
         r.estado, r.creado_en,
         u.nombre_completo, u.foto_url, u.biografia,
         case
           when yo.perfil_vector is null or r.vector_busqueda is null then null
           else round((1 - (r.vector_busqueda <=> yo.perfil_vector))::numeric, 4)
         end as similitud
    from roomies r
    join perfiles_publicos u on u.id = r.usuario_id
    cross join yo
   where r.estado = 'activo'
     and r.usuario_id <> auth.uid()
   -- `nulls last`: quien todavía no tiene vector aparece al final, no desaparece.
   order by similitud desc nulls last, r.creado_en desc
   limit p_limite;
$$;

revoke execute on function sugerencias_roomies(int) from public;
grant execute on function sugerencias_roomies(int) to authenticated;
