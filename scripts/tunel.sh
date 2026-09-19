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
  echo "     cd ai-service && set -a && . ../.env && set +a && .venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000" >&2
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

# 4. Esperar a que el DNS propague y comprobar A TRAVÉS del túnel, no en
#    localhost: el punto es probar el camino que la Edge Function va a usar.
echo "→ Esperando propagación de DNS…"
for _ in $(seq 1 40); do
  if curl -sf -m 8 "$URL/listo" >/dev/null 2>&1; then break; fi
  sleep 3
done
if ! curl -sf -m 10 "$URL/listo" >/dev/null 2>&1; then
  echo "   El túnel no responde todavía. Revisa $REGISTRO" >&2
  exit 1
fi
echo "   /listo responde a través del túnel."

# 5. Apuntar la Edge Function al dominio nuevo.
echo "→ Actualizando el secret AI_SERVICE_URL…"
set -a
# shellcheck disable=SC1091
. ./.env
set +a
npx supabase secrets set AI_SERVICE_URL="$URL" >/dev/null
echo "   listo."

echo
echo "Túnel arriba: $URL"
echo "Si el Nivel 2 desaparece a media demo, vuelve a correr este comando."
