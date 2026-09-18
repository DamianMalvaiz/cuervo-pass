"""Documento maestro v5 · §47 y AUD-19 — logs estructurados y métricas.

v3 depuraba con ``print`` a stdout, sin identificador de petición y sin
métricas. Depurar en vivo con eso consiste en adivinar cuál de las líneas del
log corresponde al toque que acabas de dar en la pantalla.

Logs en JSON desde el primer día, no texto libre. La diferencia aparece el día
que quieras responder "¿cuántas peticiones fallaron ayer y con qué latencia?":
con JSON es una consulta, con texto libre es una tarde de expresiones regulares.

En el Carril B (§47) este módulo se cambia por un exportador de Prometheus sin
tocar el resto del código, porque el contrato es la función, no el formato.
"""

import json
import logging
import time
from collections import defaultdict

_inicio = time.time()
_contadores: defaultdict = defaultdict(int)
_latencias: defaultdict = defaultdict(list)


class FormatoJSON(logging.Formatter):
    CAMPOS = ("peticion_id", "ruta", "estado", "ms", "segundos", "usuario", "largo")

    def format(self, r):
        base = {
            "ts": self.formatTime(r),
            "nivel": r.levelname,
            "log": r.name,
            "msg": r.getMessage(),
        }
        for c in self.CAMPOS:
            if hasattr(r, c):
                base[c] = getattr(r, c)
        if r.exc_info:
            base["error"] = self.formatException(r.exc_info)
        return json.dumps(base, ensure_ascii=False)


def configurar_logs() -> None:
    manejador = logging.StreamHandler()
    manejador.setFormatter(FormatoJSON())
    logging.basicConfig(level=logging.INFO, handlers=[manejador], force=True)


def registrar_metricas(request, estado: int, ms: float) -> None:
    ruta = request.url.path
    _contadores[(ruta, estado)] += 1
    serie = _latencias[ruta]
    serie.append(ms)
    if len(serie) > 500:          # ventana móvil: memoria acotada por diseño
        del serie[:-500]


def _percentil(valores, p: float) -> float:
    if not valores:
        return 0.0
    orden = sorted(valores)
    return round(orden[min(len(orden) - 1, int(len(orden) * p))], 1)


def metricas() -> dict:
    return {
        "uptime_s": round(time.time() - _inicio),
        "peticiones": {f"{r} {e}": n for (r, e), n in _contadores.items()},
        "latencia_ms": {
            r: {
                "p50": _percentil(v, 0.50),
                "p95": _percentil(v, 0.95),
                "p99": _percentil(v, 0.99),
                "n": len(v),
            }
            for r, v in _latencias.items()
        },
    }
