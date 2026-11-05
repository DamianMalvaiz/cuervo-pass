-- Resumen del panel de admin web, con detalle · Cuervo 360 (paso 2 del panel nuevo).
--
-- Cifras agregadas para el dashboard «Resumen»: altas por semana, funciones de venta por estado, publicaciones, negocios, conversaciones y mensajes recientes.
-- Solo CONTEOS: ningún dato personal sale de esta función.
--
-- ── Semanas ─────────────────────────────────────────────────────────────────
-- Siempre ocho semanas, la actual incluida, y también las que tuvieron cero altas (una gráfica con huecos no distingue «cero» de «sin dato»). Las semanas
-- empiezan en lunes y se miden en hora de la Ciudad de México, que es donde se mira el panel: en UTC, un alta del lunes a las 8 pm caería en el domingo.
--
-- ── Quién puede llamarla ────────────────────────────────────────────────────
-- Solo `service_role` (la Edge Function `admin`, que ya comprobó la sesión). Además, como las demás del panel, vuelve a comprobar `es_admin_aprobado`:
-- una llave de servicio mal usada tampoco le entrega cifras a quien no es admin (CP007).
--
-- Reversión:
--   drop function if exists admin_resumen_detalle(uuid);

create or replace function admin_resumen_detalle(p_admin uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hoy date := (date_trunc('week', now() at time zone 'America/Mexico_City'))::date;
begin
  if not es_admin_aprobado(p_admin) then
    raise exception 'responsable no es admin' using errcode = 'CP007';
  end if;

  return jsonb_build_object(
    'altas_por_semana', (
      select jsonb_agg(jsonb_build_object('semana', s.semana, 'cuentas', coalesce(c.n, 0)) order by s.semana)
      from (select (v_hoy - 7 * g)::date as semana from generate_series(0, 7) g) s
      left join (
        select (date_trunc('week', creado_en at time zone 'America/Mexico_City'))::date as semana, count(*)::int as n
        from usuarios
        where (creado_en at time zone 'America/Mexico_City')::date >= v_hoy - 49
        group by 1
      ) c on c.semana = s.semana
    ),
    'roles_por_estado', coalesce((
      select jsonb_agg(jsonb_build_object('rol', rol, 'estado', estado, 'total', n) order by rol, estado)
      from (select rol, estado, count(*)::int as n from roles_usuario where rol in ('comerciante', 'arrendador') group by rol, estado) r
    ), '[]'::jsonb),
    'publicaciones', jsonb_build_object(
      'total', (select count(*)::int from publicaciones),
      'activas', (select count(*)::int from publicaciones where activa)
    ),
    'negocios', jsonb_build_object(
      'total', (select count(*)::int from negocios),
      'activos', (select count(*)::int from negocios where activo and not oculto_por_reportes)
    ),
    'conversaciones', (select count(*)::int from conversaciones),
    'mensajes_7d', (select count(*)::int from mensajes where creado_en >= now() - interval '7 days')
  );
end;
$$;

revoke execute on function admin_resumen_detalle(uuid) from public, anon, authenticated;
grant execute on function admin_resumen_detalle(uuid) to service_role;
