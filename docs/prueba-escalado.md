# Prueba de escalado de texto

`PRODUCT.md` compromete «respecting the system's font-size scaling». Esto es lo
que hay que hacer para poder afirmarlo, y **solo se puede hacer en un
dispositivo**: ningún script lo comprueba, y una suite en verde no dice nada
sobre esto.

## Qué se implementó (y qué no prueba)

`ThemedText` declara un tope de escalado por tipo:

| Tipo | Tope | Por qué |
|---|---|---|
| `default`, `small`, `smallBold`, `link`, `code` | **1.4** | Texto corrido: crece de verdad, que es el punto |
| `title`, `subtitle` | **1.2** | Un título al 140 % se come la pantalla y empuja el contenido fuera de la primera vista |
| `cifra`, `calificacion`, `folio`, `etiqueta` | **1.0** | Viven en casillas de ancho fijo |

Nada lleva `allowFontScaling={false}`: apagar el escalado es romper la promesa,
no cumplirla a medias. Lo que se acota es **cuánto** crece.

El tope de 1.0 en las cifras no es pereza. `cifraLista` mide 40/44 px con
`numberOfLines={1}` y `adjustsFontSizeToFit`: al escalar, el texto no cabe y
`adjustsFontSizeToFit` lo **encoge** hasta que quepa. La calificación —el
elemento que el sistema declara como el más importante— acabaría **más pequeña
que el texto de al lado**. La jerarquía se invierte justo para quien subió el
tamaño porque le costaba leer, que es exactamente a quien esto pretende ayudar.

Las pruebas de `src/components/__tests__/themed-text.escalado.test.tsx`
comprueban que los topes estén declarados. **No comprueban que nada se vea
bien.** Eso es lo que sigue.

## El procedimiento

### 1. Subir el tamaño en el sistema

- **Android:** Ajustes → Pantalla → Tamaño de fuente → al **máximo**. En varios
  fabricantes hay además «Tamaño de pantalla»; déjalo en normal para aislar la
  variable.
- **iOS:** Ajustes → Accesibilidad → Pantalla y tamaño de texto → Texto más
  grande → activar «Tamaños de accesibilidad» y llevarlo al máximo.

### 2. Recorrer estas siete pantallas

Para cada una, una captura:

1. **Sugerencias** — que las tres columnas de la fila sigan alineadas y que
   ningún título se recorte a media palabra.
2. **Detalle de una publicación** — la casilla de AJUSTE y su desglose.
3. **Mis publicaciones** — la ficha grande, que es la densa.
4. **Chats** — la insignia de no leídos, que es una cifra en un círculo.
5. **Una conversación** — las burbujas y la hora.
6. **Nueva publicación** — el formulario, donde hay dieciséis campos.
7. **Mi perfil** — los ajustes, que son filas con icono y chevron.

### 3. Qué mirar en cada una

- [ ] Ningún texto **recortado** con puntos suspensivos donde antes cabía.
- [ ] Ninguna cifra **más pequeña** que el texto que la rodea (la inversión de
      jerarquía).
- [ ] Ningún control por debajo de lo tocable: al crecer el texto, un botón
      puede empujar a otro fuera de su área.
- [ ] Ningún texto **solapado** con otro.
- [ ] Las filas de sugerencias siguen dejando ver **al menos dos** completas.

### 4. Registrar el resultado

Las capturas van a `docs/capturas/escalado-200/`, y el resultado —pasa o no, y
qué se rompió— se anota en `docs/bitacora-semanal.md`.

## Si no se ejecuta

Entonces `PRODUCT.md` afirma algo que nadie comprobó. Hay dos salidas honestas y
una deshonesta:

- Ejecutarlo y corregir lo que salga.
- Cambiar la línea de `PRODUCT.md` por lo que sí es cierto: que la app **declara
  topes de escalado por tipo** y que no se ha verificado en dispositivo.
- Dejarla como está y esperar que nadie pregunte. Esa es la deshonesta, y es la
  que el §0.2 del documento de endurecimiento identifica como el defecto de
  fondo del proyecto: **la documentación describe un sistema distinto al
  construido.**

**Estado: sin ejecutar** (19/09/2026). Los topes están implementados y probados
en código; la verificación en dispositivo está pendiente.
