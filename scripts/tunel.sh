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
#   ./scripts/tunel.sh            # reutiliza el túnel si sigue sano
#   ./scripts/tunel.sh --forzar   # levanta uno nuevo pase lo que pase
#   ./scripts/tunel.sh --rapido   # ignora la URL fija y usa un túnel rápido de Cloudflare
#
# DOS MODOS:
#   · URL FIJA (recomendado): si `.env.server` trae `AI_SERVICE_URL_FIJA=https://ia.cuervo360.com` (o un ngrok/`.ts.net`), NO se abre ningún túnel
#     aquí: tú mantienes el tuyo (`ngrok http --url=<tu-dominio> 8000`) y este script SOLO comprueba que responde y que el secret apunta ahí. El dominio no
#     cambia, así que el secret se fija una vez. Ver docs/ia-local.md.
#   · RÁPIDO (por omisión si no hay URL fija): abre un túnel de cloudflared. Su dominio cambia en cada arranque y su DNS llegó a tardar MÁS DE MEDIA HORA.
#
set -euo pipefail

FORZAR=0
RAPIDO=0
for a in "$@"; do
  case "$a" in
    --forzar) FORZAR=1 ;;
    --rapido) RAPIDO=1 ;;
  esac
done

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
LOCAL="$(curl -sf -m 5 http://127.0.0.1:8000/listo || true)"
if [ -z "$LOCAL" ]; then
  echo "   El microservicio NO responde. Levántalo primero:" >&2
  # Ya no hace falta `set -a && . ../.env`: config.py carga ai-service/.env
  # por su cuenta. Las tres rutas de arranque (esta, docker compose y el
  # README) leen ahora el mismo archivo.
  echo "     cd ai-service && .venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000" >&2
  echo "     (si falla con AI_SHARED_TOKEN ausente: cp .env.example .env y rellenalo)" >&2
  exit 1
fi
echo "   responde."

# 1.b · E.6 · ¿QUE CODIGO está sirviendo ese proceso?
#
# Que el puerto 8000 responda no significa que responda lo que acabas de
# escribir. Durante la auditoría, un uvicorn llevaba TRECE HORAS con código
# anterior a una corrección ya aplicada: respondía, el modelo estaba cargado,
# `/listo` decía «ok», y se midió ese servidor viejo dando por hecho que era el
# nuevo. `uvicorn` además tarda entre 6 y 40 s en fallar al enlazar el puerto
# —falla DESPUÉS de cargar el modelo—, así que durante ese rato parece que
# arrancó y en realidad el que contesta es el de antes.
#
# Esto no lo adivina: lo pregunta.
# El ultimo commit que toco ai-service, no el HEAD del repositorio.
COMMIT_ARBOL="$(git log -1 --format=%h -- ai-service 2>/dev/null || true)"
COMMIT_VIVO="$(printf '%s' "$LOCAL" | grep -oE '"commit"[[:space:]]*:[[:space:]]*"[^"]*"' | sed -E 's/.*"([^"]*)"$/\1/' || true)"

if [ -z "$COMMIT_VIVO" ]; then
  echo "   ⚠  el microservicio no reporta su commit: arrancó con código anterior a E.6."
  echo "      Reinícialo para que este aviso pueda decirte algo útil."
elif [ -n "$COMMIT_ARBOL" ] && [ "$COMMIT_VIVO" != "$COMMIT_ARBOL" ]; then
  echo "   ✗  sirve $COMMIT_VIVO y el árbol está en $COMMIT_ARBOL." >&2
  echo "      Lo que midas a partir de aquí será de una versión que ya no existe." >&2
  echo "      Reinícialo y vuelve a correr esto:" >&2
  echo "        pkill -f 'uvicorn main:app' && cd ai-service && .venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000" >&2
  exit 1
else
  echo "   sirviendo $COMMIT_VIVO, el mismo del árbol."
fi

# 1.c · MODO URL FIJA.
#
# Un dominio estable cambia lo que hay que vigilar: ya no se abre ni se cierra nada aquí (el cliente del túnel lo mantienes tú y se reconecta solo), y el
# secret no se vuelve a tocar mientras el dominio sea el mismo. Lo único que se pregunta es lo que importa: ¿responde por el camino PÚBLICO?
URL_FIJA="${AI_SERVICE_URL_FIJA:-}"
if [ -z "$URL_FIJA" ] && [ -f .env.server ]; then
  URL_FIJA="$(grep -E '^AI_SERVICE_URL_FIJA=' .env.server | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '[:space:]' || true)"
fi

if [ -n "$URL_FIJA" ] && [ "$RAPIDO" -eq 0 ]; then
  echo "→ Modo URL fija: $URL_FIJA"
  if ! node scripts/dominio-tunel.mjs "$URL_FIJA"; then
    echo "   Corrige AI_SERVICE_URL_FIJA en .env.server (solo el origen, sin ruta)." >&2
    exit 1
  fi
  # `ngrok-skip-browser-warning`: la cuenta gratuita de ngrok muestra una página intermedia a las peticiones que parecen de un navegador; con esta cabecera no.
  if ! curl -sf -m 10 -H 'ngrok-skip-browser-warning: 1' "$URL_FIJA/listo" >/dev/null 2>&1; then
    echo "   $URL_FIJA NO responde." >&2
    echo "   El microservicio local sí (puerto 8000), así que falta el TÚNEL." >&2
    case "$URL_FIJA" in
      *.cuervo360.com)
        echo "   Es el túnel con nombre de Cloudflare:  systemctl --user status cloudflared-ia   (y   systemctl --user restart cloudflared-ia )" >&2
        echo "   Registro:  journalctl --user -u cloudflared-ia -n 30     Guía: docs/ia-local.md" >&2 ;;
      *)
        echo "   En otra terminal:  ngrok http --url=${URL_FIJA#https://} 8000" >&2
        echo "   (si es Tailscale:  tailscale funnel --bg 8000)   y vuelve a correr este script." >&2 ;;
    esac
    exit 1
  fi
  echo "   responde por el camino público."

  if [ "$FORZAR" -eq 0 ] && [ -f .tunel-actual ] && [ "$(tr -d '[:space:]' < .tunel-actual)" = "$URL_FIJA" ]; then
    echo "   el secret ya apunta aquí. No se toca."
  else
    echo "→ Fijando el secret AI_SERVICE_URL (una sola vez para este dominio)…"
    set -a
    # shellcheck disable=SC1091
    . ./.env
    # shellcheck disable=SC1091
    [ -f ./.env.server ] && . ./.env.server
    set +a
    npx supabase secrets set AI_SERVICE_URL="$URL_FIJA" >/dev/null
    echo "$URL_FIJA" > .tunel-actual
    echo "   listo."
  fi
  echo
  echo "Túnel arriba (fijo): $URL_FIJA"
  exit 0
fi

# 2. E.6 · Un túnel SANO no se mata.
#
# Este script empezaba siempre de cero. Dos ejecuciones seguidas dejaron el
# sistema sin túnel durante diez minutos de propagación de DNS — por precaución,
# se destruía lo único que funcionaba.
#
# La inferencia sobre el secret: `.tunel-actual` se escribe JUSTO DESPUÉS de
# `supabase secrets set`, en este mismo script, así que si el dominio de ese
# archivo responde, el secret apunta ahí. Deja de valer si alguien cambió el
# secret a mano; para ese caso está `--forzar`.
if [ "$FORZAR" -eq 0 ] && [ -f .tunel-actual ]; then
  ANTERIOR="$(cat .tunel-actual)"

  # V.3 · Validar ANTES de confiar.
  #
  # El 19/09 este archivo contenía `http://127.0.0.1:8000`. El `curl` de abajo
  # contra localhost responde 200 siempre, así que el script decía «sigue vivo»,
  # salía con 0, y NUNCA volvía a crear un túnel. Comprobar el túnel preguntando
  # a localhost es el fallo que este script existe para evitar.
  #
  # La regla vive en scripts/dominio-tunel.mjs, una sola vez, y la comparte con
  # verificar.mjs. Dos copias en dos lenguajes se desincronizan.
  if ! node scripts/dominio-tunel.mjs "$ANTERIOR"; then
    ANTERIOR=""
  fi

  if [ -n "$ANTERIOR" ] && curl -sf -m 8 "$ANTERIOR/listo" >/dev/null 2>&1; then
    echo "   sigue vivo. No se toca."
    echo
    echo "Túnel arriba: $ANTERIOR"
    echo "(usa --forzar si necesitas uno nuevo de todas formas)"
    exit 0
  fi
  echo "   no responde; se levanta uno nuevo."
fi

# 2.b Matar cualquier túnel anterior, incluido el que está atorado reintentando.
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
