from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_salud():
    respuesta = client.get("/salud")
    assert respuesta.status_code == 200
    assert respuesta.json()["status"] == "ok"


def test_embedding_texto_vacio():
    respuesta = client.post("/generar-embedding", json={"texto": ""})
    assert respuesta.status_code == 400


def test_embedding_dimension():
    respuesta = client.post("/generar-embedding", json={"texto": "departamento cerca del campus"})
    assert respuesta.status_code == 200
    assert len(respuesta.json()["vector"]) == 384
