"""Documento maestro v5 · §21 — configuración del microservicio.

v3 hacía ``os.environ["ANTHROPIC_API_KEY"]`` en tiempo de import. Eso hace que
el módulo falle al importarse cuando la variable no existe: tumba los tests,
tumba CI y deja una ✗ roja permanente en el repositorio que se evalúa.
Aquí todo es ``.get`` con valor por omisión.
"""

import os
from pathlib import Path

# Nunca dependas del directorio actual: `uvicorn main:app` desde la raíz del
# repo y desde ai-service/ resolvían rutas distintas, y el prompt solo se
# encontraba en uno de los dos casos.
RAIZ = Path(__file__).resolve().parent
PROMPTS = RAIZ / "prompts"

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
