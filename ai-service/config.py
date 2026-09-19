"""Documento maestro v5 · §21 — configuración del microservicio.

v3 hacía ``os.environ["ANTHROPIC_API_KEY"]`` en tiempo de import. Eso hace que
el módulo falle al importarse cuando la variable no existe: tumba los tests,
tumba CI y deja una ✗ roja permanente en el repositorio que se evalúa.
Aquí todo es ``.get`` con valor por omisión.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

# Nunca dependas del directorio actual: `uvicorn main:app` desde la raíz del
# repo y desde ai-service/ resolvían rutas distintas, y el prompt solo se
# encontraba en uno de los dos casos.
RAIZ = Path(__file__).resolve().parent
PROMPTS = RAIZ / "prompts"

# ═══ Por qué se carga el .env aquí y no fuera ═══
#
# Había TRES formas de arrancar este servicio y cada una leía un sitio distinto:
#
#   · scripts/tunel.sh:42   → el .env de la RAÍZ, con `set -a && . ../.env`
#   · docker compose up     → ai-service/.env, vía `env_file`
#   · uvicorn main:app      → NADA. `os.getenv` pelado y ningún cargador.
#     (README, la línea que más se usa en desarrollo)
#
# La tercera era un fallo de seguridad, no una molestia: sin AI_SHARED_TOKEN en
# el entorno, el guard de main.py no autenticaba a nadie y el servicio —con
# ANTHROPIC_API_KEY dentro y un túnel público delante— quedaba abierto.
#
# `override=False` a propósito: lo que YA está en el entorno manda. Docker
# inyecta por `env_file` y el shell puede exportar; el archivo solo rellena lo
# que falte. Así las tres rutas convergen sin que ninguna pise a la otra.
ENV_CARGADO = load_dotenv(RAIZ / ".env", override=False)

# Cambio crítico frente a v3 (§9): `all-MiniLM-L6-v2` está entrenado sobre
# corpus en inglés. Acepta español sin quejarse y produce vectores —por eso es
# fácil no darse cuenta— pero la similitud semántica se degrada fuera del
# inglés. Toda la app es en español: descripciones, perfiles, texto libre. Usar
# un modelo inglés ahí hacía que lo único que distingue al proyecto fuera
# también lo más débil.
#
# Mismas 384 dimensiones, así que el esquema no cambia. Cuesta ~470 MB en disco
# en vez de ~90 MB, irrelevante a esta escala.
MODELO_EMBEDDINGS = os.getenv("MODELO_EMBEDDINGS", "paraphrase-multilingual-MiniLM-L12-v2")
MODELO_LLM = os.getenv("MODELO_LLM", "claude-haiku-4-5-20251001")

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

# Por omisión el SDK de Anthropic espera MINUTOS. Sin un timeout explícito, el
# respaldo "nunca dejes que esto tumbe el registro" jamás se activa en el
# escenario más común, que es una red lenta — no una caída total.
TIMEOUT_LLM = float(os.getenv("TIMEOUT_LLM", "8"))

# Token compartido con la Edge Function `ai-proxy`. Se acepta un segundo token
# durante la ventana de rotación (§24, AUD-12): una rotación que exige apagar el
# servicio es una rotación que nunca se hace.
AI_SHARED_TOKEN = os.getenv("AI_SHARED_TOKEN")
AI_SHARED_TOKEN_SIGUIENTE = os.getenv("AI_SHARED_TOKEN_SIGUIENTE")
