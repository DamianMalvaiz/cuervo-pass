import json
import logging
import os
from anthropic import Anthropic, APIError, APIConnectionError, APITimeoutError

_cliente = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
_MODELO = "claude-haiku-4-5-20251001"

_VALORES_POR_DEFECTO = {
    "fuma": False, "mascotas": False, "nivel_ruido": "medio",
    "horario_predominante": "mixto", "notas": "no se pudo interpretar, valores por defecto"
}

with open("prompts/parseo_perfil.txt", encoding="utf-8") as f:
    _plantilla = f.read()


def parsear_perfil(texto: str) -> dict:
    prompt = _plantilla.format(texto=texto)
    try:
        respuesta = _cliente.messages.create(
            model=_MODELO,
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )
    except (APIConnectionError, APITimeoutError, APIError) as e:
        # Sin internet, la API tarda demasiado, o Anthropic regresó un error
        # (rate limit, 5xx, etc.) — nunca dejes que esto tumbe el registro del
        # usuario. Degrada a valores neutros y sigue el flujo.
        logging.warning(f"Fallo al llamar a Claude Haiku: {e}")
        return _VALORES_POR_DEFECTO

    contenido = respuesta.content[0].text.strip()
    try:
        resultado = json.loads(contenido)
    except json.JSONDecodeError:
        # Respaldo si el modelo no regresa JSON perfecto (ej. texto extra alrededor)
        return _VALORES_POR_DEFECTO

    return _validar_resultado(resultado)


def _validar_resultado(resultado: dict) -> dict:
    # Blindaje extra: si Claude regresa un valor fuera del check constraint de
    # la tabla `usuarios` (ej. nivel_ruido: "extremo"), el insert en Supabase
    # truena con un 500 feo. Mejor normalizar aquí, antes de que llegue a la DB.
    if resultado.get("nivel_ruido") not in ("bajo", "medio", "alto"):
        resultado["nivel_ruido"] = "medio"
    if resultado.get("horario_predominante") not in ("diurno", "nocturno", "mixto"):
        resultado["horario_predominante"] = "mixto"
    resultado["fuma"] = bool(resultado.get("fuma", False))
    resultado["mascotas"] = bool(resultado.get("mascotas", False))
    resultado.setdefault("notas", "")
    return resultado
