"""La imagen final no lleva `pip`.

Trivy marcó `urllib3 2.7.0` (CVE-2026-97687 y CVE-2026-97689, HIGH, con corrección en
2.8.0) y el job `imagen` del CI se puso en rojo. NO es una dependencia del servicio:
es la copia que `pip` empaqueta dentro de sí mismo
(`pip/_vendor/vendor.txt: urllib3==2.7.0`), igual que las de `msgpack` y `setuptools`
que `.trivyignore` ya silenciaba. Fijar `urllib3>=2.8.0` en requirements.txt no habría
cambiado nada: pip usa la suya.

Subir pip no ayuda —la imagen ya usa la última publicada— y silenciar el hallazgo es
lo que `.trivyignore` venía haciendo. La solución de raíz es que el contenedor en
marcha no tenga pip: nunca se invoca (arranca uvicorn y el healthcheck usa urllib de la
biblioteca estándar), así que es peso y superficie de ataque sin función. Elimina de
una vez los tres hallazgos y los que traiga la próxima versión de pip.

Estas pruebas son estáticas porque el CI no construye la imagen en el job de pytest; lo
que de verdad lo comprueba es Trivy en el job `imagen`.
"""

import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent


def _instrucciones() -> list[str]:
    """Las instrucciones del Dockerfile, sin comentarios y con las continuaciones unidas."""
    texto = (RAIZ / "Dockerfile").read_text(encoding="utf-8")
    texto = re.sub(r"\\\n", " ", texto)
    return [l.strip() for l in texto.splitlines() if l.strip() and not l.strip().startswith("#")]


def _desinstala_pip(linea: str) -> bool:
    return bool(re.search(r"\bpip\s+uninstall\b.*\bpip\b", linea))


def _usa_pip(linea: str) -> bool:
    """Ejecuta pip: `pip install`, `python -m pip`, `pip download`..."""
    return bool(re.search(r"(^|\s|&&|;)(python\d*\s+-m\s+)?pip\s+(install|download|wheel|list|freeze)\b", linea))


def test_el_dockerfile_desinstala_pip_de_la_imagen_final():
    assert any(_desinstala_pip(l) for l in _instrucciones()), (
        "el Dockerfile no desinstala pip: la imagen conserva su urllib3/msgpack/setuptools "
        "empaquetados y Trivy los marca"
    )


def test_nada_ejecuta_pip_despues_de_desinstalarlo():
    """Si alguien añade un `pip install` debajo, el build falla: mejor que lo diga una prueba."""
    lineas = _instrucciones()
    indices = [i for i, l in enumerate(lineas) if _desinstala_pip(l)]
    assert indices, "no hay desinstalación de pip (ver la prueba anterior)"
    despues = [l for l in lineas[indices[0] + 1 :] if _usa_pip(l)]
    assert despues == [], f"se usa pip después de desinstalarlo: {despues}"


def test_las_dependencias_se_instalan_ANTES_de_desinstalar_pip():
    """El otro lado: desinstalarlo antes de tiempo deja la imagen sin dependencias."""
    lineas = _instrucciones()
    instalar = [i for i, l in enumerate(lineas) if re.search(r"pip\s+install\s+.*-r\s+requirements\.txt", l)]
    desinstalar = [i for i, l in enumerate(lineas) if _desinstala_pip(l)]
    assert instalar, "no se encuentra la instalación de requirements.txt"
    assert desinstalar, "no hay desinstalación de pip"
    assert max(instalar) < min(desinstalar)
