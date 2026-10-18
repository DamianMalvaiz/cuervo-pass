# Prueba en dispositivo · Cuervo 360 · Semana 1

Hasta hoy **nada de la Semana 1 se ha visto en un teléfono**. Este documento es la lista para hacerlo y el
sitio donde se anota el resultado. `DESIGN.md` (sección «Estado de la implementación») dice «sin revisar en
dispositivo» para casi todo esto: cuando una fila de aquí diga ✓, esa línea de `DESIGN.md` se actualiza.

**Regla:** una casilla se marca **solo** si la persona que prueba lo vio. Si no se probó, se queda vacía.
«Sin verificar» es una respuesta honesta; un ✓ que no se vio, no.

## Preparación

| Paso | Comando o acción | Para qué |
|---|---|---|
| 1 | Detener el servidor de Expo viejo (`Ctrl+C` en su terminal) y correr `npx expo start --clear` | El anterior lleva días abierto y `app.json` (nombre, portada, íconos) cambió: Expo Go lo lee al arrancar |
| 2 | `./scripts/tunel.sh` | Sin túnel, el Nivel 2 (afinidad por IA) no responde y la lista cae a Nivel 1 |
| 3 | iPhone y laptop en la **misma Wi-Fi**; abrir Expo Go y escanear el QR | Si no conecta, `npx expo start --clear --tunnel` |
| 4 | **No** dejar el celular conectado por cable de datos a la laptop | El cable desvía el internet y bloquea GitHub y Supabase |
| 5 | Dos cuentas: **A** (quien prueba) y **B** (otra persona o un segundo teléfono) | El chat, los favoritos y el conteo necesitan dos |

**Lo que Expo Go NO puede mostrar** (solo se ve con el APK): el ícono de la app, la portada, el ícono
monocromo, y el comportamiento real de la barra inferior con la navegación por gestos de Android.

## Qué mirar

Marca cada casilla con ✓ o ✗ y la fecha. Si algo falla, anota **qué viste**, no qué esperabas.

### Marca y entrada
| # | Qué se comprueba | iPhone | Android | Notas |
|---|---|---|---|---|
| 1 | La pantalla de entrada muestra el **logo**, «Cuervo 360» y «Todo en un solo lugar.» | | | |
| 2 | El logo **no tiene una caja negra** alrededor, ni en modo claro ni en oscuro | | | |
| 3 | El ícono de la app y la portada son los de Cuervo 360 | — | | Solo APK |

### Menú
| # | Qué se comprueba | iPhone | Android | Notas |
|---|---|---|---|---|
| 4 | Con una cuenta **sin** función de vendedor aprobada se ven: Inicio, Favoritos, Chats, Perfil (**sin** «Publicar») | | | |
| 5 | Con una cuenta que **ya publicaba** (migrada) aparece también «Publicar» | | | |
| 6 | Las **etiquetas de la barra inferior se leen completas** y no quedan bajo el borde | | | Visto fallar en Android el 17/10 |
| 7 | La pestaña activa se distingue sin depender del color (barra, icono relleno) | | | |

### Inicio
| # | Qué se comprueba | iPhone | Android | Notas |
|---|---|---|---|---|
| 8 | El selector **Depas \| Roomies** cambia de vista y siempre se puede volver | | | |
| 9 | En cada fila se lee completo «AJUSTE · RENTA · **DISTANCIA**» (no se corta a la derecha) | | | Visto fallar en Android el 17/10 |
| 10 | Cada fila tiene su **corazón** arriba a la derecha y el título no pasa por debajo | | | |
| 11 | Con el túnel arriba, el encabezado dice «NIVEL 2 · N DE N CON AFINIDAD SEMÁNTICA» | | | |
| 12 | Mi perfil → «Mi anuncio de roomie» abre **Inicio ya en Roomies** | | | |

### Favoritos
| # | Qué se comprueba | iPhone | Android | Notas |
|---|---|---|---|---|
| 13 | Tocar el corazón lo **llena al instante** | | | |
| 14 | La publicación aparece en la pestaña **Favoritos** y al tocarla abre su ficha | | | |
| 15 | Quitar el corazón la saca de la lista | | | |
| 16 | **Modo avión** + tocar el corazón: el corazón **vuelve** y sale un aviso de conexión | | | |
| 17 | Sin favoritos: «Aún no guardas ninguna publicación…» (no un error) | | | |
| 18 | **A y B** guardan la misma publicación: la ficha dice «2 personas la guardaron» y **no dice quiénes** | | | |
| 19 | El **dueño** ve «N personas la guardaron» en Mis publicaciones | | | |

### Contacto
| # | Qué se comprueba | iPhone | Android | Notas |
|---|---|---|---|---|
| 20 | En la ficha de una publicación **ajena**: «Escribir en la app» y debajo «Ver contacto» | | | |
| 21 | «Escribir en la app» abre el chat con el dueño | | | |
| 22 | En una publicación **propia** no sale «Escribir en la app» | | | |
| 23 | Un mensaje de A **llega a B** sin recargar (Chats) | | | Tiempo real |
| 24 | «Ver contacto» sigue abriendo WhatsApp | | | |

### Funciones
| # | Qué se comprueba | iPhone | Android | Notas |
|---|---|---|---|---|
| 25 | Mi perfil muestra **TUS FUNCIONES** con «Estudiante» | | | |
| 26 | «Agregar función de comerciante» **pide confirmación** y dice que no da acceso todavía | | | |
| 27 | Al confirmar aparece «Sin verificar» y la pestaña Publicar **sigue oculta** | | | |
| 28 | Una función migrada dice «Aprobada por migración… No es una revisión» | | | |

### Paleta y sello
| # | Qué se comprueba | iPhone | Android | Notas |
|---|---|---|---|---|
| 29 | **Modo claro:** fondo blanco verdoso, tarjetas blancas, nada ilegible | | | |
| 30 | **Modo oscuro:** fondo carbón, nada ilegible | | | |
| 31 | El botón primario (Entrar, Guardar…) es **lima con texto carbón** | | | |
| 32 | «Ver contacto» y el botón de enviar mensaje son el **sello**: carbón en claro, **blanco hueso en oscuro**, y NO se parecen al botón lima | | | Ver nota 11 de `DESIGN.md` |
| 33 | La casilla marcada y la insignia de la cámara son **verde bosque** y se distinguen del fondo | | | |

### Mapa
| # | Qué se comprueba | iPhone | Android | Notas |
|---|---|---|---|---|
| 34 | **iPhone:** la ficha muestra el mapa (Apple Maps) | | — | |
| 35 | **Android sin clave de Google:** en vez de un rectángulo gris, la dirección y «Abrir en Maps» | — | | |

### Sesión
| # | Qué se comprueba | iPhone | Android | Notas |
|---|---|---|---|---|
| 36 | Cerrar sesión y entrar con **otra cuenta**: no queda nada de la anterior (perfil, favoritos, chats) | | | |

## Después de la prueba
1. Anotar aquí lo que falló y **abrir un hallazgo por cada ✗**, con lo que se vio.
2. Actualizar la sección «Estado de la implementación» de `DESIGN.md` con lo que sí se vio.
3. Recompilar el APK **una sola vez**, con todos los arreglos y, si ya está, la clave de Google Maps.
