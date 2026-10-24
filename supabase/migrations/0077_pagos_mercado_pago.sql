-- Pagos con Mercado Pago: órdenes y registro idempotente · Cuervo 360 (paso 1 de la integración).
--
-- ── Las dos reglas que gobiernan esto ───────────────────────────────────────
-- 1 · El SERVIDOR decide qué se paga. Plan y monto salen de `planes`, nunca de lo que diga Mercado Pago ni de lo que mande el cliente: se crea
--     una ORDEN (`ordenes_pago`) con el precio del catálogo, su id viaja como `external_reference` y, cuando llega el aviso del pago, se busca la
--     orden y se compara el monto. Un pago por otro monto NO activa el plan.
-- 2 · El aviso del pago (webhook) llega DUPLICADO y en PARALELO (Mercado Pago reintenta cada 15 minutos si no recibe 200 en 22 s). Registrarlo
--     dos veces no puede extender dos veces. Se logra con dos cosas: el candado de la fila de la orden (`for update`: dos avisos de la misma
--     orden se serializan) y `pagos.mp_payment_id` único (respaldo). El periodo se suma dentro del `on conflict do update` (patrón de la 0076).
--
-- ── Estados de Mercado Pago ─────────────────────────────────────────────────
--   approved                                   → activa el plan 30 días (si el monto coincide y el pago no estaba registrado).
--   pending · in_process · authorized · in_mediation → «pendiente» (OXXO: la referencia se generó y falta pagar en la tienda). NO es un pago:
--                                                no entra en `pagos` ni extiende nada. Si luego llega `approved` con el mismo id, se activa.
--   rejected · cancelled                       → «rechazado».
--   refunded · charged_back · cualquier otro   → «ignorado», y se dice. LOS REEMBOLSOS NO SE MANEJAN todavía (no se quita el periodo): roadmap.
-- Un pendiente o un rechazo tardío NUNCA baja una orden que ya está pagada.
--
-- ── Solo el servidor escribe ────────────────────────────────────────────────
-- Las dos funciones son de `service_role` (las llaman las Edge Functions `crear-pago` y `mp-webhook`). La cuenta lee SUS órdenes, para poder
-- decir «tu pago está pendiente», y nada más.
--
-- Códigos propios: CP015 (demasiadas órdenes sin pagar). Reutiliza CP011 (plan no disponible) y 22023 (falta el id del pago).
--
-- Lo que NO hace: no llama a Mercado Pago. Eso, y la verificación de la firma, es de las Edge Functions (pasos siguientes).
--
-- Reversión:
--   drop function if exists registrar_pago_mp(uuid, text, text, integer), crear_orden_pago(uuid, text);
--   alter table pagos drop column if exists orden_id;
--   drop table if exists ordenes_pago;

-- ── Órdenes ─────────────────────────────────────────────────────────────────
create table if not exists ordenes_pago (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid not null,
  rol              text not null,
  plan_id          text not null references planes(id),
  -- El precio del catálogo AL CREAR la orden: lo que se compara contra lo que cobró Mercado Pago.
  monto_centavos   integer not null check (monto_centavos > 0),
  -- creada: aún sin aviso · pendiente: Mercado Pago lo recibió y espera (OXXO) · pagada · rechazada.
  estado           text not null default 'creada' check (estado in ('creada', 'pendiente', 'pagada', 'rechazada')),
  mp_preference_id text,
  creada_en        timestamptz not null default now(),
  actualizada_en   timestamptz not null default now(),
  foreign key (usuario_id, rol) references roles_usuario(usuario_id, rol) on delete cascade
);
create index if not exists ordenes_pago_usuario_idx on ordenes_pago (usuario_id, creada_en desc);

alter table pagos add column if not exists orden_id uuid references ordenes_pago(id) on delete set null;

alter table ordenes_pago enable row level security;
revoke all on ordenes_pago from public, anon, authenticated;
grant select on ordenes_pago to authenticated;
grant select, update on ordenes_pago to service_role;

drop policy if exists ordenes_select_propias on ordenes_pago;
create policy ordenes_select_propias on ordenes_pago
  for select to authenticated using (usuario_id = (select auth.uid()));

-- ── Crear la orden ──────────────────────────────────────────────────────────
-- Mismas condiciones que `simular_pago`: plan de pago, de una función que la cuenta tiene APROBADA (un mismo código, CP011, para los tres casos).
create or replace function crear_orden_pago(p_usuario uuid, p_plan text)
returns table (orden_id uuid, monto integer, plan_nombre text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan planes%rowtype;
  v_id   uuid;
begin
  select * into v_plan from planes where id = p_plan;
  if not found or v_plan.precio_centavos = 0 or p_usuario is null or not exists (
    select 1 from roles_usuario where usuario_id = p_usuario and rol = v_plan.rol and estado = 'aprobado'
  ) then
    raise exception 'plan no disponible' using errcode = 'CP011';
  end if;

  -- Cada orden cuesta una llamada a la API de Mercado Pago y una fila: sin tope, un bucle las generaría sin pagar nada.
  if (select count(*) from ordenes_pago
       where usuario_id = p_usuario and estado = 'creada' and creada_en > now() - interval '1 hour') >= 10 then
    raise exception 'demasiadas ordenes sin pagar' using errcode = 'CP015';
  end if;

  insert into ordenes_pago (usuario_id, rol, plan_id, monto_centavos)
  values (p_usuario, v_plan.rol, v_plan.id, v_plan.precio_centavos)
  returning id into v_id;

  return query select v_id, v_plan.precio_centavos, v_plan.nombre;
end;
$$;
revoke execute on function crear_orden_pago(uuid, text) from public, anon, authenticated;
grant execute on function crear_orden_pago(uuid, text) to service_role;

-- ── Registrar el aviso de un pago ───────────────────────────────────────────
-- Devuelve qué pasó, en una palabra, para que la Edge Function lo registre: activado · duplicado · pendiente · rechazado · monto_distinto ·
-- orden_inexistente · ignorado. Nunca lanza por un estado de Mercado Pago que no conoce: lo ignora y lo dice (un 500 haría que reintentara para siempre).
create or replace function registrar_pago_mp(p_orden uuid, p_mp_payment_id text, p_estado_mp text, p_monto_centavos integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden ordenes_pago%rowtype;
  v_fin   timestamptz;
begin
  if p_mp_payment_id is null or btrim(p_mp_payment_id) = '' then
    raise exception 'falta el id del pago' using errcode = '22023';
  end if;

  -- El candado: dos avisos de la MISMA orden se serializan aquí, así que el segundo ve lo que el primero confirmó.
  select * into v_orden from ordenes_pago where id = p_orden for update;
  if not found then
    return 'orden_inexistente';
  end if;

  if p_estado_mp = 'approved' then
    -- El monto lo fijó el servidor al crear la orden; lo que cobró Mercado Pago tiene que coincidir.
    if p_monto_centavos is distinct from v_orden.monto_centavos then
      return 'monto_distinto';
    end if;
    if exists (select 1 from pagos where mp_payment_id = btrim(p_mp_payment_id)) then
      return 'duplicado';
    end if;

    -- El periodo se SUMA al que aún queda, dentro del upsert (0076): nada que leer antes.
    insert into suscripciones (usuario_id, rol, plan_id, vigente_hasta)
    values (v_orden.usuario_id, v_orden.rol, v_orden.plan_id, now() + interval '30 days')
    on conflict (usuario_id, rol) do update
      set plan_id = excluded.plan_id,
          vigente_hasta = greatest(coalesce(suscripciones.vigente_hasta, now()), now()) + interval '30 days'
    returning vigente_hasta into v_fin;

    insert into pagos (usuario_id, rol, plan_id, monto_centavos, origen, mp_payment_id, periodo_inicio, periodo_fin, orden_id)
    values (v_orden.usuario_id, v_orden.rol, v_orden.plan_id, v_orden.monto_centavos, 'mercadopago', btrim(p_mp_payment_id),
            v_fin - interval '30 days', v_fin, v_orden.id);

    update ordenes_pago set estado = 'pagada', actualizada_en = now() where id = v_orden.id;
    return 'activado';
  end if;

  if p_estado_mp in ('pending', 'in_process', 'authorized', 'in_mediation') then
    if v_orden.estado <> 'pagada' then
      update ordenes_pago set estado = 'pendiente', actualizada_en = now() where id = v_orden.id;
    end if;
    return 'pendiente';
  end if;

  if p_estado_mp in ('rejected', 'cancelled') then
    if v_orden.estado <> 'pagada' then
      update ordenes_pago set estado = 'rechazada', actualizada_en = now() where id = v_orden.id;
    end if;
    return 'rechazado';
  end if;

  return 'ignorado';
end;
$$;
revoke execute on function registrar_pago_mp(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function registrar_pago_mp(uuid, text, text, integer) to service_role;
