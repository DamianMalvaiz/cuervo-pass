---
name: Cuervo Pass
description: El expediente del estudiante — cada publicación es una ficha oficial y la afinidad ocupa la casilla de la calificación
colors:
  tinta: "#12100E"
  papel: "#F5F1EA"
  papel-elemento: "#EAE4D9"
  papel-seleccionado: "#DED6C8"
  tinta-secundaria-claro: "#5C554B"
  borde-campo-claro: "#8A8177"
  filete-claro: "#C9C0B0"
  acento-claro: "#8A5606"
  lavado-sello-claro: "#FBF0DC"
  borde-lavado-claro: "#E3CFA4"
  error-claro: "#A81E12"
  error-texto-claro: "#FFFFFF"
  exito-claro: "#146B3E"
  lampara-fondo: "#12100E"
  lampara-elemento: "#1C1916"
  lampara-seleccionado: "#262119"
  tinta-secundaria-oscuro: "#A39A8C"
  borde-campo-oscuro: "#726960"
  filete-oscuro: "#322D27"
  acento-oscuro: "#E8A33D"
  lavado-sello-oscuro: "#241B0F"
  borde-lavado-oscuro: "#4A3616"
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
    fontWeight: 900
    lineHeight: "56px"
    letterSpacing: "-1.8px"
    fontFeature: "tabular-nums"
  title:
    fontFamily: "Archivo_700Bold"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: "30px"
    letterSpacing: "-0.4px"
  subtitle:
    fontFamily: "Archivo_600SemiBold"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "26px"
    letterSpacing: "-0.2px"
  cifra:
    fontFamily: "Archivo_700Bold"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: "22px"
    fontFeature: "tabular-nums"
  default:
    fontFamily: "Archivo_400Regular"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
  small:
    fontFamily: "Archivo_400Regular"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
  smallBold:
    fontFamily: "Archivo_600SemiBold"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: "20px"
  link:
    fontFamily: "Archivo_500Medium"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: "20px"
  etiqueta:
    fontFamily: "Archivo_600SemiBold"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: "14px"
    letterSpacing: "0.9px"
  folio:
    fontFamily: "Archivo_500Medium"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: "14px"
    letterSpacing: "0.6px"
    fontFeature: "tabular-nums"
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
    typography: "{typography.cifra}"
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
  hoja-ficha:
    backgroundColor: "{colors.papel}"
    rounded: "{rounded.hoja}"
    padding: "16px"
  bloque-lavado:
    backgroundColor: "{colors.lavado-sello-claro}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.hoja}"
    padding: "16px"
  pastilla-orden:
    backgroundColor: "{colors.papel-elemento}"
    textColor: "{colors.tinta}"
    typography: "{typography.smallBold}"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: "38px"
  barra-pestanas:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.tinta-secundaria-claro}"
    typography: "{typography.etiqueta}"
    height: "64px"
---

# Design System: Cuervo Pass

## Overview

**Creative North Star: "La Ficha" — el kardex y el comprobante de inscripción de la universidad pública mexicana.**

El mundo es un documento oficial: ruleado, con sus campos etiquetados, su folio, su fecha de emisión y un sello que lo valida. Nada de esto es metáfora decorativa; es una decisión de legibilidad. La afinidad que calcula el motor de dos etapas ocupa la casilla donde un kardex pone la calificación, porque un "9.4" en una casilla enmarcada se lee sin que nadie lo explique, y quien usa esta app tiene dieciocho años, está en otro estado y muchas veces tiene a un padre leyendo por encima del hombro.

La categoría entrega siempre una rejilla de fotos con corazón. Eso ordena por deseo. Este producto ordena por ajuste y tiene que poder justificarlo, así que la fotografía va integrada dentro del documento —pegada entre el folio y los campos, a 3:2, con filete arriba y abajo— y no coronando una tarjeta. La foto atrae; los campos deciden.

Claro y oscuro son AMBOS canónicos, no uno el invertido del otro: el claro es el papel (`#F5F1EA`) y el oscuro es el mismo papel bajo la lámpara del escritorio a las once de la noche (`#12100E`), que es la hora a la que de verdad se usa esto. Todos los contrastes del sistema están medidos y esos números viven en `src/constants/theme.ts`: tinta/papel 16.9:1, secundario/papel 6.5:1, acento/papel 5.5:1, tinta/sello 8.8:1, borde de campo 3.4:1 claro y 3.5:1 oscuro.

**Key Characteristics:**
- El ámbar es tinta de sello: aparece en ocho sitios del código, todos ellos acciones que comprometen o validan. Todo lo demás va en tinta.
- Cero sombras y cero `elevation` en toda la app: la separación es filete, color plano y lavado.
- Tipografía propia (Archivo, Omnibus-Type) con cinco cortes cargados y cifras tabulares en todo lo que forma columna.
- La jerarquía está invertida a propósito: la calificación (56px) es más grande que el título de pantalla (26px).
- Pares etiqueta/valor como unidad de composición; no existe texto suelto ni placeholder haciendo de etiqueta.
- Tres radios (8/12/16) que crecen con la superficie.

## Colors

La paleta es la de un impreso: dos papeles canónicos, una tinta, un secundario, y una sola tinta de color reservada al sello.

### Primary
- **Tinta de sello / Ámbar** (`#E8A33D`): es un RELLENO, nunca un texto. Va en el botón "Ver contacto", en el botón de envío de los formularios, en la casilla de consentimiento marcada, en la insignia de cámara sobre la foto de perfil, en el botón de chat de un perfil ajeno y en el de enviar mensaje. Su texto encima es tinta (`#12100E`), 8.8:1.
- **Acento por modo** (`#8A5606` claro / `#E8A33D` oscuro): el ámbar cuando tiene que ser TEXTO — enlaces, "¿Por qué esta calificación?", el contorno del sello secundario. Tiene un valor distinto por modo precisamente porque el ámbar del relleno da 1.9:1 como texto sobre papel y reprobaría.

### Secondary
- **Verde de WhatsApp** (`#25D366`): existe como token de marca del destino, pero el build NO lo usa como color visible. El glifo de WhatsApp dentro del botón de contacto va en tinta, porque verde sobre ámbar mide 1.09:1. La pista del destino la da la forma del logotipo, no su color.

### Tertiary
- **Rojo de error** (`#A81E12` claro / `#F08074` oscuro) con su propio color de texto (`errorTexto`: blanco en claro, tinta en oscuro).
- **Verde de confirmación** (`#146B3E` claro, medido 4.8:1 / `#4FBF85` oscuro): señales positivas de compatibilidad.
- **Lavado del sello** (`tintedSurface` `#FBF0DC` / `#241B0F`, con `tintedBorder` `#E3CFA4` / `#4A3616`): el bloque que la hoja quiere destacar sin gastar sello — el bloque de IA del cuestionario, la tarjeta de compatibilidad de un perfil, la opción elegida de una lista.

### Neutral
- **Papel / Lámpara** (`#F5F1EA` / `#12100E`): el fondo de la app y el de la hoja de una ficha.
- **Elemento** (`#EAE4D9` / `#1C1916`): el relleno de una casilla enmarcada — la de la calificación, la foto ausente, el selector de orden.
- **Seleccionado** (`#DED6C8` / `#262119`): la fila elegida de un desplegable.
- **Tinta secundaria** (`#5C554B` / `#A39A8C`): toda etiqueta, todo metadato, todo valor ausente.
- **Borde de campo** (`#8A8177` / `#726960`): delimita controles. Cumple 3:1 porque es un componente de interfaz.
- **Filete** (`#C9C0B0` / `#322D27`): separa renglones y bloques. Es decorativo y no le aplica el 3:1.

### Named Rules
**La Regla del Sello.** El ámbar aparece SOLO sobre lo que compromete o valida —revelar un contacto, crear la cuenta, guardar, consentir, enviar— y en ningún otro lugar. Un segundo ámbar en la misma pantalla es un error, no una variante. Consecuencia observable y deliberada: Inicio no tiene ni un pixel de ámbar, porque ahí no hay ninguna acción que comprometa; el Nivel 2 del motor se distingue por icono, texto y contraste, no por color de sello.

**La Regla del Relleno con su Propio Texto.** Todo relleno de color trae su color de texto declarado junto a él (`selloTexto`, `errorTexto`), nunca "blanco por defecto". Blanco sobre ámbar da 1.98:1 y blanco sobre el rojo claro del modo oscuro da 2.61:1: los dos reprueban. El par relleno+texto viaja siempre junto.

**La Regla de las Dos Líneas.** Filete decorativo y borde de campo son tokens DISTINTOS y nunca se sustituyen uno por otro. WCAG 1.4.11 exige 3:1 al segundo y no al primero; usar `filete` para delimitar un control lo vuelve inaccesible, y usar `border` para separar renglones convierte el documento en una reja.

**La Regla de la Segunda Señal.** Ningún estado se codifica solo con color. La pestaña activa lleva barra superior, icono relleno y contraste pleno; el Nivel 2 lleva icono, texto y contraste; la opción elegida lleva lavado, paloma y peso semibold; el requisito de contraseña cumplido lleva paloma, peso y color. Siempre tres señales, o al menos dos.

## Typography

**Display / Body / Label Font:** Archivo (Omnibus-Type), cargada con `@expo-google-fonts/archivo` en cinco cortes: `Archivo_400Regular`, `Archivo_500Medium`, `Archivo_600SemiBold`, `Archivo_700Bold`, `Archivo_900Black`. Una sola familia para todo; no hay segunda voz.

**Character:** Grotesca de impresos, latinoamericana, con cifras que alinean en columna. Se eligió por dos exigencias del mundo, no por el nombre: `fontVariant: ['tabular-nums']` en todo lo que forma columna al recorrer una lista, y un corte Black que aguanta una calificación a 56px sin deshacerse. La pantalla de arranque se sostiene hasta que Archivo está en memoria, para que no haya un fotograma con la tipografía del sistema.

### Hierarchy
- **Calificación** (Black 900, 56px/56px, tracking -1.8, cifras tabulares): la afinidad dentro de su casilla, en la ficha de detalle. Una por pantalla, nunca dos. En la lista la misma casilla baja a 40px/44px con tracking -1.2.
- **Title** (Bold 700, 26px/30px, tracking -0.4): encabezado de pantalla. Modesto a propósito.
- **Subtitle** (SemiBold 600, 20px/26px, tracking -0.2): el título de una publicación dentro de su ficha.
- **Cifra** (Bold 700, 17px/22px, cifras tabulares): renta, distancia, recámaras, cada valor del desglose.
- **Default** (Regular 400, 16px/24px): prosa, descripción, valor de un campo de texto.
- **Small / SmallBold** (Regular 400 y SemiBold 600, 14px/20px): dirección, ayuda, atributos, errores.
- **Link / LinkPrimary** (Medium 500 y SemiBold 600, 14px/20px): enlaces; el color sale del tema (`acento`), nunca de un literal.
- **Etiqueta** (SemiBold 600, 11px/14px, tracking 0.9px, MAYÚSCULAS en el llamador): versalita que nombra cada casilla.
- **Folio** (Medium 500, 11px/14px, tracking 0.6px, cifras tabulares): folio, fecha de emisión, foja.

### Named Rules
**La Regla del Dato que Manda.** En un kardex el encabezado es modesto y el dato manda. Por eso `calificacion` (56px) es más grande que `title` (26px), al revés de lo que hace cualquier app. Si un título de pantalla vuelve a crecer por encima del dato que la pantalla existe para mostrar, el mundo se rompió.

**La Regla del Par.** Un documento oficial no tiene texto suelto: tiene pares de etiqueta y valor. Toda cifra y todo dato llevan su versalita encima. "1.2 km" no significa nada sin "DISTANCIA" arriba, y la prosa dentro de una tarjeta no se puede escanear ni alinear.

**La Regla de la Familia Apuntada.** Con tipografía propia, `fontWeight` NO sintetiza el corte: hay que apuntar a la familia (`fontFamily: Tipografia.bold`). Un `fontWeight: '700'` sobre Archivo Regular deja el texto en regular en Android y en falso negrita en iOS.

**La Regla de la Columna.** Todo lo que se compara entre una ficha y la siguiente lleva `fontVariant: ['tabular-nums']` y ancho mínimo fijo (la casilla de la calificación: 96px en lista, 128px en ficha). Un documento impreso nunca tambalea sus columnas.

## Layout

Una sola columna, siempre. El ritmo sale de una escala de siete pasos (2/4/8/16/24/32/64): 16px es el respiro estándar dentro de una hoja y entre fichas de la lista, 8px separa renglones dentro de un bloque, 4px separa un icono de su cifra, 2px separa una etiqueta de su valor, y 64px es el colchón inferior que deja la lista para que el último elemento no quede bajo la barra de pestañas.

La adaptación es **por clase de tamaño, nunca por modelo de dispositivo** (`use-tamano-pantalla.ts`): `compacta` cuando el ancho baja de 360 o el alto de 700 (teléfono chico o teclado abierto), `normal` el teléfono típico, `amplia` a partir de 700px de ancho. En `amplia` la columna NO se estira: se acota a 480px y se centra, porque una línea de sesenta caracteres es legible y una de ciento veinte no. En `compacta` el display baja al 84% (`escalaTitulo`) y lo decorativo se recorta (`altoApretado`), para que el formulario quepa sin que el usuario persiga el botón.

Toda área táctil llega al mínimo de 44pt (WCAG 2.2 SC 2.5.8): el sello mide 48 de alto, los campos 52, las filas de menú y los botones de icono 44, con `hitSlop` donde el glifo mide menos.

### Named Rules
**La Regla de la Clase, no del Modelo.** Preguntar por el modelo del teléfono es la forma garantizada de equivocarse: un plegable abierto, una tableta en pantalla dividida y un horizontal entregan anchos que ningún catálogo predice. Se pregunta cuánto espacio hay AHORA.

## Elevation & Depth

**Cero sombras. Cero `shadowColor`. Cero `elevation`.** No hay una sola sombra en la app y no es omisión: `elevation: 0` está puesto explícitamente en la barra de pestañas y `headerShadowVisible: false` en cada encabezado, porque Android pinta `elevation` como una sombra gris que no pertenece a esta hoja e ignora `shadowColor` por completo. Un intento previo de glow de color se revirtió por eso mismo.

La profundidad se construye con tres materiales planos, en este orden: **filete** (1px para separar renglones y bloques, 2px para el filete principal bajo el encabezado del expediente y para la marca de pestaña activa), **color plano** (papel → elemento → seleccionado) y **lavado del sello** (`tintedSurface` + `tintedBorder`) cuando un bloque tiene que destacar de verdad. Un desplegable flotante se sostiene con borde de campo y `zIndex`, no con sombra.

El grosor del filete es 1px físico, no `hairlineWidth`: en un teléfono de 3x, `hairlineWidth` es ~0.33px y a esa escala el filete desaparece. 1px es lo que imprime una láser.

### Named Rules
**La Regla de la Hoja Plana.** Si un bloque necesita despegarse, se le pone filete o lavado, jamás sombra. Cualquier `shadow*` o `elevation` distinto de 0 que aparezca en este código es una regresión, no una variante.

## Shapes

Tres radios y uno circular, y la escala **crece con la superficie**: `casilla` 8px para lo pequeño y enmarcado (la calificación, la foja, insignias), `control` 12px para todo lo que se toca (sello, campos de texto, desplegables, bloques de aviso), `hoja` 16px para superficies grandes (la ficha completa, su fotografía, el desglose, los bloques de estado), `full` 9999 para pastillas de una línea (el selector de orden, los atajos de distancia).

La primera versión de este mundo usó 2–3px con el argumento de que un impreso tiene esquinas vivas. Era cierto y se veía duro, y para alguien de dieciocho años eligiendo dónde va a vivir, duro es lo contrario de lo que ayuda. Lo que sostiene el mundo documento no son las esquinas: son los filetes y los pares etiqueta/valor. Eso queda intacto; lo que se ablandó es todo lo que se toca.

La fotografía es siempre 3:2 —la proporción de una fotografía impresa— y va al ras de la hoja, con filete arriba y abajo, porque una foto engomada llega hasta la regla del formulario.

### Named Rules
**La Regla de la Escala por Superficie.** Una casilla de 24px con radio 16 se ve deforme y una hoja de 360px con radio 8 se ve tacaña. El radio se elige por el tamaño de la superficie, no por gusto.

## Components

### Sello (botón)
El componente que carga la doctrina del color. Carácter: una firma, no un botón de app.
- **Forma:** radio 12px (`control`), alto mínimo 48, padding horizontal 24, contenido centrado con icono opcional a 18px y 8px de separación.
- **Relleno (`sello`):** fondo ámbar `#E8A33D`, texto e icono en tinta `#12100E` (8.8:1), tipografía Bold 15px con tracking 0.4. Reservado a la acción que compromete.
- **Contorno (`contorno`):** fondo transparente, borde de 2px y texto en `theme.acento`. Cada variante toma su color del fondo que de verdad tiene detrás: la tinta del relleno sobre fondo de app daba 1.00:1 en oscuro y el botón desaparecía.
- **Estados:** presionado = opacidad 0.75; inactivo o cargando = opacidad 0.45 con `ActivityIndicator` del color del texto. No hay hover; no hay escala; no hay sombra.

### Campo (entrada de texto)
- **Estructura:** etiqueta persistente en versalita arriba, entrada abajo, error como renglón debajo.
- **Estilo:** borde de campo 1px, radio 12px, fondo del papel, alto mínimo 52, padding 16/8, texto Regular 16.
- **Error:** el borde NO se recolorea. Aparece un renglón `small` en el rojo del modo con `accessibilityLiveRegion="polite"`, para que el mensaje se pueda leer y anunciar en vez de depender de un color que mucha gente no distingue.
- **Contraseña:** misma envoltura, con botón de ojo de 44×44 a la derecha; anuncia su ACCIÓN ("Mostrar la contraseña") y expone `accessibilityState.selected`.

### Casilla de calificación
La pieza que define el mundo. Recuadro con borde de campo, fondo de elemento, radio 8, etiqueta en versalita arriba y la cifra debajo, alineada a la izquierda y con ancho mínimo fijo (96px en lista, 128px en ficha) para que forme columna. **No lleva lavado ámbar**: una calificación informa, no compromete, y veinte fichas en pantalla ponían veinte manchas de sello donde no se podía actuar. Sin score se muestra un guion largo en tinta secundaria: el campo existe aunque el dato no.

### Ficha de publicación (hoja)
Borde de filete 1px, radio 16, `overflow: hidden`. Orden fijo de arriba abajo: tira de folio (tipo de inmueble en versalita a la izquierda, FOLIO a la derecha), fotografía 3:2 al ras con filete arriba y abajo, y cuerpo con 16px de padding: título (subtitle), dirección (small secundario), la fila de calificación + renta + distancia, y si hay atributos, un filete y la fila de atributos con icono a 14px. Presionada = opacidad 0.7. Sin foto no se pinta un rectángulo gris: se pinta un campo que dice "SIN FOTOGRAFÍA".

### Desglose de calificación
El componente firma del producto: tocar la calificación abre la caja negra y muestra la fórmula real (0.6 · filtros ponderados + 0.4 · afinidad semántica) con los números que devolvió Postgres, en filas de etiqueta / valor tabular alineado a la derecha / peso. Bloque con borde de campo y radio 16. Si no hubo Nivel 2, lo DICE en vez de esconder la mitad de la fórmula.

### Sección
Versalita, filete, contenido. Tres bloques de dos campos se leen; seis campos seguidos no. La acción del bloque va en la misma línea del título, porque ahí es donde se busca.

### Navegación
- **Barra de pestañas:** alto 64, fondo del papel, filete superior de 1px en color de borde, `elevation: 0`. Etiqueta en SemiBold 10px con tracking 0.6. La pestaña activa lleva tres señales: barra de 18×2px encima (como la pestaña levantada de un folder), icono relleno en vez de contorno, y color de tinta plena frente al secundario. La barra ocupa su espacio siempre, activa o no, para que el icono no brinque dos píxeles en cada cambio.
- **Encabezados:** fondo del papel, título SemiBold 16, sin sombra. El tema de NAVEGACIÓN de React Navigation está declarado aparte en `_layout.tsx` (fondo, tarjeta, borde = filete, y los cuatro cortes de Archivo), porque lo que React Navigation pinta por su cuenta se queda en el gris de fábrica si no se le dice.

### Selector de orden
Pastilla `full` con borde de campo, fondo de elemento, alto 38, icono 14 + texto SemiBold + chevrón. Abierto, despliega un panel con borde de campo y radio 16, filas de 44 de alto separadas por filete, la elegida con fondo seleccionado, tinta plena y paloma. Roles `combobox` / `menu` / `menuitem`, no "button" genérico.

### Movimiento
Un solo `FadeIn` plano (200–250ms) para lo que entra, y `LayoutAnimation` de 160ms `easeInEaseOut` sobre opacidad para lo que se despliega. Las fotografías entran con `transition: 160`. Nada más.

### Named Rules
**La Regla de la Transición Única.** Toda aparición es un `FadeIn` corto y plano. El despliegue del desglose es altura, no rebote. Sin resorte, sin escalonado entre hermanos, sin cascada. Se probó una entrada con spring y cascada y se revirtió: era la única animación con rebote de toda la app y leía como inconsistencia, no como confianza.

## Do's and Don'ts

### Do:
- **Do** reservar el ámbar `#E8A33D` para la acción que compromete o valida, y darle siempre `selloTexto` encima. Si una pantalla nueva no tiene una acción de ese tipo, esa pantalla no lleva ámbar.
- **Do** escribir toda cifra y todo dato como par etiqueta/valor, con la versalita `etiqueta` en MAYÚSCULAS encima.
- **Do** usar `Filete.fino` con `theme.filete` para separar y `theme.border` para delimitar un control; son decisiones distintas con umbrales de contraste distintos.
- **Do** apuntar a la familia (`Tipografia.bold`) en vez de a `fontWeight` cuando necesites un corte más pesado.
- **Do** poner `fontVariant: ['tabular-nums']` y un ancho mínimo a cualquier cifra que se compare entre elementos de una lista.
- **Do** elegir el radio por el tamaño de la superficie: 8 casilla, 12 control, 16 hoja, `full` pastilla.
- **Do** adaptar por clase de tamaño (`useTamanoPantalla`) y acotar la columna a 480px en pantallas amplias.
- **Do** dar a todo estado una segunda y tercera señal además del color: forma, icono, peso o paloma.
- **Do** mostrar el error como renglón debajo del campo, con `accessibilityLiveRegion`, sin recolorear el borde.

### Don't:
- **Don't** usar el ámbar `#E8A33D` como TEXTO: da 1.9:1 sobre papel. Para texto existe `theme.acento`, con un valor por modo.
- **Don't** asumir que el texto sobre un relleno de color es blanco. En modo oscuro el rojo es claro y el blanco da 2.61:1.
- **Don't** añadir `shadowColor`, `elevation` distinto de 0, gradiente ni glow. Este mundo separa con filete, color plano y lavado.
- **Don't** añadir resorte, rebote, escalonado ni entradas en cascada.
- **Don't** usar un `placeholder` como etiqueta de un campo: desaparece en cuanto se escribe.
- **Don't** escribir `borderWidth: 1` ni `borderRadius: Spacing.two` a mano; usa `Filete.fino` y `Radios.*`, que es lo que hace localizable un cambio de sistema.
- **Don't** dejar que un título de pantalla compita en tamaño con el dato que la pantalla existe para mostrar.
- **Don't** pintar un rectángulo gris para un dato ausente: pinta el campo y di que está vacío.

## Estado de la implementación

Este sistema está aplicado a fondo en: `(tabs)/inicio`, `publicacion/[id]`, `(auth)/login`, `(auth)/registro`, `(tabs)/perfil`, `perfil/preferencias`, y a los componentes `ficha/*`, `FichaPublicacion`, `Campo`, `CampoContrasena`, `RequisitosPassword`, `BotonVerContacto`, `Casilla`, `FormularioCuestionario`, además de los dos `_layout`.

**Nueve pantallas no han tenido pasada de composición todavía.** Heredan la paleta y la tipografía porque salen del tema, pero conservan la composición del sistema anterior: `(tabs)/publicaciones`, `(tabs)/roomies`, `(tabs)/chats`, `chat/[conversacionId]`, `perfil/[usuarioId]`, `publicacion/nueva`, `publicacion/editar/[id]`, `(auth)/cuestionario-inicial` y `(auth)/recuperar-contrasena`. No son referencia: cuando una de ellas contradiga este archivo, manda este archivo.

**Deuda conocida, registrada sin canonizar:**
- `borderWidth: 1` literal en `FormularioPublicacion` (cuatro sitios), `perfil/[usuarioId]`, `(auth)/recuperar-contrasena` y `chat/[conversacionId]`. Es numéricamente igual a `Filete.fino`, así que no se ve, pero rompe la localizabilidad del token. Lo mismo con `borderRadius: Spacing.two` y `borderRadius: 22` usados como radios en esas mismas pantallas, y con el `borderRadius: 6` de la casilla de consentimiento, que está fuera de la escala de tres radios.
- Los títulos de `login` (34px) y `registro` (30px) sobreescriben `title` (26px) con literales en línea. Es una desviación del ramp, no un paso nuevo de la escala.
- El mapa de Google en `publicacion/[id]` se pinta con su tema claro de fábrica dentro de una hoja en modo oscuro. Es el único rectángulo de la app que no pertenece a este mundo.
- `MaxContentWidth` (800) y el estilo tipográfico `code` (monoespaciada del sistema, 12px) están declarados en el tema y no los consume nadie. `Fonts` expone alias `serif`/`rounded`/`mono` del sistema que este mundo tampoco usa.
- **No hay capturas de verificación en dispositivo.** Todos los contrastes están calculados y comentados en el código; ninguno está confirmado contra un render real en un teléfono. Hasta que las haya, los valores del ramp son legibles por medición, no por observación.

**Procedencia de las fotografías de demostración:** las 87 imágenes del catálogo de demo son de Unsplash, bajo Licencia de Unsplash, atribuidas una por una en `docs/fotos-de-demo.md`. No corresponden a los departamentos reales de esas direcciones y ninguna la tomó el equipo.
