-- Ingresos y planes del panel de admin web · Cuervo 360 (paso 5 del panel nuevo).
--
-- Cifras agregadas para el dashboard «Ingresos y planes»: lo cobrado por semana, lo cobrado en 30 días, suscripciones por estado, ingresos por plan, el embudo de
-- órdenes y los últimos pagos.
--
-- ── Real y simulado, SIEMPRE por separado ───────────────────────────────────
-- `pagos.origen` es `mercadopago` o `simulado` (el modo demostración). Sumarlos daría una cifra que no es dinero. Cada cifra de dinero viene en dos: la de Mercado Pago
-- y la simulada. Que lo de Mercado Pago sea dinero real o de la cuenta de pruebas depende de las credenciales con que se cobró: esta función no lo puede saber.
--
-- ── Cómo se clasifica una suscripción ───────────────────────────────────────
--   activa      vigente_hasta en el futuro (hay un periodo PAGADO corriendo)
--   en_prueba   sin periodo pagado vigente y prueba_hasta en el futuro
--   vencida     ni lo uno ni lo otro, y tuvo al menos una de las dos fechas
--   por_vencer  activa que vence en los próximos 7 días (subconjunto de las activas)
-- Una fila sin ninguna de las dos fechas no cuenta en ninguna.
--
-- ── Semanas ─────────────────────────────────────────────────────────────────
-- Ocho semanas, la actual incluida y con ceros, de lunes a domingo en hora de la Ciudad de México (igual que 0078).
--
-- ── Quién puede llamarla ────────────────────────────────────────────────────
-- Solo `service_role` (la función `admin`) y vuelve a comprobar `es_admin_aprobado` (CP007). Solo conteos y sumas, más el nombre de usuario en los últimos pagos.
--
-- Reversión:
--   drop function if exists admin_ingresos(uuid);

create or replace function admin_ingresos(p_admin uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hoy   date := (date_trunc('week', now() at time zone 'America/Mexico_City'))::date;
  v_desde date;
begin
  if not es_admin_aprobado(p_admin) then
    raise exception 'responsable no es admin' using errcode = 'CP007';
  end if;
  v_desde := v_hoy - 49;

  return jsonb_build_object(
    'por_semana', (
      select jsonb_agg(
               jsonb_build_object('semana', s.semana, 'mercadopago_centavos', coalesce(c.mp, 0), 'simulado_centavos', coalesce(c.sim, 0))
               order by s.semana)
      from (select (v_hoy - 7 * g)::date as semana from generate_series(0, 7) g) s
      left join (
        select (date_trunc('week', creado_en at time zone 'America/Mexico_City'))::date as semana,
               sum(monto_centavos) filter (where origen = 'mercadopago')::bigint as mp,
               sum(monto_centavos) filter (where origen = 'simulado')::bigint as sim
          from pagos
         where (creado_en at time zone 'America/Mexico_City')::date >= v_desde
         group by 1
      ) c on c.semana = s.semana
    ),
    'ingresos_30d', (
      select jsonb_build_object(
        'mercadopago_centavos', coalesce(sum(monto_centavos) filter (where origen = 'mercadopago'), 0)::bigint,
        'simulado_centavos', coalesce(sum(monto_centavos) filter (where origen = 'simulado'), 0)::bigint,
        'pagos_mercadopago', (count(*) filter (where origen = 'mercadopago'))::int,
        'pagos_simulados', (count(*) filter (where origen = 'simulado'))::int)
      from pagos where creado_en >= now() - interval '30 days'
    ),
    'suscripciones', (
      select jsonb_build_object(
        'activas', (count(*) filter (where vigente_hasta > now()))::int,
        'en_prueba', (count(*) filter (where not coalesce(vigente_hasta > now(), false) and prueba_hasta > now()))::int,
        'vencidas', (count(*) filter (
          where not coalesce(vigente_hasta > now(), false) and not coalesce(prueba_hasta > now(), false)
            and (vigente_hasta is not null or prueba_hasta is not null)))::int,
        'por_vencer_7d', (count(*) filter (where vigente_hasta > now() and vigente_hasta <= now() + interval '7 days'))::int)
      from suscripciones
    ),
    'por_plan', coalesce((
      select jsonb_agg(
               jsonb_build_object('plan_id', p.id, 'nombre', p.nombre, 'rol', p.rol, 'activas', coalesce(a.n, 0),
                                  'mercadopago_30d_centavos', coalesce(i.mp, 0), 'simulado_30d_centavos', coalesce(i.sim, 0))
               order by p.rol, p.precio_centavos)
        from planes p
        left join (select plan_id, count(*)::int as n from suscripciones where vigente_hasta > now() group by plan_id) a on a.plan_id = p.id
        left join (
          select plan_id,
                 sum(monto_centavos) filter (where origen = 'mercadopago')::bigint as mp,
                 sum(monto_centavos) filter (where origen = 'simulado')::bigint as sim
            from pagos where creado_en >= now() - interval '30 days' group by plan_id
        ) i on i.plan_id = p.id
       where p.precio_centavos > 0
    ), '[]'::jsonb),
    'ordenes_30d', (
      select jsonb_build_object(
        'creada', (count(*) filter (where estado = 'creada'))::int,
        'pendiente', (count(*) filter (where estado = 'pendiente'))::int,
        'pagada', (count(*) filter (where estado = 'pagada'))::int,
        'rechazada', (count(*) filter (where estado = 'rechazada'))::int)
      from ordenes_pago where creada_en >= now() - interval '30 days'
    ),
    'ultimos_pagos', coalesce((
      select jsonb_agg(
               jsonb_build_object('creado_en', x.creado_en, 'origen', x.origen, 'plan', x.nombre, 'monto_centavos', x.monto_centavos, 'usuario', x.nombre_usuario)
               order by x.creado_en desc)
        from (
          select pg.creado_en, pg.origen, pl.nombre, pg.monto_centavos, u.nombre_usuario
            from pagos pg
            join planes pl on pl.id = pg.plan_id
            left join usuarios u on u.id = pg.usuario_id
           order by pg.creado_en desc
           limit 10
        ) x
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function admin_ingresos(uuid) from public, anon, authenticated;
grant execute on function admin_ingresos(uuid) to service_role;
