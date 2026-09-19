#!/usr/bin/env bash
#
# Levanta el túnel hacia el microservicio de IA y deja `AI_SERVICE_URL`
# apuntando al dominio nuevo.
#
# Por qué existe: los túneles rápidos de cloudflared (*.trycloudflare.com)
# CADUCAN. Cuando eso pasa, el proceso no se muere — se queda reintentando para
# siempre con "Unauthorized: Tunnel not found", así que nada te avisa. La Edge
# Function `ai-proxy` sigue apuntando al dominio muerto, las sugerencias caen a
# Nivel 1, y desde la app parece que simplemente "así funciona".
#
# Correr esto ANTES de cada exposición, y otra vez si el Nivel 2 desaparece a
# media demo.
#
#   ./scripts/tunel.sh
#
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "No encuentro .env en $(pwd)" >&2
  exit 1
fi

CLOUDFLARED="${CLOUDFLARED:-$HOME/.local/bin/cloudflared}"
if [ ! -x "$CLOUDFLARED" ]; then
  CLOUDFLARED="$(command -v cloudflared || true)"
fi
if [ -z "$CLOUDFLARED" ] || [ ! -x "$CLOUDFLARED" ]; then
  echo "No encuentro cloudflared. Instálalo con:" >&2
  echo "  curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o ~/.local/bin/cloudflared && chmod +x ~/.local/bin/cloudflared" >&2
  exit 1
fi

# 1. El microservicio tiene que estar arriba ANTES del túnel: un túnel hacia un
#    puerto muerto se conecta igual y devuelve 502, que es más difícil de
#    diagnosticar que un fallo de conexión limpio.
echo "→ Comprobando el microservicio en 127.0.0.1:8000…"
if ! curl -sf -m 5 http://127.0.0.1:8000/listo >/dev/null; then
  echo "   El microservicio NO responde. Levántalo primero:" >&2
  # Ya no hace falta `set -a && . ../.env`: config.py carga ai-service/.env
  # por su cuenta. Las tres rutas de arranque (esta, docker compose y el
  # README) leen ahora el mismo archivo.
  echo "     cd ai-service && .venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000" >&2
  echo "     (si falla con AI_SHARED_TOKEN ausente: cp .env.example .env y rellenalo)" >&2
  exit 1
fi
echo "   responde."

# 2. Matar cualquier túnel anterior, incluido el que está atorado reintentando.
if pgrep -f "cloudflared tunnel --url" >/dev/null; then
  echo "→ Cerrando el túnel anterior…"
  pkill -f "cloudflared tunnel --url" || true
  sleep 2
fi

# 3. Levantar el nuevo y esperar a que Cloudflare asigne dominio.
REGISTRO="$(mktemp -t cuervo-tunel-XXXXXX.log)"
echo "→ Abriendo túnel nuevo… (registro: $REGISTRO)"
nohup "$CLOUDFLARED" tunnel --url http://127.0.0.1:8000 >"$REGISTRO" 2>&1 &

URL=""
for _ in $(seq 1 60); do
  URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$REGISTRO" 2>/dev/null | head -1 || true)"
  [ -n "$URL" ] && break
  sleep 1
done

if [ -z "$URL" ]; then
  echo "   Cloudflare no asignó dominio en 60 s. Revisa $REGISTRO" >&2
  exit 1
fi
echo "   dominio: $URL"

# 4. El secret se fija PRIMERO, antes de esperar al DNS.
#
#    Por qué en este orden: el dominio ya está asignado y es definitivo; lo único
#    pendiente es que Cloudflare publique su registro DNS. Eso tardó MÁS DE MEDIA
#    HORA una noche de septiembre de 2026, y una versión anterior de este script
#    lo daba por muerto a los dos minutos y salía con error — dejando el secret
#    apuntando al túnel ANTERIOR, que sí estaba muerto. Fijarlo primero hace que
#    la espera sea solo informativa.
echo "→ Actualizando el secret AI_SERVICE_URL…"
set -a
# shellcheck disable=SC1091
. ./.env
# El de servidor tambien: `supabase secrets set` necesita credenciales que
# desde la ORDEN A.3 ya no estan en el de cliente.
# shellcheck disable=SC1091
[ -f ./.env.server ] && . ./.env.server
set +a
npx supabase secrets set AI_SERVICE_URL="$URL" >/dev/null
echo "   listo."

# El dominio vivo queda en un archivo estable: rastrearlo por el nombre aleatorio
# del registro es frágil cuando hay varios túneles viejos en /tmp.
echo "$URL" > .tunel-actual
echo "   dominio guardado en .tunel-actual"

# 5. Esperar a que el DNS propague, comprobando A TRAVÉS del túnel y no en
#    localhost: el punto es probar el camino que la Edge Function va a usar.
echo "→ Esperando propagación de DNS (hasta 10 minutos)…"
for i in $(seq 1 120); do
  if curl -sf -m 8 "$URL/listo" >/dev/null 2>&1; then
    echo "   /listo responde a través del túnel tras $((i * 5)) s."
    echo
    echo "Túnel arriba: $URL"
    exit 0
  fi
  sleep 5
done

echo
echo "El dominio sigue sin resolver tras 10 minutos." >&2
echo "El secret YA apunta ahí, así que en cuanto Cloudflare publique el DNS" >&2
echo "empezará a funcionar solo. Para comprobarlo:" >&2
echo "  curl -s -o /dev/null -w '%{http_code}\n' $URL/listo" >&2
echo "Registro de cloudflared: $REGISTRO" >&2
