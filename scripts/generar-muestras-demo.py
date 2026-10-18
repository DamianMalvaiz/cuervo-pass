"""Imágenes de MUESTRA para la demo de verificación de vendedor. No son documentos reales ni de nadie.

Cada imagen dice «MUESTRA» en grande y lleva un nombre inventado. Sirven para enseñar el flujo (subir la INE, revisar, aprobar) sin
poner un documento verdadero delante del evaluador. Salen en demo-material/ (fuera de git).

    python3 scripts/generar-muestras-demo.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

SALIDA = Path(__file__).resolve().parent.parent / "demo-material"
SALIDA.mkdir(exist_ok=True)


def fuente(tam):
    for ruta in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf"):
        if Path(ruta).exists():
            return ImageFont.truetype(ruta, tam)
    return ImageFont.load_default()


def tarjeta(nombre, lineas, fondo, tinta):
    img = Image.new("RGB", (1600, 1000), fondo)
    d = ImageDraw.Draw(img)
    d.rectangle([30, 30, 1570, 970], outline=tinta, width=6)
    d.text((70, 60), "MUESTRA · NO ES UN DOCUMENTO", font=fuente(70), fill=(180, 30, 30))
    y = 220
    for linea in lineas:
        d.text((70, y), linea, font=fuente(52), fill=tinta)
        y += 90
    d.rectangle([1100, 240, 1500, 700], outline=tinta, width=5)
    d.text((1150, 440), "FOTO", font=fuente(60), fill=tinta)
    img.save(SALIDA / nombre, "JPEG", quality=88)


tarjeta("muestra-ine-frente.jpg", ["Nombre: PERSONA DE MUESTRA", "Domicilio: CALLE EJEMPLO 1", "LERMA, MEX.", "Vigencia: 2099"], (236, 244, 238), (30, 60, 40))
tarjeta("muestra-ine-reverso.jpg", ["Documento de muestra", "para demostración", "de Cuervo 360", "Sin validez alguna"], (236, 244, 238), (30, 60, 40))
tarjeta("muestra-local-1.jpg", ["Fachada de muestra", "TAQUERÍA DEMO 360"], (250, 240, 220), (90, 50, 20))
tarjeta("muestra-local-2.jpg", ["Interior de muestra", "TAQUERÍA DEMO 360"], (250, 240, 220), (90, 50, 20))
print(f"Muestras en {SALIDA}")
