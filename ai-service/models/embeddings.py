from sentence_transformers import SentenceTransformer

_modelo = SentenceTransformer("all-MiniLM-L6-v2")  # se carga una sola vez al iniciar


def generar_embedding(texto: str) -> list[float]:
    vector = _modelo.encode(texto, normalize_embeddings=True)
    return vector.tolist()
