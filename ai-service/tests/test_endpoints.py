"""Documento maestro v5 · §22.

Los tests NO llaman a la API de pago: verifican que sin clave el servicio
degrada. Un test que gasta dinero y falla cuando se cae la red no es un test,
es una fuente de falsos negativos.
"""

from fastapi.testclient import TestClient

from main import app

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
    assert cliente.post("/generar-embedding", json={"texto": ""}).status_code == 422


def test_embedding_rechaza_texto_gigante():
    """AUD-28: el tope de 2000 caracteres también se aplica aquí, no solo en el proxy."""
    assert cliente.post("/generar-embedding", json={"texto": "x" * 2001}).status_code == 422


def test_embedding_dimension():
    with TestClient(app) as c:
        r = c.post("/generar-embedding", json={"texto": "departamento cerca del campus"})
        assert r.status_code == 200 and len(r.json()["vector"]) == 384


def test_embedding_es_semantico_en_espanol():
    """El test que habría atrapado el error de modelo de v3.

    `all-MiniLM-L6-v2` está entrenado en inglés: acepta español y produce
    vectores, pero no distingue significado. Esta aserción falla con ese modelo
    y pasa con el multilingüe, que es justo lo que hay que poder demostrar.
    """
    with TestClient(app) as c:
        def vec(t):
            return c.post("/generar-embedding", json={"texto": t}).json()["vector"]

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
            headers={"Authorization": "Bearer el-nuevo"},
        )
        assert r.status_code == 200
