---
version: 1
slug: "src-app-tabs-inicio-tsx"
primary_target: "src/app/(tabs)/inicio.tsx"
related_targets: ["src/app/publicacion/[id].tsx","src/constants/theme.ts","src/components/TarjetaPublicacion.tsx"]
---

## Scope and visitor mode

Operate. Pasada 1: tokens y componentes base, barra de pestañas, Inicio/sugerencias,
ficha de publicación, login y registro. Pasada 2: perfil y preferencias.

## Audience and job

Estudiante de 18–19 años, en otro estado, en un teléfono con datos móviles, eligiendo
dónde vivirá tres años sin poder ir a verlo — muchas veces con un padre al lado. La
acción es pedir el contacto. La prueba es el motor de dos etapas con el nivel visible.

## Direction contract

THESIS: Cada publicación es una ficha oficial y la afinidad ocupa la casilla donde un
kardex mexicano pone la calificación — "9.4" se lee sin explicación. Rechaza la rejilla
de fotos con corazón que esta categoría siempre entrega: eso ordena por deseo, y este
producto ordena por ajuste y debe poder justificarlo.

OWN-WORLD: Tinta #12100E, superficie #1C1916, hueso #F5F1EA, y ámbar #E8A33D como tinta
de SELLO — solo sobre lo que valida o compromete, nunca decorativo. Familia Archivo:
grotesca de impresos con cifras tabulares, expandida para las calificaciones. Filetes
de imprenta, no bordes de 1px genéricos. Pares etiqueta/valor ruleados. Claro y oscuro
ambos canónicos: el claro es el papel, el oscuro el mismo papel bajo la lámpara.

STORY: Entiende por qué esta publicación va encima de aquella, confía en el orden, y
pide el contacto.

FIRST VIEWPORT: Folio y fecha de emisión en un filete superior. Debajo, la ficha mejor
evaluada: calificación a cuerpo enorme a la izquierda contra etiquetas diminutas, renta
y distancia a la derecha. Campos ruleados en pares. Fotografía integrada al documento,
no coronándolo. Sello ámbar "Ver contacto" al pie. La siguiente ficha asoma por el borde
inferior. Barra de pestañas como pie de imprenta.

FORM: La Ficha — kardex universitario. Candidato 5 de la lista ordenada por resonancia;
asignado por el reparto. Seed key 40dd1a0c.

RAISES: del Jardín de Lluvia (declinado), un solo campo domina la pantalla y la posición
lleva la jerarquía. Del Estante de Piel (declinado), la ficha se comporta como impreso
real con folio y fecha, no como componente tarjeta.

SIGNATURE INTERACTION: tocar la calificación despliega en el sitio el desglose que la
produce — presupuesto, distancia, mascotas, ruido, afinidad. La caja negra se abre.

MOTION GRAMMAR: un solo FadeIn plano, sin resorte ni escalonado (regla vigente del
proyecto). El despliegue del desglose es altura, no rebote. Sin shadowColor: Android lo
ignora y este proyecto ya lo revirtió una vez.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Fotos de demo: interiores de licencia libre del CDN de Unsplash, subidos al bucket.
  Debe quedar escrito cómo explicarlas en la exposición.
- Cargar Archivo con expo-font sin recompilar el APK: verificar antes de comprometerlo.
