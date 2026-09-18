"""Documento maestro v5 · §22 — generación de embeddings.

Carga perezosa en vez de en tiempo de import (v3): importar este módulo ya no
descarga ~470 MB, así que `pytest --collect-only` y cualquier herramienta que
inspeccione el código siguen siendo instantáneos.
"""

from sentence_transformers import SentenceTransformer

import config

_modelo: SentenceTransformer | None = None


def _obtener() -> SentenceTransformer:
    global _modelo
    if _modelo is None:
        _modelo = SentenceTransformer(config.MODELO_EMBEDDINGS)
    return _modelo


def precalentar() -> None:
    """Se llama en el arranque (lifespan) para que la primera petición real no
    pague la carga del modelo."""
    _obtener().encode("precalentamiento")


def nombre_modelo() -> str:
    return config.MODELO_EMBEDDINGS


def generar_embedding(texto: str) -> list[float]:
    # normalize_embeddings=True hace que el coseno equivalga al producto punto,
    # y que pgvector con vector_cosine_ops sea consistente con lo que guardas.
    return _obtener().encode(texto, normalize_embeddings=True).tolist()
