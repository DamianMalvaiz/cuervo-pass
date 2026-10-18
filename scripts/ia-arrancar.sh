#!/usr/bin/env bash
#
# Levanta (o reconstruye) el microservicio de IA con el commit del árbol dentro, y espera a que esté listo.
#
# Por qué existe: el contenedor no tiene git, así que el commit que reporta tiene que entrar desde fuera. Antes quedaba atrás: el 18/10/2026 el contenedor llevaba
# 25 horas sirviendo `7ba59a4` con el árbol en `78d0a87`, y `tunel.sh` (con razón) se negaba a continuar. Esto lo calcula siempre.
#
# Usa `docker` a secas y no `docker compose`: en esta máquina el complemento de compose no está instalado. Replica lo que dice docker-compose.yml (mismo puerto, mismo
# volumen del modelo —sin él cada reconstrucción baja ~470 MB—, mismo archivo de entorno y reinicio automático).
#
#   ./scripts/ia-arrancar.sh
#
set -euo pipefail
cd "$(dirname "$0")/.."

NOMBRE="cuervo-pass-ai-service-1"
IMAGEN="cuervo-pass-ai-service"
VOLUMEN="cuervo-pass_hf-cache"

if [ ! -f ai-service/.env ]; then
  echo "Falta ai-service/.env (cp ai-service/.env.example ai-service/.env y rellénalo)." >&2
  exit 1
fi

COMMIT="$(git log -1 --format=%h -- ai-service)"
echo "→ Construyendo la imagen (commit $COMMIT)…"
docker build -q -t "$IMAGEN" ./ai-service >/dev/null

echo "→ Reemplazando el contenedor…"
docker rm -f "$NOMBRE" >/dev/null 2>&1 || true
docker volume create "$VOLUMEN" >/dev/null
docker run -d --name "$NOMBRE" --restart unless-stopped \
  -p 8000:8000 --env-file ai-service/.env -e "CUERVO_COMMIT=$COMMIT" \
  -v "$VOLUMEN":/opt/hf "$IMAGEN" >/dev/null

echo "→ Esperando a que cargue el modelo (puede tardar ~30 s)…"
for _ in $(seq 1 60); do
  RESP="$(curl -sf -m 3 http://127.0.0.1:8000/listo 2>/dev/null || true)"
  if [ -n "$RESP" ]; then
    VIVO="$(printf '%s' "$RESP" | grep -oE '"commit"[[:space:]]*:[[:space:]]*"[^"]*"' | sed -E 's/.*"([^"]*)"$/\1/')"
    if [ "$VIVO" = "$COMMIT" ]; then
      echo "   listo: sirve $VIVO, el mismo del árbol."
      echo "   Siguiente: tu túnel fijo (docs/ia-local.md) y ./scripts/tunel.sh"
      exit 0
    fi
    echo "   responde, pero sirve '$VIVO' y el árbol está en '$COMMIT'. Revisa el contenedor." >&2
    exit 1
  fi
  sleep 3
done
echo "   No respondió en 3 minutos. Mira: docker logs $NOMBRE" >&2
exit 1
