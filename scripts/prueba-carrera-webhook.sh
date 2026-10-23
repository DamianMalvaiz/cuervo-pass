#!/usr/bin/env bash
#
# Prueba del webhook DUPLICADO de Mercado Pago contra `registrar_pago_mp` (migración 0077). Solo contra el Supabase LOCAL.
#
# Mercado Pago reintenta el aviso cada 15 minutos si no recibe 200 en 22 s, y puede entregar el mismo aviso dos veces a la vez. Aquí son dos
# sesiones de verdad registrando el MISMO pago de la MISMA orden:
#
#   A: begin; registra mp-race-1; espera 4 s SIN confirmar; commit.
#   B: (1 s después) registra mp-race-1. El candado de la fila de la orden (`for update`) la deja esperando; cuando A confirma, B ve el pago ya
#      registrado y contesta `duplicado`.
#
# Esperado: A = activado, B = duplicado, UN pago y ~30 días. Sin el candado, B no ve el pago de A (no está confirmado), suma otros 30 días y revienta
# después contra la restricción única: la función falla en vez de contestar `duplicado`, y Mercado Pago recibiría un 500 y reintentaría.
#
#   supabase start            # y las migraciones aplicadas
#   ./scripts/prueba-carrera-webhook.sh
#
# Sale con 0 si todo salió como se espera, con 1 si no, con 2 si no hay Supabase local.
set -euo pipefail

DB="${DB_CONTAINER:-supabase_db_cuervo-pass}"
UID_PRUEBA='00000000-0000-0000-0000-0000000000c8'
PAGO='mp-race-1'

if ! docker ps --format '{{.Names}}' | grep -qx "$DB"; then
  echo "No encuentro el contenedor $DB. Levanta el Supabase local con: supabase start" >&2
  exit 2
fi

sql() { docker exec -i "$DB" psql -U postgres -v ON_ERROR_STOP=1 -q -t -A; }

limpiar() {
  echo "delete from auth.users where id = '$UID_PRUEBA';" | sql >/dev/null 2>&1 || true
  rm -f "${SALIDA_A:-/nonexistent}" "${SALIDA_B:-/nonexistent}"
}
trap limpiar EXIT
SALIDA_A="$(mktemp)"
SALIDA_B="$(mktemp)"

limpiar
SALIDA_A="$(mktemp)"
SALIDA_B="$(mktemp)"

ORDEN="$(sql <<EOF
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000000', '$UID_PRUEBA', 'authenticated', 'authenticated', 'webhook@test.mx', '', now(), now(),
        '{"nombre_usuario":"carrera_webhook"}');
insert into roles_usuario (usuario_id, rol, estado) values ('$UID_PRUEBA', 'comerciante', 'aprobado');
insert into suscripciones (usuario_id, rol, prueba_hasta) values ('$UID_PRUEBA', 'comerciante', now() + interval '15 days');
select orden_id from crear_orden_pago('$UID_PRUEBA'::uuid, 'comerciante_basico');
EOF
)"
ORDEN="$(echo "$ORDEN" | tail -1)"

registrar() {
  # $1 = segundos de espera ANTES de confirmar
  sql <<EOF
begin;
select registrar_pago_mp('$ORDEN'::uuid, '$PAGO', 'approved', 9900);
select pg_sleep($1);
commit;
EOF
}

echo "→ A registra el pago y retiene su transacción 4 s; B registra el MISMO pago 1 s después…"
registrar 4 >"$SALIDA_A" 2>&1 &
PID_A=$!
sleep 1
set +e
registrar 0 >"$SALIDA_B" 2>&1
ESTADO_B=$?
set -e
wait "$PID_A" || true

A="$(grep -E '^(activado|duplicado|pendiente|rechazado|monto_distinto|orden_inexistente|ignorado)$' "$SALIDA_A" | head -1 || true)"
B="$(grep -E '^(activado|duplicado|pendiente|rechazado|monto_distinto|orden_inexistente|ignorado)$' "$SALIDA_B" | head -1 || true)"
PAGOS="$(echo "select count(*) from pagos where usuario_id = '$UID_PRUEBA';" | sql)"
DIAS="$(echo "select round((extract(epoch from (vigente_hasta - now())) / 86400)::numeric, 1) from suscripciones where usuario_id = '$UID_PRUEBA';" | sql)"

echo "   A: ${A:-(sin respuesta)} · B: ${B:-(sin respuesta; salida $ESTADO_B)} · pagos: $PAGOS · vigente por: ${DIAS:-?} días (esperado: activado, duplicado, 1, ≈ 30)"

if [ "$A" = "activado" ] && [ "$B" = "duplicado" ] && [ "$PAGOS" = "1" ] && awk "BEGIN { exit !(${DIAS:-0} >= 29.9 && ${DIAS:-0} <= 30.1) }"; then
  echo "OK: el aviso duplicado no extendió dos veces y B recibió «duplicado»."
else
  echo "FALLA: el aviso duplicado no se manejó como se espera." >&2
  [ -s "$SALIDA_B" ] && { echo "--- salida de B ---" >&2; head -5 "$SALIDA_B" >&2; }
  exit 1
fi
