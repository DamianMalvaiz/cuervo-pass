"""Fijaciones comunes de las pruebas del microservicio.

Antes de la ORDEN A.2 no hacía falta ninguna: el servicio dejaba pasar todo
cuando `AI_SHARED_TOKEN` no estaba configurado, así que las pruebas llamaban a
los endpoints sin cabeceras y obtenían 200. Es decir, la suite pasaba *gracias*
al fallo. Ahora el token es obligatorio y las pruebas tienen que presentarlo,
igual que lo hace la Edge Function `ai-proxy`.
"""

import pytest

import config

TOKEN_PRUEBA = "token-de-prueba"
USUARIO_PRUEBA = "00000000-0000-0000-0000-0000000000a1"

# Las dos cabeceras que `ai-proxy` manda en cada petición (§24, AUD-03).
CABECERAS = {
    "Authorization": f"Bearer {TOKEN_PRUEBA}",
    "x-usuario-id": USUARIO_PRUEBA,
}


@pytest.fixture(autouse=True)
def token_configurado(monkeypatch):
    """Todas las pruebas corren con un token válido, salvo que lo cambien.

    Se fija sobre `config` y no sobre el entorno porque `config` lee con
    `os.getenv` en tiempo de import: tocar la variable de entorno después no
    tendría efecto.
    """
    monkeypatch.setattr(config, "AI_SHARED_TOKEN", TOKEN_PRUEBA)
    monkeypatch.setattr(config, "AI_SHARED_TOKEN_SIGUIENTE", None)
