---
name: Cuervo Pass
description: El expediente del estudiante — cada publicación es una ficha oficial y la afinidad ocupa la casilla de la calificación
source: src/constants/theme.ts
verified: npm run verificar:contraste && npm run verificar:toques
colors:
  tinta: "#12100E"
  papel: "#F5F1EA"
  papel-elemento: "#EAE4D9"
  papel-seleccionado: "#DED6C8"
  tinta-secundaria-claro: "#5C554B"
  borde-campo-claro: "#8A8177"
  filete-claro: "#C9C0B0"
  acento-claro: "#8A5606"
  lavado-sello-claro: "#F1CC88"
  borde-lavado-claro: "#A58133"
  error-claro: "#A81E12"
  error-texto-claro: "#FFFFFF"
  exito-claro: "#146B3E"
  fondo-oscuro: "#12100E"
  elemento-oscuro: "#1C1916"
  seleccionado-oscuro: "#302A1F"
  tinta-secundaria-oscuro: "#A39A8C"
  borde-campo-oscuro: "#726960"
  filete-oscuro: "#322D27"
  acento-oscuro: "#E8A33D"
  lavado-sello-oscuro: "#382A17"
  borde-lavado-oscuro: "#8A6529"
  error-oscuro: "#F08074"
  error-texto-oscuro: "#12100E"
  exito-oscuro: "#4FBF85"
  sello: "#E8A33D"
  sello-texto: "#12100E"
  whatsapp-verde: "#25D366"
typography:
  calificacion:
    fontFamily: "Archivo_900Black"
    fontSize: "56px"
    lineHeight: "56px"
    letterSpacing: "-1.8px"
    fontFeature: "tabular-nums"
  cifra-lista:
    fontFamily: "Archivo_900Black"
    fontSize: "40px"
    lineHeight: "44px"
    letterSpacing: "-1.2px"
    fontFeature: "tabular-nums"
  cifra-compacta:
    fontFamily: "Archivo_900Black"
    fontSize: "18px"
    lineHeight: "24px"
    letterSpacing: "-0.5px"
    fontFeature: "tabular-nums"
  titulo-hoja:
    fontFamily: "Archivo_700Bold"
    fontSize: "32px"
    lineHeight: "36px"
    letterSpacing: "-0.6px"
  title:
    fontFamily: "Archivo_700Bold"
    fontSize: "26px"
    lineHeight: "30px"
    letterSpacing: "-0.4px"
  titulo-medio:
    fontFamily: "Archivo_700Bold"
    fontSize: "24px"
    lineHeight: "30px"
    letterSpacing: "-0.3px"
  titulo-seccion:
    fontFamily: "Archivo_600SemiBold"
    fontSize: "22px"
    lineHeight: "28px"
  subtitle:
    fontFamily: "Archivo_600SemiBold"
    fontSize: "20px"
    lineHeight: "26px"
    letterSpacing: "-0.2px"
  cifra:
    fontFamily: "Archivo_700Bold"
    fontSize: "17px"
    lineHeight: "22px"
    fontFeature: "tabular-nums"
  default:
    fontFamily: "Archivo_400Regular"
    fontSize: "16px"
    lineHeight: "24px"
  sello-texto:
    fontFamily: "Archivo_700Bold"
    fontSize: "15px"
    letterSpacing: "0.4px"
  small:
    fontFamily: "Archivo_400Regular"
    fontSize: "14px"
    lineHeight: "20px"
  smallBold:
    fontFamily: "Archivo_600SemiBold"
    fontSize: "14px"
    lineHeight: "20px"
  link:
    fontFamily: "Archivo_500Medium"
    fontSize: "14px"
    lineHeight: "20px"
  etiqueta:
    fontFamily: "Archivo_600SemiBold"
    fontSize: "11px"
    lineHeight: "14px"
    letterSpacing: "0.9px"
  folio:
    fontFamily: "Archivo_500Medium"
    fontSize: "11px"
    lineHeight: "14px"
    letterSpacing: "0.6px"
    fontFeature: "tabular-nums"
  micro:
    fontFamily: "Archivo_400Regular"
    fontSize: "11px"
    lineHeight: "14px"
rounded:
  casilla: "8px"
  control: "12px"
  hoja: "16px"
  full: "9999px"
spacing:
  half: "2px"
  one: "4px"
  two: "8px"
  three: "16px"
  four: "24px"
  five: "32px"
  six: "64px"
tramas:
  solido: "borderStyle: solid"
  rayado: "borderStyle: dashed"
  punteado: "borderStyle: dotted"
anchos:
  formulario: "480px"
  lista: "800px"
components:
  sello-relleno:
    backgroundColor: "{colors.sello}"
    textColor: "{colors.sello-texto}"
    rounded: "{rounded.control}"
    padding: "0 24px"
    height: "48px"
  sello-contorno:
    backgroundColor: "transparent"
    textColor: "{colors.acento-claro}"
    rounded: "{rounded.control}"
    padding: "0 24px"
    height: "48px"
  campo-entrada:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.tinta}"
    typography: "{typography.default}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
    height: "52px"
  campo-etiqueta:
    textColor: "{colors.tinta-secundaria-claro}"
    typography: "{typography.etiqueta}"
  casilla-calificacion:
    backgroundColor: "{colors.papel-elemento}"
    textColor: "{colors.tinta}"
    typography: "{typography.cifra-lista}"
    rounded: "{rounded.casilla}"
    padding: "4px 8px"
    width: "96px"
  casilla-calificacion-ficha:
    backgroundColor: "{colors.papel-elemento}"
    textColor: "{colors.tinta}"
    typography: "{typography.calificacion}"
    rounded: "{rounded.casilla}"
    padding: "8px 16px"
    width: "128px"
  casilla-calificacion-compacta:
    backgroundColor: "{colors.papel-elemento}"
    textColor: "{colors.tinta}"
    typography: "{typography.cifra-compacta}"
    rounded: "{rounded.casilla}"
    padding: "2px 4px"
    width: "56px"
  fila-publicacion:
    minHeight: "132px"
    photo: "96x96"
    columns: "3 x 86px"
  hoja-ficha:
    backgroundColor: "{colors.papel}"
    rounded: "{rounded.hoja}"
    padding: "16px"
  bloque-lavado:
    backgroundColor: "{colors.lavado-sello-claro}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.hoja}"
    padding: "16px"
  sello-tipo:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.tinta}"
    typography: "{typography.etiqueta}"
    borderWidth: "2px"
    rounded: "0"
  control-orden:
    textColor: "{colors.tinta}"
    typography: "{typography.small}"
    height: "44px"
    marker: "filete 2px bajo la opción activa"
  barra-pestanas:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.tinta-secundaria-claro}"
    typography: "{typography.etiqueta}"
    height: "64px"
---

# Design System: Cuervo Pass

> Este archivo se reescribió el 19/09/2026 **desde el código construido**, no
> desde la intención. Cada cifra de contraste de aquí abajo sale de
> `npm run verificar:contraste`, que corre en CI; ninguna está escrita a mano.
> Cada componente cita su archivo. Lo que el sistema todavía no resuelve tiene
> su propia sección al final, y no está disimulado entre los aciertos.

## Overview

**Creative North Star: "La Ficha" — el kardex y el comprobante de inscripción de la universidad pública mexicana.**

El mundo es un documento oficial: ruleado, con sus campos etiquetados, su folio, su fecha de emisión y un sello que lo valida. Nada de esto es metáfora decorativa; es una decisión de legibilidad. La afinidad que calcula el motor de dos etapas ocupa la casilla donde un kardex pone la calificación, porque un "9.4" en una casilla enmarcada se lee sin que nadie lo explique, y quien usa esta app tiene dieciocho años, está en otro estado y muchas veces tiene a un padre leyendo por encima del hombro.

La categoría entrega siempre una rejilla de fotos con corazón. Eso ordena por deseo. Este producto ordena por ajuste y tiene que poder justificarlo, así que la fotografía va integrada dentro del documento y no coronando una tarjeta. La foto atrae; los campos deciden.

**Los dos modos son dos superficies distintas, no una invertida.** El claro es papel (`#F5F1EA`). El oscuro es tinta (`#12100E`): un negro cálido, no papel iluminado. Aquí se decía que el oscuro era «el mismo papel bajo la lámpara del escritorio a las once de la noche», y esa frase describía algo que el código nunca hizo — bajo una lámpara el papel sigue siendo claro. La imagen era bonita y llevaba a decisiones equivocadas: invita a pensar el modo oscuro como una versión atenuada del claro, cuando lo que hay es una superficie con su propia paleta medida. El oscuro no atenúa: tiene su propio `acento` (8.80 contra 5.46) y su propio `errorTexto`, porque los umbrales cambian cuando el fondo cambia de lado.

**Key Characteristics:**
- El ámbar es tinta de sello: aparece solo en acciones que comprometen o validan. Todo lo demás va en tinta.
- Cero sombras y cero `elevation` en toda la app: la separación es filete, color plano y lavado.
- Tipografía propia (Archivo, Omnibus-Type) con cinco cortes y cifras tabulares en todo lo que forma columna.
- La jerarquía está invertida a propósito: la calificación (56px) es más grande que el título de pantalla (26px).
- Pares etiqueta/valor como unidad de composición; no existe texto suelto ni placeholder haciendo de etiqueta.
- Tres radios (8/12/16) que crecen con la superficie — y **una excepción documentada**: el sello de tipo no lleva radio, porque en Android el radio destruye el `borderStyle` de guiones y puntos.

## Colors

### Cómo se verifican estos números

```bash
npm run verificar:contraste
```

El script mide **cada par declarado** en los dos modos y falla el build si alguno baja de su mínimo: 4.5 para texto (WCAG AA), 3.0 para bordes de control (1.4.11), y 1.2 para **superficie contra superficie**. Ese tercer umbral no es de WCAG y por eso existe: es el que faltaba cuando `tintedSurface` daba **1.00** contra el papel —misma luminancia, cambio de matiz puro— y el bloque «destacado» no destacaba bajo el sol, en escala de grises, ni para alguien con daltonismo.

Valores medidos hoy (los números viven en el script, no aquí; esta tabla es un resumen que puede quedarse atrás y por eso lleva el comando encima):

| Par | Claro | Oscuro | Mínimo |
|---|---|---|---|
| `text` / `background` | 16.86 | 16.86 | 4.5 |
| `textSecondary` / `background` | 6.53 | 6.83 | 4.5 |
| `acento` / `background` | 5.46 | 8.80 | 4.5 |
| `errorTexto` / `error` | 7.34 | 7.27 | 4.5 |
| `border` / `background` | 3.40 | 3.53 | 3.0 |
| `tintedSurface` / `background` | 1.36 | 1.37 | 1.2 |
| `backgroundElement` / `background` | 1.12 | 1.08 | 1.2 · rescatado por `border` |

Esa última fila es honesta a propósito: el par **no llega** a 1.2 por sí solo, y pasa porque el elemento siempre va delineado con `border` (3.40 / 3.53). El script lo dice con esas palabras en vez de aprobarlo callando.

### Primary
- **Tinta de sello / Ámbar** (`#E8A33D`): es un RELLENO, nunca un texto. Su texto encima es tinta (`selloTexto`).
- **Acento por modo** (`#8A5606` claro / `#E8A33D` oscuro): el ámbar cuando tiene que ser TEXTO — enlaces, «¿Por qué esta calificación?», el contorno del sello secundario. Tiene un valor distinto por modo porque el ámbar del relleno reprobaría como texto sobre papel.

### Secondary
- **Verde de WhatsApp** (`#25D366`): existe como token de marca del destino, pero el build NO lo usa como color visible. El glifo de WhatsApp dentro del botón de contacto va en tinta, porque verde sobre ámbar mide 1.09:1. La pista del destino la da la forma del logotipo, no su color.

### Tertiary
- **Rojo de error** (`#A81E12` / `#F08074`) con su propio color de texto: blanco en claro, tinta en oscuro.
- **Verde de confirmación** (`#146B3E` / `#4FBF85`).
- **Lavado del sello** (`tintedSurface` `#F1CC88` / `#382A17`, con `tintedBorder` `#A58133` / `#8A6529`): el bloque que la hoja quiere destacar sin gastar sello.

### Neutral
- **Papel / Tinta** (`#F5F1EA` / `#12100E`): el fondo de la app.
- **Elemento** (`#EAE4D9` / `#1C1916`): el relleno de una casilla enmarcada.
- **Seleccionado** (`#DED6C8` / `#302A1F`): la fila elegida.
- **Tinta secundaria** (`#5C554B` / `#A39A8C`): toda etiqueta, todo metadato, todo valor ausente.
- **Borde de campo** (`#8A8177` / `#726960`): delimita controles. Cumple 3:1.
- **Filete** (`#C9C0B0` / `#322D27`): separa renglones. Es decorativo y no le aplica el 3:1.

### Named Rules
**La Regla del Sello.** El ámbar aparece SOLO sobre lo que compromete o valida —revelar un contacto, crear la cuenta, guardar, consentir, enviar— y en ningún otro lugar. Un segundo ámbar en la misma pantalla es un error, no una variante. Consecuencia observable y deliberada: Inicio no tiene ni un pixel de ámbar, porque ahí no hay ninguna acción que comprometa.

**La Regla del Relleno con su Propio Texto.** Todo relleno de color trae su color de texto declarado junto a él (`selloTexto`, `errorTexto`), nunca «blanco por defecto». Blanco sobre ámbar da 1.98:1 y blanco sobre el rojo del modo oscuro da 2.61:1: los dos reprueban.

**La Regla de las Dos Líneas.** `filete` y `border` son tokens DISTINTOS y nunca se sustituyen. WCAG 1.4.11 exige 3:1 al segundo y no al primero; usar `filete` para delimitar un control lo vuelve inaccesible, y usar `border` para separar renglones convierte el documento en una reja.

**La Regla de la Segunda Señal.** Ningún estado se codifica solo con color. La pestaña activa lleva barra superior, icono relleno y contraste pleno; el Nivel 2 lleva icono, texto y conteo; **el tipo de publicación lleva trama Y palabra** (D.11). Un patrón sin leyenda falla para la misma gente que un color sin etiqueta.

## Typography

**Una sola familia:** Archivo (Omnibus-Type), en `Archivo_400Regular`, `_500Medium`, `_600SemiBold`, `_700Bold`, `_900Black`. La pantalla de arranque se sostiene hasta que Archivo está en memoria, para que no haya un fotograma con la tipografía del sistema.

### Hierarchy
Cinco cuerpos de cifra, porque la misma casilla vive en tres densidades:
- **calificacion** 56/56 (-1.8) — la ficha de detalle. Una por pantalla.
- **cifraLista** 40/44 (-1.2) — la casilla dentro de un renglón de lista.
- **cifraCompacta** 18/24 (-0.5) — la casilla dentro del carrusel.
- **cifra** 17/22 — renta, distancia, recámaras, cada valor del desglose.
- **folio** 11/14 (+0.6) — folio, fecha de emisión, foja.

Y la escala de texto: `tituloHoja` 32/36 · `titulo` 26/30 · `tituloMedio` 24/30 · `tituloSeccion` 22/28 · `subtitulo` 20/26 · `cuerpo` 16/24 · `sello` 15 · `pequeno`/`pequenoFuerte` 14/20 · `enlace`/`enlaceFuerte` 14/20 · `etiqueta` 11/14 (+0.9) · `micro` 11/14.

**Modificadores de peso** (`pesoMedio`, `pesoFuerte`, `pesoNegrita`): cambian el corte sin tocar el tamaño. Existen porque escribir `fontFamily: Tipografia.semibold` suelto en un estilo es lo que el invariante 7 prohíbe; son tokens, no excepciones.

### Named Rules
**La Regla del Dato que Manda.** En un kardex el encabezado es modesto y el dato manda. `calificacion` (56px) es más grande que `title` (26px), al revés de lo que hace cualquier app.

**La Regla del Par.** Un documento oficial no tiene texto suelto: tiene pares de etiqueta y valor. «1.2 km» no significa nada sin «DISTANCIA» arriba.

**La Regla de la Familia Apuntada.** Con tipografía propia, `fontWeight` NO sintetiza el corte: hay que apuntar a la familia. Un `fontWeight: '700'` sobre Archivo Regular deja el texto en regular en Android y en falso negrita en iOS.

**La Regla de la Columna.** Todo lo que se compara entre una ficha y la siguiente lleva `fontVariant: ['tabular-nums']` y ancho fijo. Un documento impreso nunca tambalea sus columnas.

**La Regla del Tope por Tipo.** El texto escala con el sistema hasta un tope que depende de QUÉ es (`themed-text.tsx`): 1.4 para prosa, 1.2 para títulos, **1.0 para cifras y etiquetas de casilla**. Las cifras no escalan porque viven en casillas de ancho fijo con `adjustsFontSizeToFit`: al escalar no caben, se encogen, y la calificación acaba más pequeña que el texto de al lado — la jerarquía se invierte justo para quien subió el tamaño porque le costaba leer. Nada lleva `allowFontScaling={false}`: apagar el escalado es romper la promesa, no cumplirla a medias.

## Layout

Una sola columna, siempre. El ritmo sale de una escala de siete pasos (2/4/8/16/24/32/64).

La adaptación es **por clase de tamaño, nunca por modelo** (`src/hooks/use-tamano-pantalla.ts`): `compacta` bajo 360 de ancho o 700 de alto, `normal` el teléfono típico, `amplia` desde 700 de ancho.

**Dos anchos máximos, y son números distintos a propósito:**
- `anchoContenido` = **480** para FORMULARIOS. Una línea de sesenta caracteres es legible; una de ciento veinte no.
- `anchoLista` = **800** (`MaxContentWidth`) para LISTAS y fichas. Un renglón con foto de 96 y tres columnas de 86 necesita más sitio que un párrafo; acotarlo a la medida del formulario dejaría las columnas apretadas justo donde sobra espacio.

Hay una prueba que fija que son distintos (`use-tamano-pantalla.test.ts`), porque unificarlos es la simplificación tentadora que rompe una de las dos cosas.

Toda área táctil llega a 44pt (WCAG 2.2 SC 2.5.8), **y lo comprueba `npm run verificar:toques`** en CI. Cuando el área real llega a 44 gracias a `hitSlop`, se escribe la exención con su motivo:

```ts
// toque-ok: hitSlop de 12 a cada lado lo lleva a 20 + 24 = 44
```

### Named Rules
**La Regla de la Clase, no del Modelo.** Un plegable abierto, una tableta en pantalla dividida y un horizontal entregan anchos que ningún catálogo predice. Se pregunta cuánto espacio hay AHORA.

**La Regla del Piso, no la Altura.** Las alturas de bloques con texto son `minHeight`, no `height`. Con altura fija, el título recorta en cuanto el sistema escala la letra: la fila sigue midiendo 132 y el contenido no cabe. Con un piso, la tabla mantiene su ritmo en el caso normal y CEDE cuando alguien necesita letra más grande.

## Elevation & Depth

**Cero sombras. Cero `shadowColor`. Cero `elevation`.** `elevation: 0` está puesto explícitamente en la barra de pestañas y `headerShadowVisible: false` en cada encabezado, porque Android pinta `elevation` como una sombra gris que no pertenece a esta hoja e ignora `shadowColor`.

La profundidad se construye con tres materiales planos: **filete** (1px para separar, 2px para el filete principal y la marca de pestaña activa), **color plano** (papel → elemento → seleccionado) y **lavado del sello** cuando un bloque tiene que destacar de verdad.

El grosor es 1px físico, no `hairlineWidth`: en un teléfono de 3x, `hairlineWidth` es ~0.33px y el filete desaparece.

### Named Rules
**La Regla de la Hoja Plana.** Si un bloque necesita despegarse, se le pone filete o lavado, jamás sombra.

## Shapes

`casilla` 8 · `control` 12 · `hoja` 16 · `full` 9999. La escala **crece con la superficie**.

La fotografía es 3:2 y va al ras de la hoja, con filete arriba y abajo, porque una foto engomada llega hasta la regla del formulario.

**Tramas** (`Tramas` en `theme.ts`): `solido`, `rayado`, `punteado` — tres tratamientos de filete con la misma tinta, para codificar sin gastar color.

### Named Rules
**La Regla de la Escala por Superficie.** Una casilla de 24px con radio 16 se ve deforme y una hoja de 360px con radio 8 se ve tacaña.

**La Regla del Rectángulo Tramado.** Lo que lleve trama de guiones o puntos va SIN `borderRadius`. En Android, `borderStyle` se degrada a línea continua en cuanto hay radio: las tres tramas se volverían una sola y nada fallaría. No es una preferencia estética, es la condición para que la trama exista.

## Components

Cada uno con su archivo. Si el archivo y esta descripción se contradicen, gana el archivo — y hay que corregir esta línea.

### Sello (botón) · `src/components/ficha/Sello.tsx`
Una firma, no un botón de app.
- **Forma:** radio `control`, alto mínimo 48, padding horizontal 24, icono opcional a 18px.
- **Relleno:** fondo ámbar, texto e icono en tinta, `Texto.sello` (Bold 15, tracking 0.4).
- **Contorno:** transparente, borde de 2px y texto en `theme.acento`. Cada variante toma su color del fondo que de verdad tiene detrás: la tinta del relleno sobre fondo de app daba 1.00:1 en oscuro y el botón desaparecía.
- **Estados:** presionado 0.75; inactivo o cargando 0.45 con indicador del color del texto.

### Botón de contacto · `src/components/BotonVerContacto.tsx`
El único ámbar de su pantalla. Glifo de WhatsApp en `selloTexto`, no en verde. Al completarse la revelación dispara `sello()` (tacto), **después** de que la fila quedó registrada y la cuota se cobró: vibrar al tocar confirmaría el toque, no el hecho.

### Campo · `src/components/Campo.tsx`, `CampoContrasena.tsx`
Etiqueta persistente en versalita arriba, entrada abajo, error como renglón debajo. Borde de campo 1px, radio `control`, alto mínimo 52. **El borde NO se recolorea en error:** aparece un renglón `small` en el rojo del modo con `accessibilityLiveRegion="polite"`.

### Casilla de calificación · `src/components/ficha/Calificacion.tsx`
La pieza que define el mundo. Tres tamaños reales: `compacta` (56px de ancho, carrusel), `lista` (96px) y `ficha` (128px). Etiqueta en versalita arriba, cifra debajo, ancho mínimo fijo para que forme columna.
- **No lleva lavado ámbar:** una calificación informa, no compromete.
- **Medios puntos, no décimas:** el número es `0.6·score + 0.4·similitud`, una mezcla de heurísticas normalizadas a mano. No tiene un decimal de resolución. Veintiún valores posibles en vez de ciento uno.
- **`animada` solo en la ficha de detalle:** cuenta desde cero en 400 ms con `Easing.out(Easing.cubic)`. Es la única calificación que se acaba de calcular para quien la mira. En una lista serían treinta números bailando y sugerirían treinta cálculos que no ocurren.
- Sin score se muestra un guion largo en tinta secundaria: el campo existe aunque el dato no.

### Renglón de publicación · `src/components/FilaPublicacion.tsx`
**El componente de la lista.** Piso de 132px, foto de 96, y tres columnas de ancho fijo 86 (`AJUSTE · RENTA · DISTANCIA`) con cifras tabulares. La afinidad va como NOTA bajo las cifras, no como cuarta columna: no todas las filas la tienen, y una columna medio vacía se lee como dato perdido en vez de como dato ausente.

Sustituyó a la ficha grande en la lista porque `FichaPublicacion` mide 420–450px —una y media por pantalla— y este producto ordena por ajuste: el ajuste se evalúa comparando, y comparar exige ver varias opciones a la vez. Comprobado en dispositivo: caben cuatro.

### Sello de tipo · `src/components/ficha/SelloTipo.tsx`
Rectángulo estampado en la esquina inferior izquierda de la foto, en el renglón y en la ficha del carrusel. Fondo opaco (va sobre una fotografía cualquiera), borde de 2px con la trama del tipo, y **la palabra**: `DEPA` continuo, `CUARTO` de guiones, `CASA` de puntos. Queda fuera del árbol de accesibilidad porque el tipo ya viaja en la etiqueta de la fila entera, en frase y no en versalitas — un lector de pantalla deletrea «DEPA» como D-E-P-A.

### Ficha de publicación (hoja) · `src/components/FichaPublicacion.tsx`
Se conserva para **Mis publicaciones**, donde la pregunta es «cómo va la mía» y no «cuál de estas». Borde de filete, radio `hoja`, `overflow: hidden`. Tira de folio, fotografía 3:2 al ras, cuerpo con título, dirección y la fila de calificación + renta + distancia. Sin foto no se pinta un rectángulo gris: se pinta un campo que dice «SIN FOTOGRAFÍA».

### Ficha compacta · `src/components/FichaCompacta.tsx`
176px de ancho, para el carrusel. Calificación `compacta` + precio en la primera fila, título a dos renglones, distancia en `folio`.

### Desglose de calificación · `src/components/ficha/DesgloseCalificacion.tsx`
El componente firma del producto: tocar la calificación abre la caja negra y muestra la fórmula real (`0.6 · filtros + 0.4 · afinidad`) con los números que devolvió Postgres. Si no hubo Nivel 2, lo DICE en vez de esconder la mitad de la fórmula.

### Esqueleto · `src/components/ficha/FichaEsqueleto.tsx`
Cuatro formas que espejan las reales: `fila` (132/96/86), `renglon` (avatar 44, chat), `hoja` (con o sin foto 3:2). **Las etiquetas van de verdad** —«AJUSTE», «RENTA», «DISTANCIA» no dependen de la respuesta—, y solo se pinta en gris lo que de verdad falta. El pulso vive en la fila, no en cada bloque: una fila entera respirando se lee como un objeto; doce bloques latiendo por su cuenta, como ruido. Contenido fuera del árbol de accesibilidad, contenedor anunciado una vez como «Cargando».

### Pulsable · `src/components/ficha/Pulsable.tsx`
Sustituye el `opacity: 0.7` de fábrica. Hunde a 0.97 de escala y 0.9 de opacidad, 90 ms de ida y **140 de vuelta** — el dedo se levanta de golpe y la ficha vuelve con algo de peso. `opacity: 0.7` decía que al tocar la ficha se DESVANECE; en un mundo de papel, apretar un documento no lo vuelve transparente.

### Control de orden · `src/app/(tabs)/inicio.tsx`
`ORDENAR POR` + tres opciones (Ajuste · Cercanía · Renta), 44pt de alto, con la activa marcada por **peso de letra y filete debajo** — como un documento marca la columna por la que está ordenado.

**No son pastillas como los chips de tipo, a propósito:** el tipo FILTRA —cambia qué hay— y el orden solo reordena. Dos controles con el mismo peso visual harían creer que hacen lo mismo. (La «pastilla de orden» que este archivo describía antes ya no existe: era un desplegable que se retiró y volvió con otra forma.)

### Carrusel · `src/components/ficha/Carrusel.tsx`
**Uno solo**, y trae lo que la lista no tiene: lo reciente. Había tres, y el primero era `slice(0, 8)` de la lista que empezaba veinticuatro fichas más abajo. Por debajo de tres elementos no se renderiza: un carril con dos es un hueco con título.

### Navegación
- **Barra de pestañas:** alto 64, filete superior de 1px, `elevation: 0`. La activa lleva tres señales: barra de 18×2 encima, icono relleno y tinta plena. La barra ocupa su espacio siempre para que el icono no brinque.
- **Encabezados:** el tema de React Navigation está declarado aparte en `_layout.tsx`, porque lo que React Navigation pinta por su cuenta se queda en el gris de fábrica.

### Movimiento y tacto
Cuatro movimientos, y **todos** respetan «Reducir movimiento» del sistema (`src/hooks/use-movimiento-reducido.ts`):
1. `FadeIn` plano (200–250 ms) para lo que entra.
2. **Escalonado** `FadeInDown.delay(index · 30)` **con tope de 8** en la lista de sugerencias. Sin tope, la fila treinta esperaría 900 ms.
3. El hundido de `Pulsable`.
4. El conteo de la calificación en la ficha.

El tacto (`src/lib/tacto.ts`) son **dos** funciones: `sello()` para lo que quedó registrado y no se deshace, `toque()` para lo que respondió. El tacto se gasta: una app que vibra en cada toque enseña a ignorarla.

### Named Rules
**La Regla del Tercer Estado.** `useMovimientoReducido` devuelve `null` mientras no se sabe. `AccessibilityInfo.isReduceMotionEnabled()` es una promesa: empezando en `false`, el primer render arranca la animación y el segundo la apaga, y quien pidió no ver movimiento ve un destello de movimiento. Nada se anima hasta que la preferencia se conoce.

**La Regla del Tacto que no se Gasta.** Dos vibraciones en toda la app, en cuatro sitios. El tacto NO sigue el ajuste de reducir movimiento: son dos ajustes distintos, y para algunas personas que se marean con el movimiento la vibración es justo el canal que sí toleran. El sistema ya tiene su propio interruptor y `expo-haptics` lo obedece.

## Do's and Don'ts

### Do:
- **Do** reservar el ámbar para la acción que compromete, y darle siempre `selloTexto` encima.
- **Do** escribir toda cifra como par etiqueta/valor, con la versalita en MAYÚSCULAS encima.
- **Do** usar `theme.filete` para separar y `theme.border` para delimitar un control.
- **Do** apuntar a la familia (`Tipografia.bold`) en vez de a `fontWeight`.
- **Do** poner `fontVariant: ['tabular-nums']` y ancho fijo a cualquier cifra que se compare en una lista.
- **Do** elegir el radio por el tamaño de la superficie.
- **Do** acotar a 480 los formularios y a 800 las listas.
- **Do** dar a todo estado una segunda señal además del color.
- **Do** usar `minHeight` y no `height` en cualquier bloque con texto dentro.
- **Do** correr `npm run verificar:contraste` y `npm run verificar:toques` antes de dar por bueno un cambio visual.

### Don't:
- **Don't** usar el ámbar `#E8A33D` como TEXTO: reprueba sobre papel. Para texto existe `theme.acento`.
- **Don't** asumir que el texto sobre un relleno de color es blanco.
- **Don't** añadir `shadowColor`, `elevation` distinto de 0, gradiente ni glow.
- **Don't** poner `borderRadius` a algo que lleve trama de guiones o puntos.
- **Don't** usar un `placeholder` como etiqueta de un campo.
- **Don't** escribir `borderWidth: 1` ni `borderRadius: 8` a mano; usa `Filete.*` y `Radios.*`.
- **Don't** dejar que un título compita en tamaño con el dato que la pantalla existe para mostrar.
- **Don't** pintar un rectángulo gris para un dato ausente: pinta el campo y di que está vacío.
- **Don't** escribir aquí un número de contraste a mano. Cita el script.

## Lo que este sistema NO resuelve todavía

Esta sección existe porque la versión anterior de este archivo describía un sistema más terminado que el construido, y ese ha sido el defecto más caro del repositorio.

**1. Nunca se ha verificado el escalado de fuente al 200 % en un dispositivo.** Los topes por tipo están implementados y probados en jest; el procedimiento está escrito en `docs/prueba-escalado.md` y dice «Estado: sin ejecutar». Hasta que alguien lo corra, el compromiso de accesibilidad de `PRODUCT.md` está **implementado y sin cumplir**, que no es lo mismo.

**2. Ninguna prueba dice si algo se VE bien.** Hay 244 pruebas en verde y ninguna juzga una composición. El contraste se mide, los toques se miden, la estructura se afirma — la proporción, el ritmo y el color percibido, no.

**3. Ningún par de contraste se ha muestreado sobre el render.** Los valores salen de los tokens declarados, no de píxeles capturados de la pantalla. Un color que llegue por encima —una foto detrás, una capa de sistema— no lo ve el script.

**4. Las tres tramas no se han comparado en Android.** `borderStyle` de guiones y puntos es donde Android más se desvía. La regla del rectángulo existe para protegerlas, pero que se DISTINGAN entre sí a 11px solo se sabe con el teléfono en la mano.

**5. El mapa de Google se pinta con su tema claro de fábrica** dentro de una hoja en modo oscuro (`publicacion/[id].tsx`). Es el único rectángulo de la app que no pertenece a este mundo.

**6. Dos títulos fuera del ramp.** `login` (34px) y `registro` (30px) sobreescriben `title` (26) con literales en línea. Es una desviación, no un paso nuevo de la escala: si aparece una tercera, hay que promoverlo a token.

**7. Tokens sin consumidor.** `Texto.codigo` (monoespaciada del sistema, 12px) y los alias `serif`/`rounded`/`mono` de `Fonts` no los usa nadie. `MaxContentWidth` dejó de estar en esta lista el 19/09/2026, cuando `anchoLista` empezó a consumirlo.

**8. El ICONO de la app sigue siendo del sistema visual anterior.** Medido el
19/09/2026: `android-icon-foreground.png` es azul `#0C7BE4` sobre un fondo
`#E6F4FE`, los dos de la paleta que «La Ficha» reemplazó. Lo primero que ve
cualquiera —el icono en el cajón de apps— no pertenece a este mundo, y no se
arregla cambiando un hexadecimal: hace falta volver a dibujarlo.

Lo que sí se corrigió en E.1: el splash pasó de azul `#208AEF` a la tinta
`#12100E`, porque su logotipo es BLANCO —sobre papel habría desaparecido y sobre
tinta da 18.6:1—, y el color de notificación pasó al acento del sistema.

**9. El tacto no se ha sentido.** `expo-haptics` está integrado y probado contra su propio fallo, pero es un módulo nativo: hasta que se reconstruya el cliente de desarrollo, en el teléfono no vibra nada.

## Estado de la implementación

El sistema está aplicado a las **17 pantallas** de `src/app` y a los **29
componentes** de `src/components`. Los dos números se cuentan, no se recuerdan:

```bash
find src/app -name '*.tsx' ! -path '*__tests__*' ! -name '_layout.tsx' | wc -l
find src/components -name '*.tsx' ! -path '*__tests__*' | wc -l
```

**Verificación en dispositivo, al día de hoy:**
- Modo OSCURO revisado en teléfono real (19/09/2026): filetes distinguibles, fichas que no se funden con la página.
- Densidad de la lista comprobada en teléfono (19/09/2026): caben cuatro renglones.
- Modo CLARO: **sin revisar en dispositivo**.
- Escalado al 200 %: **sin ejecutar**.
- Sin capturas guardadas de ninguna de las dos pasadas.

**Procedencia de las fotografías de demostración:** el catálogo de demo reutiliza **27 fotografías** de Unsplash, bajo Licencia de Unsplash, atribuidas una por una en `docs/fotos-de-demo.md`. Se reparten entre las 114 publicaciones, así que una misma imagen aparece en varias. No corresponden a los departamentos reales de esas direcciones y ninguna la tomó el equipo. *(Este archivo decía «87 imágenes»; son 27 — el 87 era el número de candidatas descargadas en una corrida, no el de acreditadas.)*
