# Documento maestro v5 · §23.
FROM python:3.11-slim

# Sin esto, pip jala torch con CUDA: ~3 GB de imagen y diez minutos de build,
# para correr en una CPU que nunca va a usar una GPU.
ENV PIP_EXTRA_INDEX_URL=https://download.pytorch.org/whl/cpu \
    HF_HOME=/opt/hf \
    PYTHONUNBUFFERED=1

WORKDIR /app

# El `wheel` que trae la imagen base (0.45.1) tiene CVE-2026-24049 —escalada de
# privilegios / ejecución de código vía un .whl malicioso—, corregida en
# 0.46.2. No viene de requirements.txt, así que se actualiza aquí junto con el
# resto del utillaje de empaquetado.
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Descarga el modelo EN EL BUILD. Sin esta línea, la primera petición del día de
# la demo dispara una descarga de ~470 MB mientras la maestra mira la pantalla.
ARG MODELO_EMBEDDINGS=paraphrase-multilingual-MiniLM-L12-v2
RUN python -c "from sentence_transformers import SentenceTransformer; \
SentenceTransformer('${MODELO_EMBEDDINGS}')"

COPY . .

RUN useradd --create-home app && chown -R app /app /opt/hf
USER app

EXPOSE 8000

# Contra /vivo, no contra /salud: /salud depende del modelo, y durante los
# treinta segundos que tarda en cargar el healthcheck marcaría el contenedor
# como enfermo y Compose lo reiniciaría en bucle (AUD-06).
HEALTHCHECK --interval=30s --timeout=3s --start-period=60s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/vivo')"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
