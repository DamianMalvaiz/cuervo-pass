-- El periodo prepagado se suma DENTRO del upsert · hallazgo 2 de la auditoría del 23/10/2026.
--
-- ── El hueco ────────────────────────────────────────────────────────────────
-- `simular_pago` (0053) hacía tres pasos separados: LEE `vigente_hasta`, calcula el fin, y luego ESCRIBE `excluded.vigente_hasta`. Dos pagos que se
-- cruzan leen el mismo valor viejo, y cuando el segundo obtiene el candado de la fila sobrescribe el resultado del primero: quedan DOS pagos
-- registrados y 30 días de vigencia. Reproducido con dos sesiones reales (`scripts/prueba-carrera-pagos.sh`): 2 pagos, periodos sin encadenar,
-- 30,0 días. Con el pago simulado casi no ocurre; con Mercado Pago sí: el webhook llega duplicado y en paralelo.
--
-- ── Lo que hace ─────────────────────────────────────────────────────────────
-- El fin se calcula en el `on conflict do update`: ahí PostgreSQL toma el candado de la fila y, al obtenerlo, evalúa la expresión contra el valor
-- que dejó quien confirmó antes. Dos pagos simultáneos se serializan y cada uno suma sus 30 días (60). El inicio del periodo del pago se deduce del
-- fin (`fin - 30 días`), así que los periodos de pagos consecutivos quedan encadenados.
--
-- Sigue siendo la plantilla para el pago real: el webhook de Mercado Pago ha de extender así y, además, ser idempotente con `pagos.mp_payment_id`
-- (único) — insertar el pago ANTES con `on conflict (mp_payment_id) do nothing` y extender solo si insertó.
--
-- Reversión: volver a crear `simular_pago` con el cuerpo de la 0053.

create or replace function simular_pago(p_plan text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_plan planes%rowtype;
  v_fin  timestamptz;
begin
  if v_uid is null then
    raise exception 'sin sesion' using errcode = '28000';
  end if;

  -- Falla CERRADO: sin la fila, o con cualquier valor que no sea exactamente 'true', está apagado.
  if coalesce((select valor from configuracion_app where clave = 'demo_mode'), 'false') <> 'true' then
    raise exception 'modo demostracion apagado' using errcode = 'CP010';
  end if;

  select * into v_plan from planes where id = p_plan;
  -- Plan inexistente, gratuito, o de una función que esta cuenta no tiene APROBADA: un mismo código para los tres.
  if not found or v_plan.precio_centavos = 0 or not exists (
    select 1 from roles_usuario where usuario_id = v_uid and rol = v_plan.rol and estado = 'aprobado'
  ) then
    raise exception 'plan no disponible' using errcode = 'CP011';
  end if;

  -- El periodo se SUMA al que aún queda (pagar antes de vencer no pierde días), y se suma AQUÍ, no leyendo antes: ver la cabecera.
  insert into suscripciones (usuario_id, rol, plan_id, vigente_hasta)
  values (v_uid, v_plan.rol, v_plan.id, now() + interval '30 days')
  on conflict (usuario_id, rol) do update
    set plan_id = excluded.plan_id,
        vigente_hasta = greatest(coalesce(suscripciones.vigente_hasta, now()), now()) + interval '30 days'
  returning vigente_hasta into v_fin;

  insert into pagos (usuario_id, rol, plan_id, monto_centavos, origen, periodo_inicio, periodo_fin)
  values (v_uid, v_plan.rol, v_plan.id, v_plan.precio_centavos, 'simulado', v_fin - interval '30 days', v_fin);

  return v_fin;
end;
$$;

revoke execute on function simular_pago(text) from public, anon, authenticated;
grant execute on function simular_pago(text) to authenticated;
