"""Documento maestro v5 · §22 — el microservicio de IA.

Ninguna ruta se llama desde el cliente. Todas pasan por la Edge Function
`ai-proxy` (§24), que valida la sesión de Supabase, aplica la cuota diaria y
agrega el token compartido.
"""

import hmac
import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

import config
from models.embeddings import generar_embedding, nombre_modelo, precalentar
from models.parseo_llm import parsear_perfil
from observabilidad import configurar_logs, metricas, registrar_metricas

configurar_logs()
log = logging.getLogger("cuervo.ia")

# AUD-06: arrancado no es lo mismo que disponible.
listo = {"modelo": False}


@asynccontextmanager
async def ciclo_de_vida(app: FastAPI):
    """`@app.on_event("startup")` está obsoleto desde FastAPI 0.109."""
    t0 = time.perf_counter()
    precalentar()
    listo["modelo"] = True
    log.info("modelo listo", extra={"segundos": round(time.perf_counter() - t0, 2)})
    yield
    log.info("apagando")


app = FastAPI(title="Cuervo Pass — servicio de IA", lifespan=ciclo_de_vida)


# ── identidad del llamador ────────────────────────────────────────────────
def _token_valido(authorization: str | None) -> bool:
    """AUD-12: comparación en tiempo constante, no `!=`.

    `authorization != esperado` corta en el primer byte distinto y filtra
    información sobre el secreto. `hmac.compare_digest` no. Es un riesgo
    pequeño y la corrección cuesta una línea: no corregirlo en un proyecto de
    seguridad es lo que no se puede defender.

    Se aceptan dos tokens durante la ventana de rotación (§24): el vigente y el
    siguiente. Una rotación que exige apagar el servicio nunca se hace.
    """
    if not authorization:
        return False
    for token in (config.AI_SHARED_TOKEN, config.AI_SHARED_TOKEN_SIGUIENTE):
        if token and hmac.compare_digest(authorization, f"Bearer {token}"):
            return True
    return False


def identidad(
    authorization: str | None = Header(default=None),
    x_usuario_id: str | None = Header(default=None),
) -> str:
    """Valida el token compartido y devuelve el id de usuario que reenvía el proxy."""
    if config.AI_SHARED_TOKEN and not _token_valido(authorization):
        raise HTTPException(status_code=401, detail="no autorizado")
    return x_usuario_id or "anonimo"


def clave_limite(request: Request) -> str:
    """AUD-03: la cubeta es por usuario, NO por IP.

    Todo el tráfico entra por la Edge Function, así que todas las peticiones
    llegan con la misma IP de salida de Supabase. Limitar por IP convierte los
    sesenta por minuto en un presupuesto GLOBAL que un solo bucle agota para
    todos los demás usuarios.
    """
    return request.headers.get("x-usuario-id") or get_remote_address(request)


limiter = Limiter(key_func=clave_limite)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)


@app.middleware("http")
async def contexto(request: Request, call_next):
    # AUD-19: cada petición lleva identificador propio, que vuelve en la
    # cabecera y aparece en cada línea de log. Sin eso, depurar en vivo consiste
    # en adivinar cuál línea corresponde al toque que acabas de dar.
    request.state.peticion_id = request.headers.get("x-peticion-id") or str(uuid.uuid4())
    t0 = time.perf_counter()
    respuesta = await call_next(request)
    ms = (time.perf_counter() - t0) * 1000
    registrar_metricas(request, respuesta.status_code, ms)
    log.info(
        "peticion",
        extra={
            "peticion_id": request.state.peticion_id,
            "ruta": request.url.path,
            "estado": respuesta.status_code,
            "ms": round(ms, 1),
        },
    )
    respuesta.headers["x-peticion-id"] = request.state.peticion_id
    return respuesta


class TextoRequest(BaseModel):
    # La cota también vive en la Edge Function (AUD-28). Ambas capas, siempre:
    # la del proxy ahorra la petición, la de aquí protege si alguien alcanza el
    # servicio por otro camino.
    texto: str = Field(min_length=1, max_length=2000)


# ── sondas separadas · AUD-06 ─────────────────────────────────────────────
# Con el modelo multilingüe la carga inicial tarda entre veinte y cuarenta
# segundos. Si la sonda de vida pregunta durante ese lapso y recibe fallo, el
# orquestador MATA el contenedor y lo reinicia, indefinidamente. Separar
# "el proceso responde" de "el modelo cargó" es lo que impide ese bucle.
@app.get("/vivo")
def vivo():
    """El proceso responde. Nunca depende del modelo."""
    return {"status": "ok"}


@app.get("/listo")
def listo_para_servir():
    if not listo["modelo"]:
        return JSONResponse({"status": "cargando"}, status_code=503)
    return {
        "status": "ok",
        "api_llm_configurada": bool(config.ANTHROPIC_API_KEY),
        "modelo_embeddings": nombre_modelo(),
        "modelo_cargado": True,
    }


@app.get("/salud")
def salud():
    """Alias legible para la verificación previa a la demo."""
    return listo_para_servir()


@app.get("/metricas")
def endpoint_metricas():
    return metricas()


# El decorador de slowapi inspecciona la firma buscando un parámetro llamado
# exactamente `request` y de tipo starlette.requests.Request. v3 tenía
# `request: TextoRequest`, un modelo de Pydantic sin atributo `client`:
# resultado, cada llamada devolvía 500. El rate limiting que v3 presumía como
# medida de seguridad impedía que el endpoint funcionara.
@app.post("/generar-embedding")
@limiter.limit("60/minute")
def endpoint_embedding(
    request: Request, cuerpo: TextoRequest, usuario: str = Depends(identidad)
):
    # §29 (minimización): el log lleva el LARGO del texto, nunca el texto. Los
    # perfiles son datos personales y no tienen por qué estar en stdout.
    log.info("embedding", extra={"usuario": usuario, "largo": len(cuerpo.texto)})
    return {"vector": generar_embedding(cuerpo.texto), "modelo": nombre_modelo()}


@app.post("/parsear-perfil")
@limiter.limit("10/minute")
def endpoint_parseo(
    request: Request, cuerpo: TextoRequest, usuario: str = Depends(identidad)
):
    log.info("parseo", extra={"usuario": usuario, "largo": len(cuerpo.texto)})
    return parsear_perfil(cuerpo.texto)
