#!/usr/bin/env bash
#
# Prueba de la CARRERA de `simular_pago` (hallazgo 2 de la auditoría del 23/10/2026). Solo contra el Supabase LOCAL.
#
# Por qué existe: pgTAP corre el archivo entero en UNA sola transacción y no puede expresar dos pagos que se pisan. Aquí son dos sesiones de verdad:
#
#   A: begin; paga; espera 4 s SIN confirmar; commit.
#   B: (1 s después) paga. Lee `vigente_hasta` — A todavía no confirmó, así que ve el valor viejo —, y su `upsert` espera el candado de la fila.
#
# Con la versión de la 0053 (lee, calcula y luego ESCRIBE `excluded.vigente_hasta`), cuando A confirma B sobrescribe con su cuenta hecha sobre el
# valor viejo: quedan DOS pagos registrados y solo 30 días. Con la 0076 el periodo se suma DENTRO del `on conflict do update`, que ve el valor que A
# acaba de confirmar: 60 días. Es la forma que ha de tener también el webhook de Mercado Pago (llega duplicado y en paralelo).
#
#   supabase start            # y las migraciones aplicadas
#   ./scripts/prueba-carrera-pagos.sh
#
# Sale con 0 si el segundo pago SUMÓ sus 30 días, con 1 si se perdieron.
set -euo pipefail

DB="${DB_CONTAINER:-supabase_db_cuervo-pass}"
UID_PRUEBA='00000000-0000-0000-0000-0000000000c9'
PLAN='comerciante_basico'

if ! docker ps --format '{{.Names}}' | grep -qx "$DB"; then
  echo "No encuentro el contenedor $DB. Levanta el Supabase local con: supabase start" >&2
  exit 2
fi

sql() { docker exec -i "$DB" psql -U postgres -v ON_ERROR_STOP=1 -q -t -A; }

limpiar() {
  echo "delete from auth.users where id = '$UID_PRUEBA'; update configuracion_app set valor = 'false' where clave = 'demo_mode';" | sql >/dev/null 2>&1 || true
}
trap limpiar EXIT

limpiar
sql <<EOF
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000000', '$UID_PRUEBA', 'authenticated', 'authenticated', 'carrera@test.mx', '', now(), now(),
        '{"nombre_usuario":"carrera_pagos"}');
insert into roles_usuario (usuario_id, rol, estado) values ('$UID_PRUEBA', 'comerciante', 'aprobado');
insert into suscripciones (usuario_id, rol, prueba_hasta) values ('$UID_PRUEBA', 'comerciante', now() + interval '15 days');
update configuracion_app set valor = 'true' where clave = 'demo_mode';
EOF

pagar() {
  # $1 = segundos de espera ANTES de confirmar (0 = ninguna)
  sql <<EOF >/dev/null
begin;
select set_config('request.jwt.claims', json_build_object('sub', '$UID_PRUEBA', 'role', 'authenticated')::text, true);
set local role authenticated;
select simular_pago('$PLAN');
select pg_sleep($1);
commit;
EOF
}

echo "→ A paga y retiene su transacción 4 s; B paga 1 s después…"
pagar 4 &
PID_A=$!
sleep 1
pagar 0
wait "$PID_A"

DIAS="$(echo "select round((extract(epoch from (vigente_hasta - now())) / 86400)::numeric, 1) from suscripciones where usuario_id = '$UID_PRUEBA';" | sql)"
PAGOS="$(echo "select count(*) from pagos where usuario_id = '$UID_PRUEBA';" | sql)"
CONTIGUOS="$(echo "select count(*) from pagos a join pagos b on b.usuario_id = a.usuario_id and b.periodo_inicio = a.periodo_fin where a.usuario_id = '$UID_PRUEBA';" | sql)"

echo "   pagos registrados: $PAGOS · periodos encadenados: $CONTIGUOS · vigente por: $DIAS días (esperado ≈ 60)"

if [ "$PAGOS" = "2" ] && [ "$CONTIGUOS" = "1" ] && awk "BEGIN { exit !($DIAS >= 59.9) }"; then
  echo "OK: el segundo pago sumó sus 30 días."
else
  echo "FALLA: dos pagos y solo $DIAS días de vigencia (o periodos que se pisan): se perdió un periodo." >&2
  exit 1
fi
