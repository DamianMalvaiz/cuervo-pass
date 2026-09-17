import os
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from models.embeddings import generar_embedding
from models.parseo_llm import parsear_perfil

app = FastAPI(title="Cuervo Pass - Microservicio de IA")
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


class TextoRequest(BaseModel):
    texto: str


@app.get("/salud")
def salud():
    return {
        "status": "ok",
        "api_llm_configurada": bool(os.environ.get("ANTHROPIC_API_KEY")),
        "modelo_embeddings_cargado": True,
    }


# El decorador de slowapi necesita un parámetro llamado `request` que sea el
# Request de Starlette (para sacar la IP del cliente) — el cuerpo JSON no
# puede llamarse igual, o slowapi truena con "parameter `request` must be an
# instance of starlette.requests.Request" antes de llegar a la lógica.
@app.post("/generar-embedding")
@limiter.limit("60/minute")
def endpoint_embedding(request: Request, cuerpo: TextoRequest):
    if not cuerpo.texto or len(cuerpo.texto.strip()) == 0:
        raise HTTPException(status_code=400, detail="texto vacío")
    vector = generar_embedding(cuerpo.texto)
    return {"vector": vector}


@app.post("/parsear-perfil")
@limiter.limit("30/minute")
def endpoint_parseo(request: Request, cuerpo: TextoRequest):
    if not cuerpo.texto or len(cuerpo.texto.strip()) == 0:
        raise HTTPException(status_code=400, detail="texto vacío")
    resultado = parsear_perfil(cuerpo.texto)
    return resultado
