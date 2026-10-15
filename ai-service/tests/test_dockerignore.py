"""El contexto de build de la imagen.

`COPY . .` mete en la imagen TODO lo que `.dockerignore` no excluya. El archivo
decía `venv/`, que solo excluye una carpeta llamada exactamente así; la real se
llama `.venv`. Resultado medido el 15/10/2026: el contexto que se enviaba a Docker
pesaba **6.184 GB** —el entorno virtual de Python 3.14 de la laptop, dentro de una
imagen de Python 3.11—, la imagen salía de 22.9 GB y el build tardaba más de diez
minutos. El `.env` sí se excluía bien, así que no era una fuga: era peso muerto, y
un entorno virtual ajeno dentro de la imagen de producción.

Una prueba que solo buscara la línea `.venv/` no habría atrapado la siguiente
carpeta con otro nombre. Esta mide lo que de verdad entra en el contexto.

Se simula la regla de Docker sobre las entradas de PRIMER NIVEL, que es donde
vive el problema: un patrón sin `/` intermedio se compara con el nombre.
Verificado contra Docker 29.1.3: el contexto real pasó de 6.184 GB al valor que
anota el commit que arregló esto.
"""

import os
from fnmatch import fnmatch
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent

# El código del servicio pesa decenas de KB. El modelo de embeddings NO viaja en el
# contexto: se descarga durante el build (ver el Dockerfile). Cinco megas es una
# holgura enorme; un entorno virtual son gigas.
LIMITE_BYTES = 5 * 1024 * 1024


def _patrones() -> list[str]:
    lineas = (RAIZ / ".dockerignore").read_text(encoding="utf-8").splitlines()
    return [l.strip() for l in lineas if l.strip() and not l.strip().startswith("#")]


def _ignorado(nombre: str, patrones: list[str]) -> bool:
    """La última regla que coincide manda, como en Docker; `!` re-incluye."""
    estado = False
    for patron in patrones:
        niega = patron.startswith("!")
        limpio = patron.lstrip("!").rstrip("/")
        if fnmatch(nombre, limpio):
            estado = not niega
    return estado


def _peso(ruta: Path) -> int:
    if ruta.is_file():
        return ruta.stat().st_size
    total = 0
    for base, _dirs, archivos in os.walk(ruta):
        for a in archivos:
            try:
                total += os.path.getsize(os.path.join(base, a))
            except OSError:
                pass  # un enlace roto no pesa
    return total


def test_el_contexto_de_build_pesa_poco():
    patrones = _patrones()
    entradas = {
        e.name: _peso(e) for e in RAIZ.iterdir() if not _ignorado(e.name, patrones)
    }
    total = sum(entradas.values())
    mas_pesadas = sorted(entradas.items(), key=lambda kv: -kv[1])[:3]
    assert total < LIMITE_BYTES, (
        f"el contexto de build pesa {total / 1e6:.1f} MB (límite {LIMITE_BYTES / 1e6:.0f} MB). "
        f"Lo más pesado que NO está excluido en .dockerignore: {mas_pesadas}"
    )


def test_lo_que_nunca_debe_viajar_esta_excluido():
    patrones = _patrones()
    # Se comprueba por NOMBRE y no por lo que haya en disco: en una copia limpia
    # (CI) no existe ni `.venv` ni `.env`, y aun así tienen que estar excluidos.
    for nombre in [
        ".env",  # la clave de Anthropic y el token compartido
        ".env.local",
        ".venv",  # el entorno virtual de la laptop
        "venv",
        "env",
        "__pycache__",
        ".pytest_cache",
        "tests",
        "requirements-dev.txt",
    ]:
        assert _ignorado(nombre, patrones), f"{nombre} viaja dentro de la imagen"


def test_lo_que_el_servicio_necesita_para_arrancar_no_esta_excluido():
    """El otro lado: excluir de más rompe la imagen en silencio hasta que arranca."""
    patrones = _patrones()
    necesarios = [p.name for p in RAIZ.glob("*.py")] + ["models", "prompts", "requirements.txt"]
    assert "main.py" in necesarios  # si esto falla, la búsqueda está rota
    for nombre in necesarios:
        assert not _ignorado(nombre, patrones), f"{nombre} no llega a la imagen y el servicio no arranca"
