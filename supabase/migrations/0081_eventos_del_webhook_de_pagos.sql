-- Eventos del webhook de pagos · Cuervo 360 (paso 6 del panel nuevo: «Salud de la app»).
--
-- ── El hueco ────────────────────────────────────────────────────────────────
-- `mp-webhook` decide qué hacer con cada aviso de Mercado Pago, pero solo lo dice en el log de Supabase, que se borra y que nadie mira. Un token de Mercado Pago que
-- deja de servir, un pago con monto distinto o una firma que no coincide pasan sin que el panel se entere. Esta tabla guarda el RESULTADO de cada aviso ya verificado
-- (la etiqueta que decidió la política: `activado`, `duplicado`, `monto_distinto`, `credencial-rechazada`…) para mostrarlo.
--
-- ── Qué se guarda y qué no ──────────────────────────────────────────────────
-- Se guarda: cuándo, la etiqueta, el nivel (`info` o `alerta`), el código HTTP con que se contestó y, si es un número, el id del pago de Mercado Pago.
-- NO se guarda: el cuerpo del aviso, las cabeceras, la firma, el token ni datos de ninguna persona.
-- Solo se registran avisos con la firma ya VERIFICADA (lo decide `mp-webhook`): la URL es pública y, si cualquiera pudiera escribir aquí, la llenaría de basura.
--
-- ── La tabla no crece sin fin ───────────────────────────────────────────────
-- Cada vez que se registra un evento se borran los de más de 60 días.
--
-- Solo `service_role`: `registrar_evento_pago` la usa la Edge Function; `admin_eventos_pago` la lee el panel (y vuelve a comprobar admin, CP007).
--
-- Reversión:
--   drop function if exists admin_eventos_pago(uuid), registrar_evento_pago(text, text, integer, text, uuid);
--   drop table if exists eventos_pago;

create table if not exists eventos_pago (
  id           uuid primary key default gen_random_uuid(),
  recibido_en  timestamptz not null default clock_timestamp(),
  etiqueta     text not null check (char_length(etiqueta) between 1 and 60),
  nivel        text not null check (nivel in ('info', 'alerta')),
  status       integer not null,
  pago_id      text check (pago_id ~ '^[0-9]{1,20}$'),
  orden_id     uuid
);
create index if not exists eventos_pago_recibido_idx on eventos_pago (recibido_en desc);

alter table eventos_pago enable row level security;
revoke all on eventos_pago from public, anon, authenticated;
grant select, insert, delete on eventos_pago to service_role;

create or replace function registrar_evento_pago(p_etiqueta text, p_nivel text, p_status integer, p_pago_id text, p_orden uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_nivel is null or p_nivel not in ('info', 'alerta') then
    raise exception 'nivel invalido' using errcode = '22023';
  end if;
  if p_status is null then
    raise exception 'falta el codigo de respuesta' using errcode = '22023';
  end if;

  insert into eventos_pago (etiqueta, nivel, status, pago_id, orden_id)
  values (
    left(coalesce(nullif(btrim(p_etiqueta), ''), 'sin-etiqueta'), 60),
    p_nivel,
    p_status,
    -- Solo un id NUMÉRICO de pago: cualquier otra cosa se descarta, no se guarda tal cual.
    case when p_pago_id ~ '^[0-9]{1,20}$' then p_pago_id else null end,
    p_orden
  );

  delete from eventos_pago where recibido_en < now() - interval '60 days';
end;
$$;
revoke execute on function registrar_evento_pago(text, text, integer, text, uuid) from public, anon, authenticated;
grant execute on function registrar_evento_pago(text, text, integer, text, uuid) to service_role;

create or replace function admin_eventos_pago(p_admin uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not es_admin_aprobado(p_admin) then
    raise exception 'responsable no es admin' using errcode = 'CP007';
  end if;

  return jsonb_build_object(
    'total_24h', (select count(*)::int from eventos_pago where recibido_en >= now() - interval '24 hours'),
    'alertas_24h', (select count(*)::int from eventos_pago where recibido_en >= now() - interval '24 hours' and nivel = 'alerta'),
    'eventos', coalesce((
      select jsonb_agg(
               jsonb_build_object('recibido_en', e.recibido_en, 'etiqueta', e.etiqueta, 'nivel', e.nivel, 'status', e.status, 'pago_id', e.pago_id)
               order by e.recibido_en desc)
        from (select * from eventos_pago order by recibido_en desc limit 30) e
    ), '[]'::jsonb)
  );
end;
$$;
revoke execute on function admin_eventos_pago(uuid) from public, anon, authenticated;
grant execute on function admin_eventos_pago(uuid) to service_role;
