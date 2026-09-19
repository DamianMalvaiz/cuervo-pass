-- END-21 · La calificación viajaba por la URL, y era un dato del cliente.
--
-- `inicio.tsx` pasaba `score`, `base` y `sim` como parámetros de ruta al abrir
-- una ficha. Dos consecuencias, y la segunda es de seguridad:
--
--   · Un deep link no trae esos parámetros, así que el desglose —la tesis del
--     producto— desaparecía según por dónde entraras.
--   · Ese valor se escribía en `contactos.score_mostrado`. **La métrica que el
--     producto presenta era un dato suministrado por el cliente**: cualquiera
--     con la anon key podía registrar el número que quisiera. Una métrica que
--     el medido puede dictar no mide nada.
--
-- ============================================================
-- 1. La fórmula, en UN solo sitio
-- ============================================================
-- El score vivía dentro de `sugerencias_publicaciones`. Para que el detalle
-- pudiera calcularlo había dos caminos: copiar la expresión —y la propia 0015
-- advierte que «duplicar una regla de negocio en dos lugares es garantizar que
-- algún día se cambie en uno solo»— o extraerla. Se extrae.
--
-- `immutable` porque depende solo de sus argumentos: eso permite a Postgres
-- evaluarla una vez por fila y reusarla en índices si alguna vez hace falta.
create or replace function score_ajuste(
  p_km               numeric,
  p_precio           numeric,
  p_presupuesto_min  numeric,
  p_presupuesto_max  numeric,
  p_distancia_max    numeric,
  p_permite_mascotas boolean,
  p_tengo_mascotas   boolean,
  p_ruido_publicador text,
  p_ruido_mio        text,
  p_creado_en        timestamptz
)
returns numeric
language sql
immutable
as $$
  select round((
      -- Distancia: 0.30. Sin geocoding se asume media (0.5) en vez de castigar:
      -- que el servidor no pudiera geocodificar no es culpa de la publicación.
      0.30 * coalesce(greatest(0, 1 - (p_km / coalesce(p_distancia_max, 5))), 0.5)
    + 0.30 * case
               when p_presupuesto_max is null or p_presupuesto_min is null then 0.5
               when p_presupuesto_max = p_presupuesto_min then 1
               else greatest(0, least(1, 1 - ((p_precio - p_presupuesto_min)
                         / nullif(p_presupuesto_max - p_presupuesto_min, 0))))
             end
    -- Compatibilidad: 0.25, repartida entre mascotas y ruido. La asimetría de
    -- mascotas es la de END-09: sin mascota, que las acepten no estorba.
    + 0.25 * ( case
                 when p_tengo_mascotas then (case when p_permite_mascotas then 0.5 else 0 end)
                 else 0.5
               end
             + case when p_ruido_publicador = p_ruido_mio then 0.5 else 0 end )
    + 0.15 * greatest(0, 1 - (extract(epoch from now() - p_creado_en) / 86400 / 30))
  )::numeric, 4);
$$;

-- ============================================================
-- 2. El motor usa la función extraída
-- ============================================================
create or replace function sugerencias_publicaciones(p_limite int default 30)
returns table (
  id uuid, titulo text, tipo text, direccion text,
  precio_renta numeric, descripcion text, fotos text[],
  permite_mascotas boolean, amueblado boolean,
  latitud double precision, longitud double precision,
  distancia numeric, score numeric, vector_embedding vector(384)
)
language sql stable security invoker as $$
  with yo as (select * from usuarios where id = auth.uid())
  select
    p.id, p.titulo, p.tipo, p.direccion,
    p.precio_renta, p.descripcion, p.fotos,
    p.permite_mascotas, p.amueblado,
    p.latitud, p.longitud,
    round(d.km::numeric, 2) as distancia,
    score_ajuste(d.km::numeric, p.precio_renta, yo.presupuesto_min, yo.presupuesto_max,
                 yo.distancia_max_km, p.permite_mascotas, yo.mascotas,
                 du.nivel_ruido, yo.nivel_ruido, p.creado_en) as score,
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

-- ============================================================
-- 3. La afinidad de UNA publicación
-- ============================================================
-- Sin el filtro duro, a propósito: el detalle muestra algo que la persona pidió
-- ver explícitamente. Si está muy por encima de su presupuesto, el término de
-- presupuesto lo dirá con un número bajo — que es más informativo que esconder
-- la cifra y dejar la pantalla sin explicación, que es lo que pasaba al entrar
-- por un enlace directo.
create or replace function afinidad_de_para(p_usuario_id uuid, p_publicacion_id uuid)
returns table (score numeric, similitud numeric, score_final numeric, nivel int)
language sql
stable
security definer   -- lee `usuarios` de un id dado; la envoltura pública acota a auth.uid()
set search_path = public
as $$
  with yo as (select * from usuarios where id = p_usuario_id),
  pub as (
    select p.*, du.nivel_ruido as ruido_publicador
      from publicaciones_publicas p
      join perfiles_publicos du on du.id = p.usuario_id
     where p.id = p_publicacion_id
  ),
  calculo as (
    select
      score_ajuste(
        distancia_km(pub.latitud, pub.longitud, yo.latitud_universidad, yo.longitud_universidad)::numeric,
        pub.precio_renta, yo.presupuesto_min, yo.presupuesto_max, yo.distancia_max_km,
        pub.permite_mascotas, yo.mascotas, pub.ruido_publicador, yo.nivel_ruido, pub.creado_en
      ) as score,
      case
        when yo.perfil_vector is not null and pub.vector_embedding is not null
        then round((1 - (pub.vector_embedding <=> yo.perfil_vector))::numeric, 4)
      end as similitud
    from pub cross join yo
  )
  select
    c.score,
    c.similitud,
    coalesce(round((0.6 * c.score + 0.4 * c.similitud)::numeric, 4), c.score) as score_final,
    case when c.similitud is not null then 2 else 1 end as nivel
  from calculo c;
$$;

revoke execute on function afinidad_de_para(uuid, uuid) from public;

-- La envoltura que llama la app: siempre sobre la sesión en curso. Separarlas
-- es lo que impide que alguien pida la afinidad de OTRA persona pasando su id.
create or replace function afinidad_de(p_publicacion_id uuid)
returns table (score numeric, similitud numeric, score_final numeric, nivel int)
language sql stable security invoker as $$
  select * from afinidad_de_para(auth.uid(), p_publicacion_id);
$$;

revoke execute on function afinidad_de(uuid) from public;
grant execute on function afinidad_de(uuid) to authenticated;

-- ============================================================
-- 4. revelar_contacto deja de aceptar el score del cliente
-- ============================================================
drop function if exists revelar_contacto(uuid, numeric);

create or replace function revelar_contacto(p_publicacion_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_whatsapp text;
  v_ya_revelado boolean;
  v_score numeric;
begin
  select whatsapp into v_whatsapp
  from publicaciones
  where id = p_publicacion_id and activa and not oculta_por_reportes;

  if v_whatsapp is null then
    raise exception 'publicacion no disponible';
  end if;

  -- END-13 · Antes de cobrar: ¿ya se entregó?
  select exists (
    select 1 from contactos
     where usuario_id = auth.uid() and publicacion_id = p_publicacion_id
  ) into v_ya_revelado;

  if v_ya_revelado then
    return v_whatsapp;
  end if;

  perform consumir_cuota('revelar_contacto', 25);

  -- El score lo calcula el SERVIDOR. Antes llegaba como argumento desde la app,
  -- que lo había sacado de un parámetro de ruta — o sea que la métrica que el
  -- producto presenta la dictaba quien la iba a ser medido.
  select a.score_final into v_score from afinidad_de(p_publicacion_id) a;

  insert into contactos (usuario_id, publicacion_id, score_mostrado)
  values (auth.uid(), p_publicacion_id, v_score)
  on conflict (usuario_id, publicacion_id) where publicacion_id is not null
  do nothing;

  return v_whatsapp;
end;
$$;

revoke execute on function revelar_contacto(uuid) from public;
grant execute on function revelar_contacto(uuid) to authenticated;
