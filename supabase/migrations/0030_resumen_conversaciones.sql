-- END-16 · Mil doscientos mensajes para resolver treinta hilos.
--
-- `listarConversaciones` pedía `limite * PAGINA_MENSAJES` mensajes —30 × 40—
-- y los plegaba en JavaScript para sacar el último de cada hilo y el contador de
-- no leídos. El encabezado de ese mismo archivo acusa a v3 de «traerse TODOS los
-- mensajes y agruparlos en JavaScript».
--
-- Y no era solo coste. Tenía dos defectos VISIBLES:
--
--   · El orden de esa ventana es `creado_en desc` GLOBAL. Un chat activo se come
--     el cupo entero y un hilo tranquilo aparece **sin último mensaje**, como si
--     estuviera vacío. Cincuenta mensajes de una conversación bastan para
--     esconder el texto de otra.
--   · El contador de no leídos se trunca en silencio: cuenta sobre la ventana,
--     no sobre el hilo.
--
-- Dos `left join lateral` lo resuelven donde corresponde. El primero saca UN
-- mensaje por conversación; el segundo cuenta sin traer filas. Treinta hilos son
-- treinta filas.
--
-- `security invoker` a propósito: la policy de `conversaciones` ya limita a las
-- propias, y ponerlo en definer obligaría a reimplementar esa regla aquí — que
-- es exactamente cómo se duplica una regla de negocio y se cambia en un solo
-- sitio.
--
-- Reversión: `drop function resumen_conversaciones(int);`

create or replace function resumen_conversaciones(p_limite int default 30)
returns table (
  conversacion_id     uuid,
  otro_usuario_id     uuid,
  ultimo_contenido    text,
  ultimo_creado_en    timestamptz,
  ultimo_remitente_id uuid,
  ultimo_leido        boolean,
  no_leidos           int
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id,
    case when c.usuario_a = auth.uid() then c.usuario_b else c.usuario_a end,
    m.contenido,
    m.creado_en,
    m.remitente_id,
    m.leido,
    coalesce(nl.total, 0)::int
  from conversaciones c
  -- Un solo mensaje por hilo. El desempate por `id` importa: dos mensajes con
  -- el mismo `creado_en` —que ocurre— harían que «el último» dependiera del
  -- plan de ejecución, y eso es un valor distinto en cada consulta.
  left join lateral (
    select contenido, creado_en, remitente_id, leido
      from mensajes
     where conversacion_id = c.id
     order by creado_en desc, id desc
     limit 1
  ) m on true
  -- Cuenta en la base, sin traer las filas. Es la diferencia entre un número y
  -- mil doscientos objetos viajando por la red para producir ese número.
  left join lateral (
    select count(*) as total
      from mensajes
     where conversacion_id = c.id
       and remitente_id <> auth.uid()
       and not leido
  ) nl on true
  -- `nulls last`: una conversación recién abierta sin mensajes todavía existe y
  -- debe salir, al final. Sin esto desaparecería de la lista.
  order by c.ultimo_mensaje_en desc nulls last
  limit p_limite;
$$;

revoke execute on function resumen_conversaciones(int) from public;
grant execute on function resumen_conversaciones(int) to authenticated;

-- Índice para los dos `lateral`. Sin él, cada uno recorre los mensajes de la
-- conversación entera: con treinta hilos son treinta recorridos por pantalla.
create index if not exists mensajes_conversacion_creado_idx
  on mensajes (conversacion_id, creado_en desc, id desc);
