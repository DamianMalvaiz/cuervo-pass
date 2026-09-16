import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from models.embeddings import generar_embedding
from models.parseo_llm import parsear_perfil

app = FastAPI(title="Cuervo Pass - Microservicio de IA")
limiter = Limiter(key_func=get_remote_address)


class TextoRequest(BaseModel):
    texto: str


@app.get("/salud")
def salud():
    return {
        "status": "ok",
        "api_llm_configurada": bool(os.environ.get("ANTHROPIC_API_KEY")),
        "modelo_embeddings_cargado": True,
    }


@app.post("/generar-embedding")
@limiter.limit("60/minute")
def endpoint_embedding(request: TextoRequest):
    if not request.texto or len(request.texto.strip()) == 0:
        raise HTTPException(status_code=400, detail="texto vacío")
    vector = generar_embedding(request.texto)
    return {"vector": vector}


@app.post("/parsear-perfil")
@limiter.limit("30/minute")
def endpoint_parseo(request: TextoRequest):
    if not request.texto or len(request.texto.strip()) == 0:
        raise HTTPException(status_code=400, detail="texto vacío")
    resultado = parsear_perfil(request.texto)
    return resultado
