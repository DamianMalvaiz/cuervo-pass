---
name: Cuervo 360
description: El expediente del estudiante — cada publicación es una ficha, la afinidad ocupa la casilla de la calificación y el sello valida lo único que compromete
source: src/constants/theme.ts
verified: npm run verificar:contraste && npm run verificar:toques
colors:
  tinta: "#171A18"
  papel: "#F4F6F2"
  papel-elemento: "#FFFFFF"
  papel-seleccionado: "#DCE3D7"
  tinta-secundaria-claro: "#55605A"
  borde-campo-claro: "#7A857B"
  filete-claro: "#D3DACF"
  acento-claro: "#2F5D3A"
  lavado-claro: "#DDEFB5"
  borde-lavado-claro: "#6B8C1E"
  error-claro: "#B3261E"
  error-texto-claro: "#FFFFFF"
  exito-claro: "#1F6B33"
  lima: "#A5D83E"
  lima-texto: "#171A18"
  bosque-claro: "#477451"
  bosque-texto-claro: "#FFFFFF"
  sello-claro: "#171A18"
  sello-texto-claro: "#A5D83E"
  fondo-oscuro: "#171A18"
  texto-oscuro: "#F4F6F2"
  elemento-oscuro: "#232823"
  seleccionado-oscuro: "#323A32"
  tinta-secundaria-oscuro: "#A3ADA4"
  borde-campo-oscuro: "#6F7A70"
  filete-oscuro: "#2C332C"
  acento-oscuro: "#A5D83E"
  lavado-oscuro: "#2B3A12"
  borde-lavado-oscuro: "#6E8F25"
  error-oscuro: "#F2B8B5"
  error-texto-oscuro: "#171A18"
  exito-oscuro: "#7BCB8A"
  bosque-oscuro: "#6FA97B"
  bosque-texto-oscuro: "#171A18"
  sello-oscuro: "#F4F6F2"
  sello-texto-oscuro: "#171A18"
  whatsapp-verde: "#25D366"
typography:
  calificacion:
    fontFamily: "PlusJakartaSans_800ExtraBold"
    fontSize: "56px"
    lineHeight: "56px"
    letterSpacing: "-1.8px"
    fontFeature: "tabular-nums"
  cifra-lista:
    fontFamily: "PlusJakartaSans_800ExtraBold"
    fontSize: "40px"
    lineHeight: "44px"
    letterSpacing: "-1.2px"
    fontFeature: "tabular-nums"
  cifra-compacta:
    fontFamily: "PlusJakartaSans_800ExtraBold"
    fontSize: "18px"
    lineHeight: "24px"
    letterSpacing: "-0.5px"
    fontFeature: "tabular-nums"
  titulo-hoja:
    fontFamily: "PlusJakartaSans_700Bold"
    fontSize: "32px"
    lineHeight: "36px"
    letterSpacing: "-0.6px"
  title:
    fontFamily: "PlusJakartaSans_700Bold"
    fontSize: "26px"
    lineHeight: "30px"
    letterSpacing: "-0.4px"
  titulo-medio:
    fontFamily: "PlusJakartaSans_700Bold"
    fontSize: "24px"
    lineHeight: "30px"
    letterSpacing: "-0.3px"
  titulo-seccion:
    fontFamily: "PlusJakartaSans_600SemiBold"
    fontSize: "22px"
    lineHeight: "28px"
  subtitle:
    fontFamily: "PlusJakartaSans_600SemiBold"
    fontSize: "20px"
    lineHeight: "26px"
    letterSpacing: "-0.2px"
  cifra:
    fontFamily: "PlusJakartaSans_700Bold"
    fontSize: "17px"
    lineHeight: "22px"
    fontFeature: "tabular-nums"
  default:
    fontFamily: "PlusJakartaSans_400Regular"
    fontSize: "16px"
    lineHeight: "24px"
  sello-texto:
    fontFamily: "PlusJakartaSans_700Bold"
    fontSize: "15px"
    letterSpacing: "0.4px"
  small:
    fontFamily: "PlusJakartaSans_400Regular"
    fontSize: "14px"
    lineHeight: "20px"
  smallBold:
    fontFamily: "PlusJakartaSans_600SemiBold"
    fontSize: "14px"
    lineHeight: "20px"
  link:
    fontFamily: "PlusJakartaSans_500Medium"
    fontSize: "14px"
    lineHeight: "20px"
  etiqueta:
    fontFamily: "PlusJakartaSans_600SemiBold"
    fontSize: "11px"
    lineHeight: "14px"
    letterSpacing: "0.9px"
  folio:
    fontFamily: "PlusJakartaSans_500Medium"
    fontSize: "11px"
    lineHeight: "14px"
    letterSpacing: "0.6px"
    fontFeature: "tabular-nums"
  micro:
    fontFamily: "PlusJakartaSans_400Regular"
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
anchos:
  formulario: "480px"
  lista: "800px"
components:
  boton-primario:
    backgroundColor: "{colors.lima}"
    textColor: "{colors.lima-texto}"
    rounded: "{rounded.control}"
    padding: "0 24px"
    height: "48px"
  boton-primario-contorno:
    backgroundColor: "transparent"
    textColor: "{colors.acento-claro}"
    rounded: "{rounded.control}"
    padding: "0 24px"
    height: "48px"
  sello-contacto:
    backgroundColor: "{colors.sello-claro}"
    textColor: "{colors.sello-texto-claro}"
    rounded: "{rounded.control}"
    padding: "0 24px"
    height: "48px"
  selector-modulo:
    backgroundColor: "transparent"
    textColor: "{colors.tinta}"
    rounded: "{rounded.control}"
    height: "44px"
  boton-favorito:
    textColor: "{colors.bosque-claro}"
    width: "44px"
    height: "44px"
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
    backgroundColor: "{colors.lavado-claro}"
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
    height: "64px + el área segura inferior"
---

# Design System: Cuervo 360

> Este archivo se reescribió el 19/09/2026 **desde el código construido**, no
> desde la intención, y se actualizó el 17/10/2026 para Cuervo 360 (paleta, sello,
> navegación y componentes nuevos). Un guardián (`test-utils/__tests__/design-md-al-dia.test.ts`)
> compara los colores de la cabecera con `theme.ts` en los dos sentidos. Cada cifra de contraste de aquí abajo sale de
> `npm run verificar:contraste`, que corre en CI; ninguna está escrita a mano.
> Cada componente cita su archivo. Lo que el sistema todavía no resuelve tiene
> su propia sección al final, y no está disimulado entre los aciertos.

## Overview

**Creative North Star: "La Ficha" — el kardex y el comprobante de inscripción de la universidad pública mexicana.**

La estructura sigue siendo la de un documento oficial: ruleado, con sus campos etiquetados, su folio, su fecha de emisión y un sello que valida. Nada de esto es metáfora decorativa; es una decisión de legibilidad. La afinidad que calcula el motor de dos etapas ocupa la casilla donde un kardex pone la calificación, porque un "9.4" en una casilla enmarcada se lee sin que nadie lo explique, y quien usa esta app tiene dieciocho años, está en otro estado y muchas veces tiene a un padre leyendo por encima del hombro.

Lo que cambió con Cuervo 360 es el COLOR, no la estructura: el papel se volvió un blanco verdoso, la tinta pasó a un carbón, el ámbar salió del sistema y entraron el verde lima (relleno del botón primario) y el verde bosque (iconos y estados). El sello dejó de ser ámbar: ahora es la única superficie carbón (o blanco hueso en oscuro) con un texto de color encima, para que siga distinguiéndose del botón primario.

La categoría entrega siempre una rejilla de fotos con corazón. Eso ordena por deseo. Este producto ordena por ajuste y tiene que poder justificarlo, así que la fotografía va integrada dentro del documento y no coronando una tarjeta. La foto atrae; los campos deciden. (Sí hay un corazón: guarda una publicación para volver a ella. No ordena nada.)

**Los dos modos son dos superficies distintas, no una invertida.** El claro es papel verdoso (`#F4F6F2`) con tarjetas blancas. El oscuro es carbón (`#171A18`), no papel iluminado. Aquí se decía que el oscuro era «el mismo papel bajo la lámpara del escritorio a las once de la noche», y esa frase describía algo que el código nunca hizo — bajo una lámpara el papel sigue siendo claro. La imagen era bonita y llevaba a decisiones equivocadas: invita a pensar el modo oscuro como una versión atenuada del claro, cuando lo que hay es una superficie con su propia paleta medida. El oscuro no atenúa: tiene su propio `acento` (10.43 contra 7.03), su propio `sello` y su propio `errorTexto`, porque los umbrales cambian cuando el fondo cambia de lado.

**Key Characteristics:**
- El sello es lo único que compromete: carbón con texto lima en claro, blanco hueso con texto carbón en oscuro. El botón primario es lima con texto carbón y nunca se parece al sello.
- Cero sombras y cero `elevation` en toda la app: la separación es filete, color plano y lavado.
- Tipografía Plus Jakarta Sans (desde el 17/10/2026; antes Archivo) con cinco cortes y cifras tabulares en todo lo que forma columna.
- La jerarquía está invertida a propósito: la calificación (56px) es más grande que el título de pantalla (26px).
- Pares etiqueta/valor como unidad de composición; no existe texto suelto ni placeholder haciendo de etiqueta.
- Tres radios (8/12/16) que crecen con la superficie, y la píldora (`full`) para etiquetas pequeñas como el tipo de publicación sobre la foto.
- Cinco accesos fijos (Inicio, Favoritos, Publicar, Chats, Perfil); «Publicar» solo se ve con una función de vendedor aprobada.

## Colors

### Cómo se verifican estos números

```bash
npm run verificar:contraste
```

El script mide **cada par declarado** en los dos modos y falla el build si alguno baja de su mínimo: 4.5 para texto (WCAG AA), 3.0 para bordes de control (1.4.11), y 1.2 para **superficie contra superficie**. Ese tercer umbral no es de WCAG y por eso existe: es el que faltaba cuando `tintedSurface` daba **1.00** contra el papel —misma luminancia, cambio de matiz puro— y el bloque «destacado» no destacaba bajo el sol, en escala de grises, ni para alguien con daltonismo.

Valores medidos al 17/10/2026 (los números viven en el script, no aquí; esta tabla es un resumen que puede quedarse atrás y por eso lleva el comando encima):

| Par | Claro | Oscuro | Mínimo |
|---|---|---|---|
| `text` / `background` | 16.13 | 16.13 | 4.5 |
| `textSecondary` / `background` | 6.02 | 7.58 | 4.5 |
| `acento` / `background` | 7.03 | 10.43 | 4.5 |
| `errorTexto` / `error` | 6.54 | 10.27 | 4.5 |
| `limaTexto` / `lima` | 10.43 | 10.43 | 4.5 |
| `selloTexto` / `sello` | 10.43 | 16.13 | 4.5 |
| `bosqueTexto` / `bosque` | 5.41 | 6.38 | 4.5 |
| `bosque` / `background` | 4.97 | 6.38 | 3.0 |
| `border` / `background` | 3.53 | 3.92 | 3.0 |
| `tintedSurface` / `background` | 1.13 | 1.43 | 1.2 · rescatado por `tintedBorder` |
| `backgroundElement` / `background` | 1.09 | 1.17 | 1.2 · rescatado por `border` |

Dos filas son honestas a propósito: `backgroundElement` y `tintedSurface` **no llegan** a 1.2 por sí solos, y pasan porque el bloque siempre va delineado (`border`, `tintedBorder`). El script lo dice con esas palabras en vez de aprobarlos callando.

### Primary
- **Lima** (`#A5D83E`): es un RELLENO, nunca un texto ni un icono. Sobre blanco mide 1.68:1 y reprueba; por eso su texto encima es siempre carbón (`limaTexto`). Va en el botón primario y en los chips.
- **Acento por modo** (`#2F5D3A` claro / `#A5D83E` oscuro): el color cuando tiene que ser TEXTO — enlaces, «¿Por qué esta calificación?», el contorno del botón secundario. Tiene un valor distinto por modo porque el lima del relleno reprobaría como texto sobre papel.
- **Sello** (`#171A18` claro / `#F4F6F2` oscuro): la superficie de la acción que compromete. Su texto es `selloTexto` (`#A5D83E` / `#171A18`). En oscuro es blanco hueso, no carbón: un botón carbón sobre fondo carbón desaparecería.

### Secondary
- **Bosque** (`#477451` claro / `#6FA97B` oscuro): iconos, la casilla marcada, la insignia de la cámara, el corazón guardado. Es un CONTROL (3:1), no un texto. Su texto encima es `bosqueTexto`.
- **Verde de WhatsApp** (`#25D366`): existe como token de marca del destino, pero el build NO lo usa como color visible. El glifo de WhatsApp dentro del botón de contacto va en `selloTexto`; la pista del destino la da la forma del logotipo, no su color.

### Tertiary
- **Rojo de error** (`#B3261E` / `#F2B8B5`) con su propio color de texto: blanco en claro, carbón en oscuro.
- **Verde de confirmación** (`#1F6B33` / `#7BCB8A`).
- **Lavado** (`tintedSurface` `#DDEFB5` / `#2B3A12`, con `tintedBorder` `#6B8C1E` / `#6E8F25`): el bloque que la hoja quiere destacar sin gastar sello. Es un lima pálido.

### Neutral
- **Papel / Carbón** (`#F4F6F2` / `#171A18`): el fondo de la app.
- **Elemento** (`#FFFFFF` / `#232823`): el relleno de una casilla o tarjeta enmarcada. En claro es blanco puro.
- **Seleccionado** (`#DCE3D7` / `#323A32`): la fila elegida.
- **Tinta secundaria** (`#55605A` / `#A3ADA4`): toda etiqueta, todo metadato, todo valor ausente.
- **Borde de campo** (`#7A857B` / `#6F7A70`): delimita controles. Cumple 3:1 (3.53 / 3.92).
- **Filete** (`#D3DACF` / `#2C332C`): separa renglones. Es decorativo y no le aplica el 3:1.

### Named Rules
**La Regla del Sello.** El sello (`theme.sello`) aparece SOLO sobre lo que compromete algo que no se deshace —revelar un contacto, enviar un mensaje, y más adelante contratar un plan— y en ningún otro lugar. Un segundo sello en la misma pantalla es un error, no una variante. El resto de las acciones principales (guardar, entrar, crear la cuenta, reintentar) son el botón primario lima: Inicio no tiene ningún sello porque ahí no hay nada que comprometa.

**La Regla del Lima.** El lima es RELLENO. Nunca texto, nunca icono, nunca borde de un control: sobre blanco mide 1.68:1. Si hace falta un icono o un estado en verde, es el bosque. Y el lima del botón primario NUNCA se usa en el sello ni al revés: se distinguen a propósito.

**La Regla del Relleno con su Propio Texto.** Todo relleno de color trae su color de texto declarado junto a él (`limaTexto`, `selloTexto`, `bosqueTexto`, `errorTexto`), nunca «blanco por defecto». El texto de cada relleno cambia por modo, y el que no lo declara falla en uno de los dos.

**La Regla de las Dos Líneas.** `filete` y `border` son tokens DISTINTOS y nunca se sustituyen. WCAG 1.4.11 exige 3:1 al segundo y no al primero; usar `filete` para delimitar un control lo vuelve inaccesible, y usar `border` para separar renglones convierte el documento en una reja.

**La Regla de la Segunda Señal.** Ningún estado se codifica solo con color. La pestaña activa lleva barra superior, icono relleno y contraste pleno; el módulo activo del selector cambia relleno, borde y peso; el corazón cambia de glifo y de etiqueta; el Nivel 2 lleva icono, texto y conteo; **el tipo de publicación lleva icono Y palabra**. Un icono sin leyenda falla para la misma gente que un color sin etiqueta.


## Typography

**Una sola familia:** Archivo (Omnibus-Type), en `PlusJakartaSans_400Regular`, `_500Medium`, `_600SemiBold`, `_700Bold`, `_900Black`. La pantalla de arranque se sostiene hasta que Archivo está en memoria, para que no haya un fotograma con la tipografía del sistema.

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

### Named Rules
**La Regla de la Escala por Superficie.** Una casilla de 24px con radio 16 se ve deforme y una hoja de 360px con radio 8 se ve tacaña.

## Components

Cada uno con su archivo. Si el archivo y esta descripción se contradicen, gana el archivo — y hay que corregir esta línea.

### Botón primario · `src/components/ficha/Sello.tsx`
El botón de las acciones principales: guardar, entrar, crear la cuenta, reintentar. El archivo conserva el nombre `Sello` del sistema anterior, donde este botón era el sello ámbar; **hoy no es el sello**.
- **Forma:** radio `control`, alto mínimo 48, padding horizontal 24, icono opcional a 18px.
- **Relleno:** fondo lima, texto e icono en `limaTexto` (carbón), `Texto.sello` (Bold 15, tracking 0.4).
- **Contorno:** transparente, borde de 2px y texto en `theme.acento`. Cada variante toma su color del fondo que de verdad tiene detrás.
- **Estados:** presionado 0.75; inactivo o cargando 0.45 con indicador del color del texto.

### El sello · `src/components/BotonVerContacto.tsx` y el botón de enviar del chat
La única superficie con `theme.sello`: carbón con texto lima en claro, blanco hueso con texto carbón en oscuro. Glifo de WhatsApp en `selloTexto`, no en verde. «Ver contacto» dispara `sello()` (tacto) **después** de que la fila quedó registrada y la cuota se cobró: vibrar al tocar confirmaría el toque, no el hecho. Enviar un mensaje también es sello, porque escribe una fila inmutable.

### Selector de módulo · `src/components/SelectorModulo.tsx`
Inicio reúne los módulos (hoy Depas y Roomies; Servicios se suma en la Semana 2). Cada opción mide 44 de alto; la activa cambia relleno, borde y peso. Cada vista lo pinta arriba de su propio encabezado para compartir margen y desplazamiento. El módulo elegido vive en un store de interfaz pequeño, no en un parámetro de ruta.

### Corazón de favoritos · `src/components/BotonFavorito.tsx`
44×44. Responde al instante (actualización optimista) y, si el servidor falla, vuelve. No alterna a ciegas mientras no sabe qué hay guardado. Guardado: glifo relleno en bosque y etiqueta «Quitar de favoritos»; sin guardar: contorno en tinta secundaria. El brinco al guardar respeta «Reducir movimiento». Junto a él, `ConteoFavoritos` dice «N personas la guardaron» (solo el número, nunca quién) y no pinta nada mientras carga, si falla o si es cero.

### Contactar dentro de la app · `src/components/BotonEscribir.tsx`
El camino principal para contactar a quien publicó: la conversación se queda en la app, se puede moderar y no expone ningún teléfono. «Ver contacto» (WhatsApp, con su cuota) queda debajo como segunda opción. En la publicación propia no se ofrece.

### Funciones y guarda de «Publicar» · `SeccionFunciones.tsx`, `GuardaPublicar.tsx`
«Tus funciones» en Mi perfil lista las funciones agregadas con su estado; una función heredada por migración se rotula como tal («No es una revisión»). `GuardaPublicar` protege la pantalla y el formulario de publicar con cuatro estados distintos (comprobando, falló la lectura, falta la función, puede) y cierra el paso ante la duda. Es una guarda de interfaz: la regla real en la base llega con la verificación de vendedor.

### Ubicación · `src/components/MapaUbicacion.tsx`
Con mapa integrado (iPhone, o Android con clave de Google) pinta el mapa. Sin clave en Android, en vez del rectángulo gris, muestra la dirección y el botón primario «Abrir en Maps».

### Logo · `src/components/LogoMarca.tsx`
Imagen con transparencia (se ve igual sobre papel y sobre carbón), generada desde el logo fuente con `scripts/marca/generar-iconos.py`. Se anuncia como «Cuervo 360» para el lector de pantalla.

### Campo · `src/components/Campo.tsx`, `CampoContrasena.tsx`
Etiqueta persistente en versalita arriba, entrada abajo, error como renglón debajo. Borde de campo 1px, radio `control`, alto mínimo 52. **El borde NO se recolorea en error:** aparece un renglón `small` en el rojo del modo con `accessibilityLiveRegion="polite"`.

### Casilla de calificación · `src/components/ficha/Calificacion.tsx`
La pieza que define el mundo. Tres tamaños reales: `compacta` (56px de ancho, carrusel), `lista` (96px) y `ficha` (128px). Etiqueta en versalita arriba, cifra debajo, ancho mínimo fijo para que forme columna.
- **No lleva lavado ni sello:** una calificación informa, no compromete.
- **Medios puntos, no décimas:** el número es `0.6·score + 0.4·similitud`, una mezcla de heurísticas normalizadas a mano. No tiene un decimal de resolución. Veintiún valores posibles en vez de ciento uno.
- **`animada` solo en la ficha de detalle:** cuenta desde cero en 400 ms con `Easing.out(Easing.cubic)`. Es la única calificación que se acaba de calcular para quien la mira. En una lista serían treinta números bailando y sugerirían treinta cálculos que no ocurren.
- Sin score se muestra un guion largo en tinta secundaria: el campo existe aunque el dato no.

### Renglón de publicación · `src/components/FilaPublicacion.tsx`
**El componente de la lista.** Piso de 132px, foto de 96, y tres columnas de ancho fijo 86 (`AJUSTE · RENTA · DISTANCIA`) con cifras tabulares. La afinidad va como NOTA bajo las cifras, no como cuarta columna: no todas las filas la tienen, y una columna medio vacía se lee como dato perdido en vez de como dato ausente.

Sustituyó a la ficha grande en la lista porque `FichaPublicacion` mide 420–450px —una y media por pantalla— y este producto ordena por ajuste: el ajuste se evalúa comparando, y comparar exige ver varias opciones a la vez. Comprobado en dispositivo: caben cuatro.

### Etiqueta de tipo · `src/components/ficha/SelloTipo.tsx`
Píldora estampada en la esquina inferior izquierda de la foto, en el renglón y en la ficha del carrusel. Radio completo (`full`), fondo opaco (va sobre una fotografía cualquiera), un icono y **la palabra**: `Depa` (edificio), `Cuarto` (cama), `Casa` (personas). Los tres iconos son distintos, y una prueba lo fija. Hasta el 17/10/2026 el tipo se distinguía con tres bordes (continuo, de guiones y de puntos); probado en un iPhone real se veía mal y se retiró. Queda fuera del árbol de accesibilidad porque el tipo ya viaja en la etiqueta de la fila entera, en frase.

### Ficha de publicación (hoja) · `src/components/FichaPublicacion.tsx`
Se conserva para **Mis publicaciones**, donde la pregunta es «cómo va la mía» y no «cuál de estas». Borde de filete, radio `hoja`, `overflow: hidden`. Tira de folio, fotografía 3:2 al ras, cuerpo con título, dirección y la fila de calificación + renta + distancia. Sin foto no se pinta un rectángulo gris: se pinta un campo que dice «SIN FOTOGRAFÍA».

### Ficha compacta · `src/components/FichaCompacta.tsx`
176px de ancho, para el carrusel. Calificación `compacta` + precio en la primera fila, título a dos renglones, distancia en `folio`.

### Por qué es buena para ti · `src/components/ficha/PorQueEsBuena.tsx`
Reemplazó (17/10/2026) al desglose «9.4 = 60 % filtros + 40 % afinidad», que se retiró porque un número y su fórmula son lenguaje de ingeniero. Una lista corta de razones con palomita lima, y **solo las que se cumplen** (`src/lib/razonesDeAjuste.ts`): dentro del presupuesto, dentro de la distancia máxima, acepta mascotas si la persona tiene. Sin ninguna, no se pinta el recuadro vacío. Junto va la insignia «Muy compatible contigo» (score ≥ 0.75) o «Compatible contigo» (≥ 0.5); por debajo de 0.5 se calla. El desglose anterior sigue en el historial de git.

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
- **Barra de pestañas:** cinco accesos fijos —Inicio, Favoritos, Publicar, Chats, Perfil—. «Publicar» se oculta (`href: null`) salvo con una función de vendedor aprobada y falla cerrada: cargando o con la lectura fallida, oculta. Alto 64 **más el área segura inferior** (un alto fijo se comía el icono y la etiqueta bajo la barra del sistema de Android), filete superior de 1px, `elevation: 0`. La activa lleva tres señales: barra de 18×2 encima, icono relleno y tinta plena. La barra ocupa su espacio siempre para que el icono no brinque.
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
- **Do** reservar `theme.sello` para la acción que compromete, y darle siempre `selloTexto` encima. El resto de las acciones principales son el botón primario lima.
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
- **Don't** usar el lima como TEXTO, icono ni borde de un control: reprueba sobre papel (1.68:1). Para texto existe `theme.acento`; para iconos y estados, `theme.bosque`.
- **Don't** pintar el sello como el botón primario ni al revés: dejaría de señalar «esto compromete».
- **Don't** asumir que el texto sobre un relleno de color es blanco.
- **Don't** añadir `shadowColor`, `elevation` distinto de 0, gradiente ni glow.
- **Don't** usar un `placeholder` como etiqueta de un campo.
- **Don't** escribir `borderWidth: 1` ni `borderRadius: 8` a mano; usa `Filete.*` y `Radios.*`.
- **Don't** dejar que un título compita en tamaño con el dato que la pantalla existe para mostrar.
- **Don't** pintar un rectángulo gris para un dato ausente: pinta el campo y di que está vacío.
- **Don't** escribir aquí un número de contraste a mano. Cita el script.

## Lo que este sistema NO resuelve todavía

Esta sección existe porque la versión anterior de este archivo describía un sistema más terminado que el construido, y ese ha sido el defecto más caro del repositorio.

**1. Nunca se ha verificado el escalado de fuente al 200 % en un dispositivo.** Los topes por tipo están implementados y probados en jest; el procedimiento está escrito en `docs/prueba-escalado.md` y dice «Estado: sin ejecutar». Hasta que alguien lo corra, el compromiso de accesibilidad de `PRODUCT.md` está **implementado y sin cumplir**, que no es lo mismo.

**2. Ninguna prueba dice si algo se VE bien.** Hay cientos de pruebas en verde (se cuentan con `npm test`) y ninguna juzga una composición. El contraste se mide, los toques se miden, la estructura se afirma — la proporción, el ritmo y el color percibido, no.

**3. Ningún par de contraste se ha muestreado sobre el render.** Los valores salen de los tokens declarados, no de píxeles capturados de la pantalla. Un color que llegue por encima —una foto detrás, una capa de sistema— no lo ve el script.

**4. El campo vacío ya no es punteado** (17/10/2026). `Campo` pinta el estado vacío con fondo tintado y borde más claro, sin guiones; la propiedad `punteado` solo marca qué campos lo tienen (cuestionario, biografía, roomies).

**5. El mapa de Google se pinta con su tema claro de fábrica** dentro de una hoja en modo oscuro (`MapaUbicacion.tsx`). Es el único rectángulo de la app que no pertenece a este mundo. Y sin clave de Google, en Android no hay mapa: el respaldo es la dirección con «Abrir en Maps», pero **el mapa embebido sigue sin verse en un Android real**.

**6. Dos títulos fuera del ramp.** `login` (34px) y `registro` (30px) sobreescriben `title` (26) con literales en línea. Es una desviación, no un paso nuevo de la escala: si aparece una tercera, hay que promoverlo a token.

**7. Tokens sin consumidor.** `Texto.codigo` (monoespaciada del sistema, 12px) y los alias `serif`/`rounded`/`mono` de `Fonts` no los usa nadie. `MaxContentWidth` dejó de estar en esta lista el 19/09/2026, cuando `anchoLista` empezó a consumirlo.

**8. El ícono, la portada y la paleta de Cuervo 360 no se han visto en un dispositivo.** El ícono, el adaptable, el monocromo y la portada se generaron del logo fuente y Expo los acepta (`expo prebuild` los procesa y deja el nombre y los colores esperados), pero **ninguno se ha visto en un teléfono**: ni cómo recorta el lanzador el adaptable, ni la portada sobre el negro, ni la paleta nueva en los dos modos. El logo fuente es un JPEG (sin transparencia), y el recorte borra el nombre blanco que se mete entre el verde de la «C»; quedan 3 o 4 píxeles imperceptibles.

**10. El lima del logo no es el lima del sistema.** Medido en el logo: `#B2E443`; en los tokens: `#A5D83E`. La diferencia es mínima y se dejó así; si importa, se corrige el token y se vuelve a medir con el verificador.

**11. El sello en modo oscuro es blanco hueso.** Se eligió así porque un botón carbón desaparece sobre el fondo carbón, y se midió (`verificar:contraste`), pero **no se ha visto**: queda por comprobar que sigue leyéndose como «lo que compromete» y no como un botón cualquiera.

**9. El tacto no se ha sentido.** `expo-haptics` está integrado y probado contra su propio fallo, pero es un módulo nativo: hasta que se reconstruya el cliente de desarrollo, en el teléfono no vibra nada.

## Estado de la implementación

El sistema está aplicado a las **29 pantallas** de `src/app` y a los **53 componentes** de `src/components`. Los dos números se cuentan, no se recuerdan:

```bash
find src/app -name '*.tsx' ! -path '*__tests__*' ! -name '_layout.tsx' | wc -l
find src/components -name '*.tsx' ! -path '*__tests__*' | wc -l
```

**Verificación en dispositivo, al día de hoy:**
- Con la paleta de Cuervo 360 (claro y oscuro): **sin revisar en dispositivo**. Lo que se revisó el 19/09/2026 (filetes del modo oscuro, densidad de cuatro renglones) fue con la paleta anterior y **ya no vale**.
- Barra inferior y columnas de la lista: se vieron fallar en un Android real el 17/10/2026 y se corrigieron; **la corrección no se ha visto**.
- Ícono, portada, corazón de favoritos, selector de módulo y «Escribir en la app»: **sin ver en dispositivo**.
- Escalado al 200 %: **sin ejecutar**.
- Sin capturas guardadas de ninguna pasada.

**Procedencia de las fotografías de demostración:** el catálogo de demo reutiliza **27 fotografías** de Unsplash, bajo Licencia de Unsplash, atribuidas una por una en `docs/fotos-de-demo.md`. Se reparten entre las publicaciones de la demo, así que una misma imagen aparece en varias. No corresponden a los departamentos reales de esas direcciones y ninguna la tomó el equipo. *(Este archivo decía «87 imágenes»; son 27 — el 87 era el número de candidatas descargadas en una corrida, no el de acreditadas.)*
