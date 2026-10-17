"""Genera los íconos de Cuervo 360 a partir de assets/marca/logo-fuente.jpeg.

Uso (Pillow y NumPy; se corrió con la imagen Docker de experimentos, que ya los trae):
  docker run --rm -v "$PWD/assets/marca":/in:ro -v "$PWD/assets/images":/out \
    <imagen con pillow+numpy> python /generar.py      # y montar este archivo como /generar.py

El logo fuente es un JPEG (sin transparencia, fondo negro puro). El nombre «Cuervo» es blanco y su parte
alta se mete entre el fondo de la «C» verde, por eso el script borra lo blanco antes de recortar el glifo.
Entrada esperada: /in/logo-fuente.jpeg. Salidas: /out/*.png (icon, adaptive, monocromo, portada, favicon, logo-app).
"""
import numpy as np
from PIL import Image, ImageFilter
src = Image.open("/in/logo-fuente.jpeg").convert("RGB"); a = np.asarray(src)
# El nombre «Cuervo» es BLANCO y su parte alta se mete entre el fondo de la C verde: los píxeles casi blancos
# no pertenecen al icono. Se pintan de negro en una copia SOLO para medir y recortar el glifo.
a_icono = a.copy(); a_icono[a_icono.min(axis=2) > 170] = 0
# Por debajo de la ficha oscura (su borde inferior ronda y=1142) solo hay dos cosas: el verde de la C y el nombre.
# El borde suavizado de las letras deja grises que el umbral blanco no atrapa; ahí se conserva SOLO lo verde.
_baja = a_icono[1150:1200]
_verde = (_baja[:, :, 1] > 150) & (_baja[:, :, 0] > 100) & (_baja[:, :, 2] < 170)
_baja[~_verde] = 0
# Y fuera del rectángulo de la ficha (x 481-1500, y 164-1142, medido sobre el original) solo debe haber verde (la órbita
# y el pin asoman por los lados): cualquier gris que quede ahí es resto del nombre.
_liso = np.zeros(a_icono.shape[:2], bool); _liso[164:1143, 481:1501] = True
_v = (a_icono[:, :, 1] > 150) & (a_icono[:, :, 0] > 100) & (a_icono[:, :, 2] < 170)
a_icono[(~_liso) & (~_v)] = 0
# Franja justo sobre el borde inferior de la ficha: ahí solo caben la ficha (gris muy oscuro) y el verde. Los grises
# claros y neutros que queden son el borde suavizado del nombre.
_f = a_icono[1090:1150]
_neutro = ((_f.max(axis=2) - _f.min(axis=2)) < 30) & (_f.min(axis=2) > 45)
_f[_neutro] = 0
src_icono = Image.fromarray(a_icono)

# 1) El glifo: el icono (C + cuervo + pin + órbita) sin el nombre. Se mide la caja de lo que NO es negro, por
#    columnas y filas con suficientes píxeles para ignorar el ruido del JPEG.
zona = a_icono[:1200, 380:1700].max(axis=2) > 12
cols = np.nonzero(zona.sum(axis=0) >= 30)[0]; filas = np.nonzero(zona.sum(axis=1) >= 30)[0]
x0, x1 = cols.min() + 380, cols.max() + 380; y0, y1 = filas.min(), filas.max()
print("caja del glifo:", x0, y0, x1, y1, "->", x1 - x0, "x", y1 - y0)
glifo = src_icono.crop((x0 - 6, y0 - 6, x1 + 6, y1 + 6))
print("glifo:", glifo.size)

def encajar(img, ancho, lienzo=1024, modo="RGB", fondo=(0, 0, 0)):
    s = ancho / img.size[0]
    g = img.resize((round(img.size[0] * s), round(img.size[1] * s)), Image.LANCZOS)
    L = Image.new(modo, (lienzo, lienzo), fondo if modo == "RGB" else (0, 0, 0, 0))
    L.paste(g, ((lienzo - g.size[0]) // 2, (lienzo - g.size[1]) // 2))
    return L

# 2) Icono (iOS y tiendas): fondo negro, glifo al 86 %.
encajar(glifo, 880).save("/out/icon.png")
# 3) Adaptive Android: primer plano en la zona segura (el sistema recorta en círculo, ~66 %). Transparente fuera.
fg = encajar(glifo, 660, modo="RGBA")
# El interior del glifo es opaco; lo de alrededor transparente. La caja del glifo se pega entera (negra en sus márgenes),
# que sobre el fondo negro del adaptive icon es indistinguible.
fg_op = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0)); g = glifo.resize((660, round(glifo.size[1] * 660 / glifo.size[0])), Image.LANCZOS).convert("RGBA")
fg_op.paste(g, ((1024 - g.size[0]) // 2, (1024 - g.size[1]) // 2)); fg_op.save("/out/android-icon-foreground.png")

# 4) Monocromo (iconos temáticos de Android 13): la silueta de lo verde (C, órbita, pin, ojo), en blanco, con alfa.
arr = np.asarray(glifo).astype(int)
lima = ((arr[:, :, 1] > 150) & (arr[:, :, 0] > 100) & (arr[:, :, 2] < 170)).astype(np.uint8) * 255
mask = Image.fromarray(lima).filter(ImageFilter.GaussianBlur(1.2))
mono = Image.new("RGBA", glifo.size, (255, 255, 255, 0)); mono.putalpha(mask)
mono = mono.resize((660, round(glifo.size[1] * 660 / glifo.size[0])), Image.LANCZOS)
L = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0)); L.paste(mono, ((1024 - mono.size[0]) // 2, (1024 - mono.size[1]) // 2)); L.save("/out/android-icon-monochrome.png")

# 5) Pantalla de bienvenida: el logo COMPLETO (con nombre), sobre negro puro = el fondo de la portada, sin caja.
src.resize((1024, 1024), Image.LANCZOS).save("/out/splash-icon.png")
# 6) Favicon y logo para dentro de la app.
encajar(glifo, 44, lienzo=48).save("/out/favicon.png")
encajar(glifo, 480, lienzo=512).save("/out/logo-app.png")

# 7) Vista previa: todo sobre gris para ver los bordes y la zona segura circular.
prev = Image.new("RGB", (2400, 620), (120, 120, 120)); x = 20
for n in ["icon.png", "android-icon-foreground.png", "android-icon-monochrome.png", "splash-icon.png"]:
    im = Image.open(f"/out/{n}").convert("RGBA"); im = im.resize((560, 560))
    fondo = Image.new("RGBA", im.size, (0, 0, 0, 255)) if n.startswith("android-icon-f") or n.startswith("android-icon-m") else Image.new("RGBA", im.size, (0, 0, 0, 255))
    fondo.alpha_composite(im); prev.paste(fondo.convert("RGB"), (x, 30)); x += 590
prev.save("/out/_vista_previa.png")
import os
for n in sorted(os.listdir("/out")): print(n, os.path.getsize(f"/out/{n}") // 1024, "KB", Image.open(f"/out/{n}").size)

# 8) Logo para DENTRO de la app, con transparencia: sobre el fondo claro, los márgenes negros se verían como una caja.
#    Alfa = rectángulo redondeado de la ficha (radio medido en el original) + lo verde que asoma fuera de ella.
from PIL import ImageDraw
a0 = np.asarray(src_icono).astype(int)
# radio de la esquina: en la diagonal desde la esquina (481,164), la ficha empieza a un desplazamiento r*(1-1/sqrt2).
d = next(i for i in range(0, 400) if a0[164 + i, 481 + i].max() > 8)
radio = d / (1 - 2 ** -0.5)
print("desplazamiento diagonal", d, "→ radio de esquina ≈", round(radio))
W, H = glifo.size; ox, oy = x0 - 6, y0 - 6                   # el glifo es a_icono[oy:oy+H, ox:ox+W]
SS = 4                                                         # supermuestreo para un borde suave
mk = Image.new("L", (W * SS, H * SS), 0)
ImageDraw.Draw(mk).rounded_rectangle(((481 - ox - 1) * SS, (164 - oy - 1) * SS, (1500 - ox + 1) * SS, (1142 - oy + 1) * SS), radius=radio * SS, fill=255)
mk = mk.resize((W, H), Image.LANCZOS)
verde = (np.asarray(glifo)[:, :, 1] > 120) & (np.asarray(glifo)[:, :, 0] > 80) & (np.asarray(glifo)[:, :, 2] < 180)
alfa = np.maximum(np.asarray(mk), (verde * 255).astype(np.uint8))
alfa = Image.fromarray(alfa).filter(ImageFilter.GaussianBlur(0.8))
g4 = glifo.convert("RGBA"); g4.putalpha(alfa)
s = 480 / W; g4 = g4.resize((480, round(H * s)), Image.LANCZOS)
lienzo = Image.new("RGBA", (512, 512), (0, 0, 0, 0)); lienzo.paste(g4, ((512 - g4.size[0]) // 2, (512 - g4.size[1]) // 2)); lienzo.save("/out/logo-app.png")
# Vista de control sobre papel claro (#F4F6F2) y sobre carbón (#171A18).
ctl = Image.new("RGB", (1100, 540), (244, 246, 242)); osc = Image.new("RGB", (550, 540), (23, 26, 24)); ctl.paste(osc, (550, 0))
ctl.paste(lienzo, (19, 14), lienzo); ctl.paste(lienzo, (569, 14), lienzo); ctl.save("/out/_logo_app_control.png")
