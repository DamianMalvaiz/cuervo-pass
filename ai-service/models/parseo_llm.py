"""Documento maestro v5 · §20 y §22 — parseo de perfil con Claude Haiku.

Dos cambios de fondo frente a v3:

1. Las instrucciones van en `system` y el texto del usuario en su propio turno.
   v3 hacía ``_plantilla.format(texto=texto)`` sobre un archivo que contenía
   ejemplos en JSON; las llaves de esos ejemplos — ``{"fuma": false, ...}`` —
   son marcadores de posición para ``str.format``, así que la llamada revienta
   con ``KeyError: '"fuma"'`` en cuanto agregas los ejemplos que el propio
   documento recomendaba agregar. Separarlos también reduce la superficie de
   inyección de prompt: quien escriba "ignora las instrucciones anteriores"
   está hablando dentro de su turno, no encima de las reglas.

2. Cliente perezoso con timeout explícito, en vez de construirlo en tiempo de
   import con una key que puede no existir.
"""

import json
import logging

from anthropic import Anthropic, APIConnectionError, APIError, APITimeoutError

import config

_SISTEMA = (config.PROMPTS / "parseo_perfil.txt").read_text(encoding="utf-8")

# `degradado` dice si la respuesta vino del modelo o de los valores neutros. Sin
# ese campo no hay forma de saber si el LLM funciona o si llevas dos semanas
# guardando valores por omisión para todos los usuarios creyendo que sí.
_POR_DEFECTO = {
    "fuma": False,
    "mascotas": False,
    "nivel_ruido": "medio",
    "horario_predominante": "mixto",
    "notas": "",
    "degradado": True,
}

_cliente: Anthropic | None = None


def _obtener_cliente() -> Anthropic | None:
    global _cliente
    if not config.ANTHROPIC_API_KEY:
        return None
    if _cliente is None:
        _cliente = Anthropic(
            api_key=config.ANTHROPIC_API_KEY,
            timeout=config.TIMEOUT_LLM,
            max_retries=1,
        )
    return _cliente


def parsear_perfil(texto: str) -> dict:
    cliente = _obtener_cliente()
    if cliente is None:
        return dict(_POR_DEFECTO)

    try:
        respuesta = cliente.messages.create(
            model=config.MODELO_LLM,
            max_tokens=300,
            system=_SISTEMA,                         # instrucciones separadas del dato
            messages=[{"role": "user", "content": texto}],
        )
    except (APIConnectionError, APITimeoutError, APIError, TypeError) as e:
        # Sin internet, la API tarda demasiado, Anthropic devolvió un error, o la
        # key es inválida (el SDK lanza TypeError para eso). Nunca dejes que esto
        # tumbe el registro del usuario. El texto NO se registra: §29, minimización.
        logging.warning("Claude Haiku no respondió: %s", e)
        return dict(_POR_DEFECTO)

    crudo = respuesta.content[0].text.strip()
    if crudo.startswith("```"):                      # por si envuelve el JSON
        crudo = crudo.strip("`").removeprefix("json").strip()

    try:
        datos = json.loads(crudo)
    except json.JSONDecodeError:
        logging.warning("respuesta no parseable (%d caracteres)", len(crudo))
        return dict(_POR_DEFECTO)

    return _normalizar(datos)


def _normalizar(d: dict) -> dict:
    # Si el modelo devuelve algo fuera del CHECK de la tabla (nivel_ruido:
    # "extremo"), el insert en Supabase falla con un 500 feo. Se normaliza aquí,
    # que es la validación de salida del §28 contra inyección de prompt: nada de
    # lo que diga el modelo llega a la base sin pasar por esta lista cerrada.
    if d.get("nivel_ruido") not in ("bajo", "medio", "alto"):
        d["nivel_ruido"] = "medio"
    if d.get("horario_predominante") not in ("diurno", "nocturno", "mixto"):
        d["horario_predominante"] = "mixto"
    return {
        "fuma": bool(d.get("fuma", False)),
        "mascotas": bool(d.get("mascotas", False)),
        "nivel_ruido": d["nivel_ruido"],
        "horario_predominante": d["horario_predominante"],
        "notas": str(d.get("notas", ""))[:120],
        "degradado": False,
    }
