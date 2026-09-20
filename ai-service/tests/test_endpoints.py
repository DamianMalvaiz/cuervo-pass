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


# ═══════════════════════════════════════════════════════════════════════════
# E.6 · Qué versión está corriendo
# ═══════════════════════════════════════════════════════════════════════════
# Durante la auditoría un uvicorn llevaba TRECE HORAS sirviendo código anterior
# a una corrección ya aplicada. Nada lo delataba: respondía, el modelo estaba
# cargado y /listo decía «ok». Se midió ese servidor viejo y se reportó que el
# fallo seguía sin arreglar — o sea que el proceso de verificación produjo una
# conclusión falsa sobre el estado del sistema.


def test_listo_reporta_el_commit():
    """Sin este campo, `verificar.mjs` y `tunel.sh` no pueden distinguir un
    microservicio al día de uno de hace trece horas."""
    with TestClient(app) as c:
        cuerpo = c.get("/listo").json()
    assert "commit" in cuerpo
    assert cuerpo["commit"]


def test_el_commit_se_congela_al_arrancar():
    """Se lee UNA vez, en el import de config, y no en cada petición.

    Leerlo por petición reportaría la versión del REPOSITORIO —lo que hay en
    disco ahora— y no la del PROCESO. Justo la confusión que esto viene a
    deshacer: importa con qué código arrancó, no lo que alguien acaba de
    escribir en el árbol.
    """
    import config

    with TestClient(app) as c:
        primero = c.get("/listo").json()["commit"]
        segundo = c.get("/listo").json()["commit"]

    assert primero == segundo == config.COMMIT


def test_sin_git_el_commit_dice_desconocido(monkeypatch):
    """«No sé» tiene que poder distinguirse de «todavía no lo he mirado».

    En un contenedor sin git no hay commit que leer. Devolver cadena vacía
    haría que el verificador no supiera si el campo falta o si el proceso no
    pudo averiguarlo, y son dos arreglos distintos: uno es reiniciar, el otro
    es pasar CUERVO_COMMIT al construir la imagen.
    """
    import subprocess

    import config

    def revienta(*_a, **_k):
        raise FileNotFoundError("git")

    monkeypatch.setattr(subprocess, "run", revienta)
    assert config._commit_del_arbol() == "desconocido"


def test_la_variable_de_entorno_gana_sobre_el_arbol(monkeypatch):
    """En una imagen de Docker el código no viene con su historial de git.

    `CUERVO_COMMIT` se inyecta al construir, y tiene que MANDAR: si el árbol
    ganara, un contenedor desplegado reportaría el commit de la máquina que lo
    construyó, o «desconocido», y en los dos casos mentiría sobre sí mismo.
    """
    import importlib

    import config

    monkeypatch.setenv("CUERVO_COMMIT", "deadbee")
    recargado = importlib.reload(config)
    try:
        assert recargado.COMMIT == "deadbee"
    finally:
        monkeypatch.delenv("CUERVO_COMMIT", raising=False)
        importlib.reload(config)
