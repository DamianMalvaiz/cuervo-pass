"""Verificación de rostro: una selfie contra la foto de la INE (fase 6).

Es una AYUDA para el admin que revisa la verificación de vendedor, no una decisión: devuelve un estado y dos cifras, y quien
aprueba sigue siendo una persona. Las rondas de medición (experimentos/biometrico/RESULTADOS.md, en local) dan el contexto de
los umbrales y también lo que NO demuestran: muestra pequeña, una sola persona, sin fotos impresas.

Reglas que este módulo hace cumplir:
  · «no se pudo medir» nunca aprueba. Sin puntaje de liveness se pide otra selfie.
  · el liveness manda sobre la identidad: una foto de pantalla da similitud ALTA con la credencial (ronda 4).
  · no devuelve el vector facial ni la imagen; nada de esto se guarda aquí.

InsightFace (MIT) y el liveness se importan SOLO al construir el motor real, para que CI y el resto del servicio no dependan de
ellos. Los modelos `buffalo_*` son solo para investigación no comercial, y el addon de liveness no declara licencia: es una
limitación declarada del proyecto académico (docs/algoritmos.md), no algo a ocultar.
"""

import threading
from dataclasses import dataclass
from typing import Protocol

import numpy as np

MODELO = "buffalo_l"
# Candidatos de las rondas 3 y 4, SIN calibrar con estudiantes reales. Subirlos o bajarlos es una decisión con su medición.
UMBRAL_IDENTIDAD = 0.30
UMBRAL_VIVO = 0.90
# Tope de cada imagen YA decodificada. Se aplica en el servidor aunque el proxy también lo haga.
MAX_BYTES = 4 * 1024 * 1024


class MotorNoDisponible(RuntimeError):
    """Falta InsightFace o sus modelos. El endpoint contesta 503: fallar cerrado."""


@dataclass(frozen=True)
class Cara:
    embedding: np.ndarray
    #: Puntaje de vida en [0, 1]; None si el motor rechazó la foto («área insuficiente alrededor de la cara»).
    live_score: float | None
    area: float = 1.0


class Motor(Protocol):
    def analizar(self, imagen: bytes) -> list[Cara]: ...


def _cos(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a / np.linalg.norm(a), b / np.linalg.norm(b)))


def comparar(selfie: bytes, ine: bytes, motor: Motor) -> dict:
    """Estados: coincide · no_coincide · no_vivo · repetir_selfie · sin_rostro_ine."""
    caras_selfie = motor.analizar(selfie)
    caras_ine = motor.analizar(ine)

    def resultado(estado, identidad=None, vivo=None):
        return {
            "estado": estado,
            "identidad": None if identidad is None else round(identidad, 3),
            "vivo": None if vivo is None else round(vivo, 3),
            "umbral_identidad": UMBRAL_IDENTIDAD,
            "umbral_vivo": UMBRAL_VIVO,
            "modelo": MODELO,
        }

    # Una sola cara en la selfie: con varias no se sabe de quién es el puntaje.
    if len(caras_selfie) != 1:
        return resultado("repetir_selfie")
    selfie_cara = caras_selfie[0]
    if not caras_ine:
        return resultado("sin_rostro_ine")
    ine_cara = max(caras_ine, key=lambda c: c.area)

    if selfie_cara.live_score is None:
        return resultado("repetir_selfie")
    identidad = _cos(selfie_cara.embedding, ine_cara.embedding)
    if selfie_cara.live_score < UMBRAL_VIVO:
        return resultado("no_vivo", identidad, selfie_cara.live_score)
    if identidad < UMBRAL_IDENTIDAD:
        return resultado("no_coincide", identidad, selfie_cara.live_score)
    return resultado("coincide", identidad, selfie_cara.live_score)


class _MotorInsightFace:
    def __init__(self):
        try:
            import cv2
            from insightface.app import FaceAnalysis
        except ImportError as e:  # pragma: no cover - depende de requirements-biometria.txt
            raise MotorNoDisponible(f"falta una dependencia de biometría: {e.name}") from e
        self._cv2 = cv2
        try:  # pragma: no cover - necesita los modelos descargados
            self._app = FaceAnalysis(
                name=MODELO,
                addons=["liveness"],
                allowed_modules=["detection", "recognition"],
                liveness_mode="observe",
                providers=["CPUExecutionProvider"],
            )
            self._app.prepare(ctx_id=-1, det_size=(640, 640))
        except Exception as e:  # pragma: no cover
            raise MotorNoDisponible("no se pudieron cargar los modelos de biometría") from e
        # onnxruntime comparte sesión entre hilos de la misma instancia: se serializa para no depender de eso.
        self._cerrojo = threading.Lock()

    def analizar(self, imagen: bytes) -> list[Cara]:  # pragma: no cover - se prueba en local con fotos reales
        im = self._cv2.imdecode(np.frombuffer(imagen, np.uint8), self._cv2.IMREAD_COLOR)
        if im is None:
            return []
        with self._cerrojo:
            caras = self._app.get(im)
        salida = []
        for c in caras:
            vida = (getattr(c, "liveness", None) or {}).get("live_score")
            x1, y1, x2, y2 = c.bbox
            salida.append(Cara(np.asarray(c.embedding, dtype=float), None if vida is None else float(vida), float((x2 - x1) * (y2 - y1))))
        return salida


_motor: Motor | None = None
_cerrojo_motor = threading.Lock()


def obtener_motor() -> Motor:
    """Construye el motor la primera vez (carga ~12 s) y lo reutiliza."""
    global _motor
    with _cerrojo_motor:
        if _motor is None:
            _motor = _MotorInsightFace()
        return _motor
