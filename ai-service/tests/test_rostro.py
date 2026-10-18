"""Verificación de rostro (fase 6): selfie contra la foto de la INE.

Lo que se fija aquí NO es la precisión del reconocimiento (eso lo midieron las rondas de experimentos/biometrico, en local), sino
las REGLAS que la rodean:

  · apagada por omisión y cerrada cuando falta el motor (invariante 1: fallar cerrado);
  · sin puntaje de liveness NUNCA pasa: «no se pudo medir» es repetir la foto, no aprobar;
  · el liveness manda aunque la identidad coincida (una foto de pantalla da similitud alta);
  · nunca devuelve el vector facial ni la imagen, solo estado y dos cifras;
  · tope de tamaño en el servidor.

El motor se sustituye por uno de mentira: CI no instala InsightFace ni sus ~290 MB de modelos.
"""

import base64

import numpy as np
import pytest
from fastapi.testclient import TestClient

import config
from main import app
from models import rostro
from models.rostro import Cara
from tests.conftest import CABECERAS

cliente = TestClient(app)


@pytest.fixture(autouse=True)
def limite_limpio():
    """El límite es de 5/minuto por usuario y todas las pruebas comparten usuario: sin esto la sexta recibiría 429."""
    app.state.limiter.reset()


def unitario(*v):
    a = np.array(v, dtype=float)
    return a / np.linalg.norm(a)


YO = unitario(1, 0, 0)
OTRO = unitario(0, 1, 0)
PARECIDO = unitario(1, 1.5, 0)  # coseno con YO ≈ 0.55


class MotorFalso:
    """Devuelve lo que se le diga para cada imagen, identificada por sus bytes."""

    def __init__(self, por_imagen):
        self.por_imagen = por_imagen

    def analizar(self, imagen: bytes):
        return self.por_imagen.get(imagen, [])


def b64(b: bytes) -> str:
    return base64.b64encode(b).decode()


SELFIE, INE = b"selfie", b"ine"


def caso(selfie_caras, ine_caras):
    return MotorFalso({SELFIE: selfie_caras, INE: ine_caras})


# ── la decisión pura ──────────────────────────────────────────────────────────
class TestComparar:
    def test_coincide_con_identidad_y_vida_altas(self):
        r = rostro.comparar(SELFIE, INE, caso([Cara(PARECIDO, 0.97)], [Cara(YO, None)]))
        assert r["estado"] == "coincide"
        assert r["identidad"] == pytest.approx(0.555, abs=0.01)
        assert r["vivo"] == pytest.approx(0.97)

    def test_otra_persona_no_coincide(self):
        r = rostro.comparar(SELFIE, INE, caso([Cara(OTRO, 0.99)], [Cara(YO, None)]))
        assert r["estado"] == "no_coincide"

    def test_el_liveness_manda_aunque_la_identidad_coincida(self):
        """Ronda 4: 10 de 11 fotos de pantalla pasaban la identidad. Solo el liveness las frena."""
        r = rostro.comparar(SELFIE, INE, caso([Cara(YO, 0.20)], [Cara(YO, None)]))
        assert r["estado"] == "no_vivo"

    def test_liveness_justo_bajo_el_umbral_no_pasa(self):
        r = rostro.comparar(SELFIE, INE, caso([Cara(YO, 0.899)], [Cara(YO, None)]))
        assert r["estado"] == "no_vivo"

    def test_liveness_en_el_umbral_pasa(self):
        r = rostro.comparar(SELFIE, INE, caso([Cara(YO, 0.90)], [Cara(YO, None)]))
        assert r["estado"] == "coincide"

    def test_sin_puntaje_de_liveness_se_repite_la_foto_nunca_se_aprueba(self):
        """Ronda 2: 4 de 12 selfies reales no recibieron puntaje (`input_rejected`)."""
        r = rostro.comparar(SELFIE, INE, caso([Cara(YO, None)], [Cara(YO, None)]))
        assert r["estado"] == "repetir_selfie"

    def test_sin_rostro_en_la_selfie(self):
        assert rostro.comparar(SELFIE, INE, caso([], [Cara(YO, None)]))["estado"] == "repetir_selfie"

    def test_varias_caras_en_la_selfie_se_rechaza(self):
        r = rostro.comparar(SELFIE, INE, caso([Cara(YO, 0.99), Cara(OTRO, 0.99)], [Cara(YO, None)]))
        assert r["estado"] == "repetir_selfie"

    def test_sin_rostro_en_la_ine(self):
        assert rostro.comparar(SELFIE, INE, caso([Cara(YO, 0.99)], []))["estado"] == "sin_rostro_ine"

    def test_la_ine_con_varias_caras_usa_la_mayor(self):
        """Una credencial trae la foto grande y, a veces, una pequeña de seguridad."""
        r = rostro.comparar(SELFIE, INE, caso([Cara(YO, 0.99)], [Cara(OTRO, None, area=10), Cara(YO, None, area=100)]))
        assert r["estado"] == "coincide"

    def test_umbral_de_identidad_en_el_limite(self):
        justo_bajo = unitario(1, 3.2, 0)  # coseno ≈ 0.298
        assert rostro.comparar(SELFIE, INE, caso([Cara(justo_bajo, 0.99)], [Cara(YO, None)]))["estado"] == "no_coincide"

    def test_el_resultado_no_lleva_vectores_ni_imagenes(self):
        r = rostro.comparar(SELFIE, INE, caso([Cara(YO, 0.99)], [Cara(YO, None)]))
        assert set(r) == {"estado", "identidad", "vivo", "umbral_identidad", "umbral_vivo", "modelo"}
        assert all(not isinstance(v, (list, bytes, np.ndarray)) for v in r.values())

    def test_las_cifras_se_redondean(self):
        r = rostro.comparar(SELFIE, INE, caso([Cara(PARECIDO, 0.9712345)], [Cara(YO, None)]))
        assert r["vivo"] == 0.971


# ── el endpoint ───────────────────────────────────────────────────────────────
@pytest.fixture
def encendida(monkeypatch):
    monkeypatch.setattr(config, "BIOMETRIA_ACTIVA", True)
    monkeypatch.setattr(rostro, "obtener_motor", lambda: caso([Cara(YO, 0.99)], [Cara(YO, None)]))


CUERPO = {"selfie": b64(SELFIE), "ine": b64(INE)}


class TestEndpoint:
    def test_apagada_por_omision_responde_503(self):
        assert config.BIOMETRIA_ACTIVA is False
        r = cliente.post("/verificar-rostro", json=CUERPO, headers=CABECERAS)
        assert r.status_code == 503 and r.json()["detail"] == "biometria_desactivada"

    def test_sin_token_401_antes_que_nada(self, encendida):
        assert cliente.post("/verificar-rostro", json=CUERPO).status_code == 401

    def test_sin_id_de_usuario_400(self, encendida):
        h = {"Authorization": CABECERAS["Authorization"]}
        assert cliente.post("/verificar-rostro", json=CUERPO, headers=h).status_code == 400

    def test_encendida_devuelve_el_resultado(self, encendida):
        r = cliente.post("/verificar-rostro", json=CUERPO, headers=CABECERAS)
        assert r.status_code == 200 and r.json()["estado"] == "coincide"

    def test_motor_no_instalado_cierra_en_503(self, monkeypatch):
        monkeypatch.setattr(config, "BIOMETRIA_ACTIVA", True)

        def sin_motor():
            raise rostro.MotorNoDisponible("falta insightface")

        monkeypatch.setattr(rostro, "obtener_motor", sin_motor)
        r = cliente.post("/verificar-rostro", json=CUERPO, headers=CABECERAS)
        assert r.status_code == 503 and r.json()["detail"] == "biometria_no_disponible"

    def test_base64_invalido_422(self, encendida):
        r = cliente.post("/verificar-rostro", json={"selfie": "%%%no%%%", "ine": b64(INE)}, headers=CABECERAS)
        assert r.status_code == 422

    def test_imagen_vacia_422(self, encendida):
        assert cliente.post("/verificar-rostro", json={"selfie": "", "ine": b64(INE)}, headers=CABECERAS).status_code == 422

    def test_imagen_gigante_422(self, encendida):
        grande = b64(b"x" * (rostro.MAX_BYTES + 1))
        assert cliente.post("/verificar-rostro", json={"selfie": grande, "ine": b64(INE)}, headers=CABECERAS).status_code == 422

    def test_un_error_del_motor_no_se_filtra(self, monkeypatch):
        monkeypatch.setattr(config, "BIOMETRIA_ACTIVA", True)

        class Roto:
            def analizar(self, _):
                raise RuntimeError("detalle interno /ruta/secreta")

        monkeypatch.setattr(rostro, "obtener_motor", lambda: Roto())
        r = cliente.post("/verificar-rostro", json=CUERPO, headers=CABECERAS)
        assert r.status_code == 500 and "secreta" not in r.text

    def test_los_logs_no_llevan_imagenes(self, encendida, caplog):
        caplog.set_level("INFO")
        cliente.post("/verificar-rostro", json=CUERPO, headers=CABECERAS)
        assert b64(SELFIE) not in caplog.text and b64(INE) not in caplog.text


def test_el_limite_de_cinco_por_minuto_existe(encendida):
    codigos = [cliente.post("/verificar-rostro", json=CUERPO, headers=CABECERAS).status_code for _ in range(6)]
    assert codigos[:5] == [200] * 5 and codigos[5] == 429
