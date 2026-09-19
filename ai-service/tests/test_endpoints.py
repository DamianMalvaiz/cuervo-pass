"""Documento maestro v5 · §22.

Los tests NO llaman a la API de pago: verifican que sin clave el servicio
degrada. Un test que gasta dinero y falla cuando se cae la red no es un test,
es una fuente de falsos negativos.
"""

import pytest
from fastapi.testclient import TestClient

from main import app
from tests.conftest import CABECERAS, TOKEN_PRUEBA, USUARIO_PRUEBA

# El `with` dispara el lifespan, que precalienta el modelo. Sin él, /listo
# devolvería 503 en los tests y `listo["modelo"]` nunca sería True.
cliente = TestClient(app)


def test_vivo_no_depende_del_modelo():
    """AUD-06: la sonda de vida responde aunque el modelo no haya cargado."""
    r = cliente.get("/vivo")
    assert r.status_code == 200 and r.json()["status"] == "ok"


def test_salud():
    with TestClient(app) as c:
        r = c.get("/salud")
        assert r.status_code == 200 and r.json()["status"] == "ok"


def test_embedding_rechaza_vacio():
    # Con `Field(min_length=1)` la validación la hace Pydantic y devuelve 422,
    # no 400. v3 esperaba 400 con una validación manual; da igual cuál elijas,
    # pero el test y el código tienen que coincidir.
    assert cliente.post("/generar-embedding", json={"texto": ""}, headers=CABECERAS).status_code == 422


def test_embedding_rechaza_texto_gigante():
    """AUD-28: el tope de 2000 caracteres también se aplica aquí, no solo en el proxy."""
    assert cliente.post("/generar-embedding", json={"texto": "x" * 2001}, headers=CABECERAS).status_code == 422


def test_embedding_dimension():
    with TestClient(app) as c:
        r = c.post("/generar-embedding", json={"texto": "departamento cerca del campus"}, headers=CABECERAS)
        assert r.status_code == 200 and len(r.json()["vector"]) == 384


def test_embedding_es_semantico_en_espanol():
    """El test que habría atrapado el error de modelo de v3.

    `all-MiniLM-L6-v2` está entrenado en inglés: acepta español y produce
    vectores, pero no distingue significado. Esta aserción falla con ese modelo
    y pasa con el multilingüe, que es justo lo que hay que poder demostrar.
    """
    with TestClient(app) as c:
        def vec(t):
            return c.post("/generar-embedding", json={"texto": t}, headers=CABECERAS).json()["vector"]

        def cos(a, b):
            return sum(x * y for x, y in zip(a, b))   # ya vienen normalizados

        similar = cos(
            vec("busco un lugar tranquilo para estudiar"),
            vec("necesito silencio, soy de hábitos calmados"),
        )
        distinto = cos(
            vec("busco un lugar tranquilo para estudiar"),
            vec("me encantan las fiestas y tener gente en casa"),
        )
        assert similar > distinto + 0.10


def test_parseo_degrada_sin_api_key(monkeypatch):
    import config
    import models.parseo_llm as p

    monkeypatch.setattr(config, "ANTHROPIC_API_KEY", None)
    monkeypatch.setattr(p, "_cliente", None)
    assert p.parsear_perfil("no fumo")["degradado"] is True


def test_token_compartido_rechaza_el_equivocado(monkeypatch):
    """AUD-12: con token configurado, una credencial distinta no pasa."""
    import config

    monkeypatch.setattr(config, "AI_SHARED_TOKEN", "el-bueno")
    monkeypatch.setattr(config, "AI_SHARED_TOKEN_SIGUIENTE", None)
    r = cliente.post(
        "/generar-embedding",
        json={"texto": "hola"},
        headers={"Authorization": "Bearer el-malo"},
    )
    assert r.status_code == 401


def test_token_siguiente_se_acepta_durante_la_rotacion(monkeypatch):
    """§24: el servicio acepta los dos tokens mientras dura la ventana."""
    import config

    monkeypatch.setattr(config, "AI_SHARED_TOKEN", "el-viejo")
    monkeypatch.setattr(config, "AI_SHARED_TOKEN_SIGUIENTE", "el-nuevo")
    with TestClient(app) as c:
        r = c.post(
            "/generar-embedding",
            json={"texto": "hola"},
            headers={"Authorization": "Bearer el-nuevo", "x-usuario-id": USUARIO_PRUEBA},
        )
        assert r.status_code == 200


# ════════════════════════════════════════════════════════════════════════
# ORDEN A.2 — el servicio tiene que fallar CERRADO
# ════════════════════════════════════════════════════════════════════════
#
# El defecto: `identidad()` hacía
#
#     if config.AI_SHARED_TOKEN and not _token_valido(authorization): 401
#
# Con la variable ausente o vacía, la condición entera es falsa y NO se
# autentica a nadie. Y esa es la situación por omisión de la ruta de arranque
# que documenta el README (`uvicorn main:app --reload`), porque config.py leía
# con `os.getenv` pelado y nada cargaba ai-service/.env.
#
# O sea: el servicio que guarda ANTHROPIC_API_KEY, expuesto por un túnel
# público, servía a cualquiera que supiera la URL.


def test_arranque_falla_sin_token(monkeypatch):
    """Sin credencial no se arranca. Un servicio que no puede autenticar no debe servir."""
    import config

    monkeypatch.setattr(config, "AI_SHARED_TOKEN", None)
    monkeypatch.setattr(config, "AI_SHARED_TOKEN_SIGUIENTE", None)
    with pytest.raises(RuntimeError, match="AI_SHARED_TOKEN"):
        with TestClient(app):
            pass


def test_sin_token_configurado_no_se_sirve_a_nadie(monkeypatch):
    """LA prueba del fallo abierto. Antes de A.2 esto devolvía 200."""
    import config

    monkeypatch.setattr(config, "AI_SHARED_TOKEN", None)
    monkeypatch.setattr(config, "AI_SHARED_TOKEN_SIGUIENTE", None)
    r = cliente.post("/generar-embedding", json={"texto": "hola"})
    assert r.status_code == 401


def test_embedding_exige_authorization():
    """Con token configurado, una petición sin cabecera no pasa."""
    r = cliente.post("/generar-embedding", json={"texto": "hola"})
    assert r.status_code == 401


def test_parseo_exige_authorization():
    r = cliente.post("/parsear-perfil", json={"texto": "no fumo"})
    assert r.status_code == 401


def test_metricas_exige_token():
    """`/metricas` publicaba el estado interno a cualquiera con la URL."""
    assert cliente.get("/metricas").status_code == 401
    assert cliente.get("/metricas", headers=CABECERAS).status_code == 200


def test_falta_id_usuario_es_400():
    """AUD-03: sin `x-usuario-id` el limitador por usuario degrada a global.

    Antes se devolvía la cadena "anonimo" y la petición seguía: todas las
    peticiones sin cabecera compartían una sola cubeta, que es exactamente lo
    que el limitador por usuario existe para evitar.
    """
    r = cliente.post(
        "/generar-embedding",
        json={"texto": "hola"},
        headers={"Authorization": f"Bearer {TOKEN_PRUEBA}"},
    )
    assert r.status_code == 400


def test_config_carga_el_env_del_microservicio():
    """`ai-service/.env` tiene que cargarse solo.

    Sin esto, `uvicorn main:app --reload` desde ai-service/ —la línea del
    README— arranca sin ninguna variable: config.py leía con `os.getenv` pelado
    y el único que cargaba el archivo era `env_file` de docker-compose.
    """
    import config

    assert config.ENV_CARGADO, (
        "ai-service/.env no se cargó. Corre: cd ai-service && cp .env.example .env"
    )
