# Cola de trabajo

Estado al **20/09/2026**, tras la revisión del bloque de endurecimiento.
Complementa a [`endurecimiento-v6.md`](endurecimiento-v6.md), que es el mapa —y que la **orden V.1 arregla, porque está desactualizado**.

---

## Dónde estamos

Verificado contra el código vivo y contra la base de producción, no contra mensajes de commit:

| | |
|---|---|
| Migraciones en producción | **0039, todas aplicadas** |
| Barreras contra producción | **19 / 19** |
| pgTAP | **86** |
| Jest | **306** |
| pytest (microservicio) | **20** |
| Cobertura `src/services` · `src/store` | **66 %** · **70 %** |
| `tsc`, `expo lint`, `verificar:env` | limpios |

Los treinta y ocho hallazgos END del documento v6 están cerrados. Se contrastaron cuatro contra el código real —END-08, END-09, END-16 y END-30— y los cuatro son correcciones de verdad, no descripciones de correcciones.

**Lo que queda no son los hallazgos originales.** Son cinco cosas que aparecieron *al revisar el trabajo hecho*, y cuatro de ellas son la misma familia de siempre: algo que el repositorio afirma y que ya no es cierto.

---

## Reglas

Las mismas del plan anterior, y no son ceremonia: cada una nació de un error concreto de esta sesión.

1. **Una orden, una rama, un commit.**
2. **Ninguna orden se cierra sin su verificación en verde.** Si el comando no pasa, la orden no está hecha.
3. **Ningún arreglo sin una prueba que falle antes.** Escribe la prueba, **confirma el rojo**, arregla, confirma el verde.
4. **Toda cifra que escribas en un `.md` tiene que venir de un comando.** Si la escribes a mano, cita el comando al lado — y córrelo.
5. **Antes de creerle a una verificación, comprueba sus condiciones.** Cuatro de los errores de esta auditoría fueron de aquí y ninguno de razonamiento.

Las reglas permanentes viven en [`../AGENTS.md`](../AGENTS.md) y se cargan solas en cada sesión.

---

# V.1 · El mapa está desactualizado

**Prioridad: primero. Antes de escribir una línea de código.**

### Defecto

`docs/endurecimiento-v6.md` no se ha tocado desde que se escribió (`f5e2187`). Su **§0.4 «Hallazgos abiertos»** lista END-08 a END-38 como pendientes. **Los treinta y uno están cerrados.**

El documento escrito específicamente para combatir *«la documentación describe un sistema distinto al construido»* es hoy el peor ejemplo de eso en el repositorio. Quien lo abra mañana trabajará sobre un mapa falso.

Además faltan los hallazgos que aparecieron **después** de escribirlo, y uno de ellos es el mejor trabajo de seguridad del proyecto.

### Orden

> Actualiza `docs/endurecimiento-v6.md`. No lo reescribas entero: corrige lo que dejó de ser cierto.
>
> **1. Mueve END-08 a END-38 de §0.4 a §0.3.** Cada uno conserva su texto de defecto y su bloque de remediación, y gana una línea de cierre con el commit que lo resolvió. La correspondencia la da el repositorio, no la memoria:
>
> ```bash
> git log --format='%h %s' f5e2187..HEAD | grep -oE '^[0-9a-f]+ .*END-[0-9]+' | sort -t- -k2 -n
> ```
>
> §0.4 queda con los hallazgos que siguen abiertos: los de este documento (V.2 a V.5).
>
> **2. Reescribe §0.2 (dictamen).** Hoy dice que tres críticos están remediados y que el cuarto —END-08— sigue abierto. Ya no es cierto. El dictamen nuevo tiene que decir dos cosas: que el patrón de fondo (*afirmar sin verificar*) se confirmó, y que **volvió a aparecer en el propio documento que lo denunciaba**. Eso es más honesto y más útil que declarar victoria.
>
> **3. Añade los hallazgos nuevos** como END-39 en adelante. El más importante:
>
> **END-39 · `revoke ... from public` no revocaba nada** · Crítico · migración `0036`
> Supabase trae `alter default privileges ... grant execute on functions to anon, authenticated, service_role`, así que cada función nace con esas concesiones **escritas en su propia ACL** y `revoke from public` no las quita. Doce migraciones creían estar cerrando funciones y no cerraban ninguna. Dos exploits vivos con la anon key: `devolver_cuota` permitía resetear la cuota propia en bucle —o sea, extraer la base de teléfonos entera, que es justo lo que AUD-04 existe para impedir— y `afinidad_de_para` aceptaba el uuid de cualquiera. Lo destapó la aserción 72 de la `0035`, **la primera del proyecto que comprobaba un revoke en vez de escribirlo**. La corrección cambia la forma: cerrar todo y abrir por lista.
>
> Anota también, porque importa para el criterio: **`devolver_cuota` la introdujo la orden B.4 de este mismo plan.** Una remediación puede abrir un agujero, y por eso la regla 3 exige prueba antes que arreglo.
>
> **4. Actualiza §1 y §2** (registro y compuertas) con las cifras reales. Sácalas con comandos, no de este documento:
>
> ```bash
> grep -oP 'select plan\(\K[0-9]+' supabase/tests/rls.test.sql          # pgTAP
> npx jest --silent 2>&1 | grep -oE "Tests: +[0-9]+ passed"             # Jest
> (cd ai-service && .venv/bin/python -m pytest tests -q | tail -1)      # pytest
> git log --oneline pre-endurecimiento..HEAD | wc -l                    # commits
> ```
>
> **5. Vacía §3 (pasos manuales).** Todo está aplicado en producción; `migration list` lo confirma hasta la 0039. Sustitúyelo por una línea que lo diga y remita a la verificación.
>
> **6. Sustituye §5 y §6** (órdenes y secuencia) por un puntero a este archivo. Dos colas de trabajo en dos documentos se desincronizan; ya pasó una vez.

### Aceptación

- `grep -c "^\*\*END-" docs/endurecimiento-v6.md` devuelve más de 38.
- §0.4 solo contiene hallazgos que de verdad están abiertos.
- Ninguna cifra del documento difiere de la que devuelve su comando.

### Verificación

```bash
cd /home/damianml/cuervo-pass && diff <(grep -oP 'select plan\(\K[0-9]+' supabase/tests/rls.test.sql) <(grep -oP '\| pgTAP[^|]*\| \*\*\K[0-9]+' docs/endurecimiento-v6.md | head -1) && echo "las cifras coinciden"
```

---

# V.2 · El README dice 83 aserciones. Son 86.

### Defecto

En cuatro sitios: líneas **109**, **149**, **190** y **197** de `README.md`.

La peor es la 149, y conviene leerla entera:

> «Ochenta y tres aserciones de pgTAP […] **El número se lee del archivo, no se escribe a mano:**»
> ```bash
> grep -oE 'select plan\([0-9]+\)' supabase/tests/rls.test.sql
> ```

Afirma que el número no se escribe a mano, escrito a mano, con el comando que lo desmiente justo debajo. Nadie lo corrió.

### Orden

> Corrige las cuatro apariciones de `83` en `README.md` al valor real (sácalo con el comando, no lo copies de aquí — para cuando leas esto pueden ser más).
>
> Y quita la causa, no solo el síntoma: **la línea 149 no debe llevar el número**. Reescríbela para que remita al comando en vez de repetir su salida. Algo como *«Las aserciones de pgTAP corren en CI y rompen el build. Cuántas hay, lo dice el archivo:»* seguido del `grep`. Un número que no está escrito no puede quedar obsoleto.
>
> Revisa si el mismo número está a mano en otros sitios:
>
> ```bash
> grep -rn "aserciones" README.md AGENTS.md docs/*.md scripts/*.mjs | grep -vE "bitacora"
> ```
>
> La bitácora **no se toca**: es historia fechada y sus cifras eran correctas cuando se escribieron.

### Verificación

```bash
cd /home/damianml/cuervo-pass && N=$(grep -oP 'select plan\(\K[0-9]+' supabase/tests/rls.test.sql); grep -nE "aserciones|supabase test db" README.md | grep -vE "\b$N\b" && echo "^ quedan cifras que no coinciden con el archivo" || echo "todas las cifras del README coinciden"
```

> Ojo con el patrón: buscar solo `aserciones` **se pierde la línea 197**, que dice
> `npx supabase test db   # 83` sin esa palabra. Lo comprobé y se me escapó una de
> las cuatro. Por eso el comando busca también `supabase test db`.
>
> Reporta de más la línea 79, que menciona el comando sin dar ninguna cifra:
> es un falso positivo y se ignora. Afinarlo más no vale la pena, porque la
> línea 149 escribe el número **con letra** («Ochenta y tres») y cualquier
> filtro por dígitos la perdería — que es justo la que más importa.

---

# V.3 · `.tunel-actual` no se valida, y ahora eso es peor

### Defecto

Dos sitios leen ese archivo y confían ciegamente en su contenido:

- `scripts/tunel.sh:95-97` — `ANTERIOR="$(cat .tunel-actual)"` y luego `curl -sf "$ANTERIOR/listo"`.
- `scripts/verificar.mjs:87` — `dominio = readFileSync('.tunel-actual')` y luego `fetch(\`${dominio}/listo\`)`.

**El 19/09 ese archivo contenía `http://127.0.0.1:8000`** — la URL local, no el dominio público. Con la lógica de reutilización que añadió E.6, eso produce:

- `tunel.sh` hace `curl http://127.0.0.1:8000/listo`, que **responde 200 siempre**, imprime «sigue vivo. No se toca», sale con 0 y **nunca vuelve a crear un túnel**.
- `verificar.mjs` comprueba localhost. Su propio comentario dice: *«En localhost siempre se ve bien. Lo que importa es el camino que recorre la Edge Function.»*

Es un fallo silencioso que **desactiva las dos comprobaciones que existen para detectarlo**. El síntoma se fue solo al relanzar el script; la causa sigue.

### Orden

> **Escribe la prueba primero.** Crea `scripts/__tests__/` o añade a la suite existente un caso que ponga `http://127.0.0.1:8000` en un `.tunel-actual` temporal y afirme que la validación lo rechaza. Confirma el rojo.
>
> En `scripts/tunel.sh`, antes del `if` de la línea 97:
>
> ```bash
> case "$ANTERIOR" in
>   https://*.trycloudflare.com) ;;
>   *) echo "   .tunel-actual no contiene un dominio de túnel ($ANTERIOR); se ignora."
>      ANTERIOR="" ;;
> esac
> ```
>
> Y que el `if` exija `[ -n "$ANTERIOR" ]`.
>
> En `scripts/verificar.mjs`, tras leer el archivo: si el dominio no empieza por `https://`, la comprobación es **`fallo`** y no `aviso`, con un mensaje que diga qué contiene el archivo. Un verificador que comprueba localhost creyendo que comprueba el túnel es peor que uno que no comprueba nada, porque da confianza falsa justo antes de exponer.
>
> Escribe en el encabezado de `tunel.sh` **por qué** existe esa validación, con la fecha y el valor concreto que apareció. Sin eso, el próximo que lo lea la borrará por redundante.

### Aceptación

Con `echo "http://127.0.0.1:8000" > .tunel-actual`, `./scripts/tunel.sh` **no** debe decir «sigue vivo», y `node scripts/verificar.mjs` debe marcar fallo.

### Verificación

La prueba de Jest de la orden es la verificación. **No** compruebes esto
ejecutando `./scripts/tunel.sh` con un `.tunel-actual` falso: si la validación
funciona, el script continúa, **mata el túnel vivo** y levanta otro — y te deja
diez minutos esperando propagación de DNS. Escribí ese comando y lo retiré al
darme cuenta.

Lo seguro es comprobar que el guardia existe y que la prueba lo ejercita:

```bash
cd /home/damianml/cuervo-pass && grep -q "trycloudflare.com)" scripts/tunel.sh && echo "✓ tunel.sh valida el dominio" || echo "✗ falta el guardia en tunel.sh"; npx jest --silent -t "tunel" 2>&1 | tail -4
```

---

# V.4 · La pantalla de chat no tiene una sola prueba

### Defecto

| Capa | Cobertura |
|---|---|
| `app/chat` | **0 %** |
| `app/publicacion/editar` | **0 %** |
| `components/ui` | 0 % |

END-16, END-19 y END-20 se cerraron en `5cd7d41`, y sus arreglos de `services` y `store` **sí** están cubiertos (66 % y 70 %). Lo que no tiene ninguna prueba es la pantalla, que es donde vive la lógica más frágil del chat: el envío optimista, el reintento en la burbuja, la deduplicación contra el eco de Realtime, la limpieza al desmontar y la paginación hacia atrás.

`src/app/chat/[conversacionId].tsx` usa siete acciones del store (`agregarOptimista`, `confirmarOptimista`, `marcarFallido`, `limpiarConversacion`…). Ninguna se ejercita desde la pantalla.

### Orden

> Crea `src/app/chat/__tests__/conversacion.test.tsx` con RNTL, siguiendo el estilo de `src/app/publicacion/__tests__/detalle.test.tsx`, que ya existe y resuelve el andamiaje de mocks.
>
> Cinco casos, y cada uno es un fallo que ya ocurrió o que el código previene a propósito:
>
> 1. **Envío optimista** — al enviar, el mensaje aparece de inmediato con estado `enviando`; el campo de texto queda vacío.
> 2. **Fallo con reintento en la burbuja** — si `enviarMensaje` rechaza, la burbuja queda `fallido` con su acción de reintento, y **el texto no vuelve al campo**.
> 3. **Deduplicación** — el eco de Realtime con el id real no duplica el mensaje optimista ya confirmado.
> 4. **Página anterior con error** — si `listarMensajes` rechaza al pedir historial, se muestra el error; no se queda en silencio (era END-20).
> 5. **Limpieza al desmontar** — al desmontar se llama `limpiarConversacion` (era la fuga de END-19).
>
> Añade después el umbral a `jest.config.js`, **justo por debajo de lo que consigas**, igual que `services` y `store`:
>
> ```js
> './src/app/chat/': { statements: NN, branches: NN, functions: NN, lines: NN },
> ```

### Aceptación

`app/chat` deja de estar en 0 % y tiene umbral propio en `jest.config.js`.

### Verificación

```bash
cd /home/damianml/cuervo-pass && npx jest --coverage --collectCoverageFrom='src/app/chat/**/*.tsx' 2>&1 | tail -12
```

---

# V.5 · El registro tiene una regla nueva y nadie la prueba en pantalla

### Defecto

`app/(auth)` está al **9 %**. Ahí vive `registro.tsx`, donde la orden A.7 acaba de meter la regla de correo institucional (`esCorreoUniversitario`).

El módulo `src/lib/correoUniversitario.ts` sí tiene seis pruebas —incluidas las trampas tipo `ana@edu.mx.atacante.com`— pero **nadie comprueba que el formulario la aplique**. Un `refine` mal puesto en el esquema Zod, o un mensaje que no se pinta, pasan las seis pruebas del módulo y rompen el registro.

Es el mismo hueco que tenía el microservicio: la unidad probada, la integración no.

### Orden

> Crea `src/app/(auth)/__tests__/registro.test.tsx`. Cuatro casos:
>
> 1. Con `ana@gmail.com` **no** se envía el formulario y se muestra el mensaje `MENSAJE_CORREO_NO_UNIVERSITARIO`.
> 2. Con `ana@utvtol.edu.mx` el formulario sí llama a `registrarse`.
> 3. Sin marcar la casilla del aviso de privacidad **no** se envía (§29: el consentimiento no se presume).
> 4. Con contraseñas que no coinciden se muestra el error en `confirmarPassword`.
>
> Añade el umbral de `./src/app/(auth)/` a `jest.config.js`, por debajo de lo que consigas.

### Verificación

```bash
cd /home/damianml/cuervo-pass && npx jest "src/app/(auth)" --coverage --collectCoverageFrom='src/app/(auth)/**/*.tsx' 2>&1 | tail -12
```

---

# V.6 · Menor, solo para que conste

`coverage/` entró al historial en `b428206` (2.2 MB de salida generada) y salió en `d83b442`. Está en `.gitignore` y ya no se versiona, pero **los blobs quedan en el historial para siempre**.

No vale la pena reescribir el historial de un repositorio que se entrega en semanas. Basta con saberlo si alguna vez alguien pregunta por qué el clon pesa de más.

---

# V.7 · La suite deja un proceso sin cerrar

**Cerrado en lo que importaba** · `2730761` · 26/09/2026

### Lo que era

Mucho peor que un aviso. Medido archivo por archivo con `/usr/bin/time`:

| Archivo | Pruebas | Proceso colgado |
|---|---|---|
| `pantallas.humo.test.tsx` | 6 en 0.8 s | **280 s** |
| `detalle.test.tsx` | 4 | 280 s |
| `perfil.eliminar.test.tsx` | 5 | 280 s |
| `consultas.test.tsx` | 8 | 31 s |
| `use-fotos-firmadas.test.tsx` | — | 280 s |

Cinco de los seis archivos que crean un `QueryClient`.

### La causa, y cómo se encontró

React Query agenda un `setTimeout` por consulta cuando `gcTime` es un número **finito**, y otro por `staleTime`. Con cinco minutos y treinta segundos por omisión, esos temporizadores mantienen vivo el bucle de eventos de Node.

Se confirmó pidiéndole los recursos a Node, no razonando: `process.getActiveResourcesInfo()` tras cada prueba devolvía `{"Timeout": 9}`, tres más por prueba.

### La corrección

No programar el temporizador: React Query solo agenda con un `gcTime` finito. `0` descarta en cuanto no quedan observadores, `Infinity` no recolecta nunca, y **ninguno de los dos crea un `setTimeout`**. Una prueba no necesita el punto medio.

`test-utils/consultas.ts` expone `clienteDePrueba()`, y `test-utils/__tests__/clientes-registrados.test.ts` rompe el build si una prueba crea su cliente a mano.

**Resultado:** ningún archivo pasa de 8 s. La suite entera bajó de 13.55 s a **5.11 s**.

### Lo que NO se cerró

El aviso de worker **todavía aparece en 1 de cada 5 corridas** en paralelo. En serie no aparece nunca, y `--detectOpenHandles` sobre la suite completa no encuentra ningún manejador.

Ya no es una fuga —era «siempre, más 280 s de cuelgue»— sino una carrera ocasional al desmontar el worker. Si alguien quiere rematarlo:

```bash
cd /home/damianml/cuervo-pass && for i in $(seq 1 10); do npx jest --silent 2>&1 | grep -q "worker process" && echo aviso || echo limpio; done
```

Y un hallazgo de paso que ya está arreglado: la prueba «dentro del staleTime, remontar NO vuelve a consultar» **pasaba con `gcTime: 0`**, o sea con recolección inmediata — justo lo contrario de lo que dice comprobar. Ahora pide `Infinity` explícito.

---

# V.8 · Tres capas siguen sin una sola prueba

*Añadida el 20/09/2026, al terminar V.5.*

### Defecto

Medido hoy con `npx jest --coverage`:

| Capa | Sentencias | Líneas |
|---|---|---|
| `app/publicacion/editar` | **0 %** | **0 %** |
| `components/ui` | **0 %** | **0 %** |
| `app/(tabs)` | 34.87 % | 35.34 % |
| `app/(auth)` | 39.81 % | 41.58 % |

`app/(auth)` subió a 40 % en V.5, pero eso es **solo `registro.tsx`**: login, recuperar contraseña y cuestionario inicial siguen sin cubrir. Y `app/(tabs)` es la pantalla de inicio, publicaciones, roomies y chats — el producto entero.

Lo de `publicacion/editar` es lo que más preocupa de los cuatro: editar una publicación es donde se juntan el formulario, la subida de fotos con `upsert`, el regeneramiento del embedding y el reintento de geocodificación. Es la ruta con más piezas y la única sin red.

### Orden

> **No cubras las cuatro de golpe.** Una capa por sesión, con su umbral, en este orden:
>
> **1. `app/publicacion/editar`.** Cuatro casos: que el formulario llegue precargado con los valores de la publicación (fue un fallo real, `9aed935`); que al guardar con el microservicio caído la publicación se guarde igual y el vector anterior NO se borre (§27 y `perfilVector.ts`); que reemplazar la foto de una posición ya ocupada funcione (es el `upsert` que arregló la `0019`); y que un fallo al guardar se diga en vez de navegar como si hubiera ido bien.
>
> **2. `app/(auth)`, el resto.** Login con credenciales malas muestra el motivo; recuperar contraseña con un correo que no existe **no** revela que no existe; el cuestionario inicial no deja avanzar sin universidad ni presupuesto.
>
> **3. `app/(tabs)`.** Empieza por `inicio.tsx`: que el kicker diga `NIVEL 1` cuando ninguna publicación tiene afinidad y `NIVEL 2 · N DE M` cuando alguna sí — es END-08, el peor hallazgo del proyecto, y hoy solo lo prueba pgTAP del lado del servidor.
>
> **4. `components/ui`.** Es lo de menos: un `collapsible`. Si sigue sin usarse en ninguna pantalla, **bórralo** en vez de probarlo.

### Lo hecho, capa por capa

| Capa | Antes | Ahora | Umbral | Commit |
|---|---|---|---|---|
| `app/publicacion/editar` | 0 % | 96.29 % | 90/66/100/96 | `test(V.8, 1/4)` |
| `app/(auth)` | 39.81 % | 89.81 % | 89/70/86/91 | `test(V.8, 2/4)` |
| `app/(tabs)` | 34.87 % | **93.46 %** · ramas **92.8 %** | 93/92/85/94 | `d06141a` + `chats` + `perfil` + `_layout` + ramas |
| `components/ui` | 0 % | **borrado** | — | capa 4 |

Los tres umbrales se comprobaron subiéndolos a 100 y viendo fallar el build con el porcentaje real en el mensaje.

**Y un hallazgo colateral en la capa 3:** el umbral `global` llevaba **dieciséis puntos de retraso** sobre la realidad (49 declarado, 65.8 % medido). Había dejado de ser un trinquete: no habría detectado perder un tercio de la cobertura de su grupo. Subido a 65. **Cada vez que se añada un grupo por ruta hay que volver a medir el `global`**, porque Jest saca de ese grupo los archivos que caen bajo un umbral por ruta y el número se mueve solo.

### Lo que la capa 3 NO cerró

`app/(tabs)` está en 71 %, no en 90. Lo que queda, en orden de riesgo:

| Archivo | Cobertura | Por qué importa |
|---|---|---|
| ~~`chats.tsx`~~ | ~~52.94 %~~ → **94.11 %** | ✅ cerrado. Ver abajo: la orden apuntaba al archivo equivocado. |
| ~~`perfil.tsx`~~ | ~~57.31 %~~ → **93.9 %** | ✅ cerrado. Ver abajo. |
| ~~`_layout.tsx`~~ | ~~0 %~~ → **100 %** | ✅ cerrado. Ver abajo: mi lectura de este archivo era falsa. |

> ~~**Orden para la próxima sesión que toque esto:** queda solo `_layout.tsx`, la barra de pestañas, que casi no tiene lógica: no vale una sesión propia.~~ **Retirado. Estaba mal.** Ver abajo.

### `_layout.tsx` · lo descarté por «casi sin lógica» y era falso

Escribí en esta cola que la barra de pestañas «casi no tiene lógica» y que no valía una sesión propia. **Al abrirla resultó tener tres cosas y una de ellas escondía un módulo entero al 0 %:**

1. **`registrarTokenPush(miId)` en un `useEffect`** — pide un permiso del sistema y escribe en `push_tokens`.
2. **`useAbrirChatDesdeNotificacion()`** — el enlace profundo desde una notificación, con su propio listener y su propio limpiador: el mismo riesgo de fuga que el de Realtime, que fue el motivo de la sesión anterior.
3. **La marca de tres señales de la pestaña activa** — icono relleno frente a contorno más una barra encima, que es la única parte del sistema visual que se puede comprobar en código en vez de a ojo.

**Y detrás: `lib/pushNotifications.ts` al 0 %.** El único módulo del proyecto que pide un permiso del sistema, escribe en la base **y** navega, sin una sola prueba. Ahora al 92.3 % con su propio archivo (12 pruebas). Lo que se fija ahí:

| Qué | Por qué cuesta si se rompe |
|---|---|
| **Nunca propaga** | Se llama desde un `useEffect` sin `.catch()`: una excepción sería un rechazo no atendido, y en React Native eso tumba la pestaña al montar. En Expo Go el camino de fallo se recorre **siempre**, no es un caso raro. |
| **Sin permiso no guarda token** | Una fila en `push_tokens` de quien no dio permiso es un destino al que el servidor manda notificaciones para siempre sin que lleguen nunca. |
| **`onConflict: 'usuario_id'`** | Sin él, cambiar de teléfono acumula filas y el servidor escribe a tokens muertos. |
| **El deep link va a `chat/<conversacion_id>`** | Con `remitente_id` —lo de antes de v5 §26— abría una ruta que ya no existe. Un deep link roto no truena: deja a la persona en una pantalla vacía justo después de tocar la notificación. |
| **Quita el listener al desmontar** | Si no, un `router.push` por cada montaje: tocar la notificación navegaría varias veces. |

### Las ramas · 79 % → 92.8 %

Dije que lo que faltaba eran «combinaciones de tema claro/oscuro y de tamaño de pantalla que no cambian comportamiento». **Lo medí antes de escribir nada y era falso:** de 58 ramas sin cubrir, ninguna era de tema. Eran la segunda cara de casi cada campo, y el fixture con el perfil completo hacía que solo se pintara una.

Lo que resultó tener comportamiento de verdad:

| Rama | Por qué importa |
|---|---|
| **Consentimiento de IA en «DESACTIVADO»** | Es una declaración de lo que la app hace con los datos de alguien (LFPDPPP). Decir ACTIVADO a quien no consintió es del mismo género que una exportación que falla callada. Nunca se había pintado. La prueba comprueba además que **no** diga la palabra contraria, porque «DESACTIVADO» contiene «ACTIVADO» como subcadena: un `toContain` pasaría en los dos estados. |
| **El perfil a medio llenar** | `tono="atenuado"` existe para que una preferencia sin definir se vea distinta de una definida. Si ese lado estuviera roto, un perfil a medias se leería como completo y la persona no sabría qué le falta. |
| **Fallo CON resultados en pantalla** (`inicio`) | §27. Un refresco fallido con datos en memoria mostraba precios viejos sin aviso. Es distinto del fallo sin datos, que ya tenía su pantalla, porque aquí hay algo que mirar. Se prueba que el aviso **acompaña** a los datos en vez de sustituirlos. |
| **El mínimo del carrusel** | «Un carril con dos es un hueco con título». Probado por los dos lados del límite, que es donde se esconde un `>` puesto donde iba un `>=`. |
| **`descripcion_busqueda` nula y el texto por omisión** (`roomies`) | Apagar con la descripción vacía guarda «Busco roomie.» y no una cadena vacía: esa columna alimenta el vector de búsqueda, y un vector de nada dejaría esa ficha al final de la lista de todo el mundo para siempre. |
| **El camino CON foto** en las tres listas | El bucket es privado (§14), así que el avatar solo aparece si la URL se firmó. Los dobles devolvían un Map vacío, o sea que la mitad con foto no se ejecutaba nunca en ninguna de las tres. |

**Lo que se dejó fuera a propósito**, y por eso el umbral de ramas es 92 y no 100:

- Los guardias `if (!session?.user.id) return` — alcanzables solo sin sesión, que el guardia de §26 impide. Probarlos sería afirmar «no pasa nada».
- `Platform.OS === 'ios' ? 'padding' : undefined` y los `pressed && estilo`: presentación, no comportamiento.
- Los cuatro `e instanceof Error ? e.message : 'genérico'`. **Aquí comprobé una hipótesis mía y era falsa:** supuse que los errores de Supabase son objetos planos, con lo que el lado genérico sería el camino *real* y no el defensivo. Verificado en `node_modules`: `PostgrestError` se construye con `new PostgrestError(...)` y **sí** extiende `Error`, igual que `FunctionsHttpError`. O sea que esas ramas son defensivas de verdad y cubrirlas exigiría lanzar una cadena a mano.

**Lección para futuras anotaciones de esta cola:** «casi no tiene lógica» no es una medición, es una impresión. El 0 % de cobertura era el dato y yo lo descarté con una corazonada. Si un archivo está al 0 %, ábrase antes de decidir que no importa.

> **Dos hallazgos menores del camino:** `marcaActiva: {}` en `_layout.tsx` era un estilo vacío con cero usos — borrado. Y el doble de `expo-constants` en las pruebas nuevas necesitaba `__esModule: true`; sin esa marca el interop de Babel entrega el módulo entero en vez del default, `Constants.expoConfig` sale `undefined` y una de mis pruebas **pasaba por el motivo equivocado** (creía comprobar el aviso del `projectId` y en realidad lo provocaba el propio mock roto).

### `perfil.tsx` · los cuatro manejadores sin red

Estaban sin cubrir las líneas 80-134 y 163-164: las únicas del archivo con `try/catch` propio, o sea exactamente donde algo puede fallar. Tercer archivo de pruebas (`perfil.datos.test.tsx`, 15) junto a los dos que ya había.

**El que importaba: «Descargar mis datos».** Es el derecho de **ACCESO** de la LFPDPPP, y el aviso de privacidad de esta app lo promete por escrito (§29). Un botón que promete un derecho legal y falla en silencio es peor que no tenerlo: la persona se queda creyendo que ya tiene su copia. Se fija que entrega **lo que devuelve el servidor** —`JSON.parse` del mensaje compartido, no un `toHaveBeenCalled()` que un mensaje vacío satisfaría igual—, que un fallo se **dice**, y que el `finally` devuelve el renglón a su estado en vez de dejarlo muerto hasta reiniciar la app.

Comprobado que discrimina, con dos mutaciones: compartir un mensaje vacío tumba una prueba; tragarse el fallo del `catch` tumba dos.

**Los otros tres.** La foto sin permiso explica en vez de no hacer nada; cancelar el selector no deja error; lo que se guarda en el perfil es la **ruta del bucket** y no la `uri` local —guardar la uri dejaría una foto visible solo en el teléfono que la subió—; y un fallo al subir reactiva el botón. Guardar biografía dice su fallo. Cerrar sesión **navega** además de cerrar, porque si solo cerrara la pantalla quedaría pintada con los datos de quien ya no tiene sesión.

**Y el enlace al aviso de privacidad**, que era la línea 505: un enlace roto ahí es del mismo género que una exportación que falla callada — la promesa existe y no se puede alcanzar.

> **Una aserción mía estaba mal, no el código:** busqué el sello «Guardar biografía» sin haber escrito nada. Solo aparece si hay algo sin guardar, que es deliberado —un «Guardar» permanentemente encendido no distingue «ya está» de «te falta»—. Convertido en prueba propia.

### La fuga de Realtime · cerrada, y la orden estaba mal puesta

La orden decía «pruébalo en `chats.tsx`». **Mal ubicada:** la pantalla no se suscribe a nada — la suscripción se mudó a `useConversaciones` con END-18. Una prueba de la fuga escrita en la pantalla habría comprobado el *mock* del hook y habría pasado en verde con la fuga intacta. Es el mismo error de forma que AUD-01: la prueba mira una capa que no es la que decide.

Cubierto en los dos sitios donde sí decide:

| Dónde | Qué se fija |
|---|---|
| `services/mensajes.service` (3) | El limpiador cierra **ese** canal (`toHaveBeenCalledWith(canal)`, no `toHaveBeenCalled`); escucha los **dos** eventos —`INSERT:mensajes` y `UPDATE:conversaciones`, el segundo es el contador de no leídos— y llama a `.subscribe()`, sin el cual el canal existe y no recibe nada. |
| `hooks/queries/useChat` (7) | Al desmontar **cierra**; una sola suscripción por montaje, no una por render; sin usuario no se suscribe; al cambiar de cuenta cierra la anterior antes de abrir la nueva; y el aviso de Realtime **invalida** en vez de recargar a pelo, que es el punto de END-18. `useChat.ts` queda al **100 %**. |

Comprobado que discrimina: quitando el `return` del `useEffect` de `useChat.ts`, **dos** de las siete fallan.

### Hallazgo del arnés: `unmount()` necesita `act()`

`consultas.test.tsx` llevaba una nota que decía que la prueba del remonte tenía que ir **la última del archivo**, porque un `unmount()` a secas dejaba sin pintar todo render posterior. Diagnóstico equivocado: era el síntoma.

Medido con una sonda: en este arnés `unmount()` desmonta pero **no vacía los limpiadores de efecto**. El limpiador se queda pendiente y se vacía dentro del **siguiente `act`** del archivo —la sonda lo vio contar 2 donde debía contar 1—, y ese vaciado a destiempo es lo que rompe los renders de en medio. Con `act` alrededor del `unmount` la restricción desaparece: la prueba está ahora en segundo lugar de su archivo y las ocho pasan.

> **Queda una pregunta ya contestable, para quien toque esas pruebas:** `FormularioPublicacion` tuvo que partir sus pruebas de envío a otro archivo sin que se entendiera por qué, y aquel archivo tiene `afterEach(cleanup)` — un unmount explícito. Con la causa conocida, probablemente se puedan volver a juntar. No se intentó aquí para no mezclarlo con esto.

### Capa 4 · `components/ui` · borrado, no probado

La orden decía: «si sigue sin usarse en ninguna pantalla, **bórralo** en vez de probarlo». Comprobado: `Collapsible` tenía **cero importaciones** en todo el repositorio —ni en `src/`, ni en `scripts/`, ni en la documentación salvo esta cola—. Era el `Collapsible` de la plantilla de Expo con un find/replace de tokens del sistema encima, y conservaba los nombres en inglés (`isOpen`, `styles`, `heading`) cuando el resto del proyecto está en español (`estilos`, `abierto`): nunca se adoptó. Borrado, y con él la carpeta `src/components/ui/`.

**Dos cosas que salieron de tirar de ese hilo:**

1. **`expo-symbols` era la única dependencia que ese archivo importaba, y se quitó de `package.json`.** Pero **no desaparece del árbol**: es dependencia de `expo-router`, así que sigue instalada y el bundle no adelgaza. Lo que se gana es que `package.json` ya no declara una dependencia directa que nadie usa. Conviene no contarlo como una victoria de tamaño, porque no lo es.
2. **El umbral `global` subió de 65 a 66 sin que se probara nada.** Borrar un archivo al 0 % encoge el denominador. Está anotado en `jest.config.js` junto al número, porque un trinquete que sube al borrar código atribuye mérito donde no hubo ninguno.

**Y una corrección en `docs/endurecimiento-v6.md`:** END-37 afirmaba que Reanimated se usaba en **dos** archivos y de ahí concluía que su runtime no se amortizaba. Eran **seis**, y tres de ellos ya existían el día que escribí el hallazgo — recuento mal hecho, no dato caducado. También nombraba a Gesture Handler como equipaje gratuito cuando es dependencia de `expo-router` y no se puede quitar. La mitad del hallazgo que sí valía —la falta de tacto— estaba correctamente cerrada en `8db5ed8`.
>
> Cada una con su umbral en `jest.config.js`, justo por debajo de lo conseguido. Y **comprueba que el umbral se aplica**, subiéndolo a un valor imposible y viendo fallar el build: la ruta de `(auth)` lleva paréntesis y podría ignorarse en silencio. Se comprobó en V.5 y funciona, pero cada ruta nueva se comprueba igual.

### Verificación

```bash
cd /home/damianml/cuervo-pass && npx jest --coverage --coverageReporters=text --silent 2>/dev/null | grep -E "^ (app/publicacion/editar|components/ui|app/\(tabs\)|app/\(auth\))"
```

---

## Orden de ejecución

| | Orden | Estado |
|---|---|---|
| 1 | **V.1** · el mapa desactualizado | ✅ `3955c6e` |
| 2 | **V.3** · `.tunel-actual` sin validar | ✅ `d14f399` |
| 3 | **V.2** · el README decía 83 | ✅ `9e4e9ac` |
| 4 | **V.4** · `app/chat` al 0 % | ✅ `1928dd2` · ahora 83 % |
| 5 | **V.5** · `app/(auth)` al 9 % | ✅ `8dd8c65` · ahora 40 % |
| — | V.6 · `coverage/` en el historial | nada que hacer |
| 6 | **V.7** · la suite no cierra limpia | ✅ `2730761` · 280 s → 5.11 s · residual anotado |
| 7 | **V.8** · tres capas sin pruebas | ✅ 4 de 4 · `editar`, `(auth)`, `(tabs)` `d06141a`, `ui` borrado |

V.7 va antes que V.8 a propósito: el aviso de worker puede dejar el informe de
cobertura incompleto, y V.8 consiste precisamente en poner umbrales que se
evalúan sobre ese informe.

## Cuando termines

```bash
cd /home/damianml/cuervo-pass && npx tsc --noEmit && npx expo lint && npx jest && npx supabase test db && npm run verificar:env && (cd ai-service && .venv/bin/python -m pytest tests -q)
```

Y antes de exponer la app a alguien:

```bash
cd /home/damianml/cuervo-pass && node scripts/verificar.mjs && node --env-file=.env --env-file=.env.server scripts/prueba-rls.mjs
```


---

# Las ramas del grupo global · 64 % → 71.6 %

*Ejecutado el 26/09/2026.*

Medido antes de tocar nada: **374 ramas sin cubrir de 922** en el grupo global. Dos archivos concentraban el riesgo, y los dos estaban al **0 % en sentencias y en ramas**.

### 1 · `app/index.tsx` — el guardia de §26

Diecisiete ramas en setenta líneas: la densidad más alta del repositorio, y el archivo que **decide quién entra a la app**. Ahora 100 % de sentencias y 94 % de ramas (10 pruebas).

Tiene tres destinos —login, cuestionario, pestañas— y un cuarto estado que no es destino sino **espera**, que es el que de verdad importa: `cuestionarioCompleto` arranca en `null`, y `null` es falso. Sin el guardia `session && cuestionarioCompleto === null`, **quien ya completó el cuestionario sería mandado a repetirlo cada vez que abriera la app**. No es una pantalla fea: es perder el acceso a lo que ya hiciste.

Comprobado que la prueba discrimina: quitando ese guardia de la condición de carga, falla.

### 2 · `components/FormularioCuestionario.tsx` — 530 líneas al 0 %

Era el agujero más grande del repositorio. Ahora 96.2 % de sentencias y 93.1 % de ramas (23 pruebas).

**Y estaba al 0 % por una razón concreta, no por olvido:** la prueba de su pantalla (`(auth)/__tests__/cuestionario.test.tsx`) lo **mockea entero**. La pantalla quedaba probada y el formulario no — el reparto exactamente contrario al que conviene, porque este componente produce **todos los perfiles de la app** y lo que escribe alimenta después el filtro duro de las sugerencias, el corte de distancia y el vector semántico.

| Qué se fija | Por qué cuesta si se rompe |
|---|---|
| **`universidadCoords`** | Una universidad conocida manda sus coordenadas verificadas a mano; «Otra» manda `null`. Si una conocida mandara null, el corte de distancia se quedaría sin centro y las sugerencias saldrían mal ordenadas **sin un solo error**. Las coordenadas están curadas justamente porque geocodificar «UTVT» como texto libre devuelve lugares no relacionados. |
| **`consienteIa` sin premarcar** (§29) | Una casilla premarcada no es consentimiento. Es la clase de detalle que se «arregla» sin querer al refactorizar un `defaultValues`, y nadie lo nota: la app sigue funcionando, solo que ahora analiza con IA los textos de gente que nunca dijo que sí. También que un consentimiento **ya dado** se conserve al reabrir. |
| **Presupuesto invertido** | El filtro duro usa los dos extremos: con el máximo por debajo del mínimo ninguna publicación cabe, y sale lista vacía sin explicación. Iguales **sí** pasan: quien tiene un presupuesto exacto no se está equivocando. |
| **Distancia 1–50** | §17, es el corte real de las sugerencias. Probados los dos extremos: un 0 deja la lista vacía y un 500 la vuelve inútil. Y que los atajos de km **escriban en el campo** en vez de ser decoración. |
| **`textoLibre` vacío → `undefined`** | Una cadena vacía guardada genera un embedding **de nada**, y ese vector queda compitiendo en el ranking contra descripciones reales. |
| **El `ref` expone `enviar`** | `cuestionario-inicial` guarda desde SU botón a través del ref. Si el ref no lo expusiera, ese botón no haría nada y el único camino de alta de la app quedaría muerto. |

### Dos artefactos míos, no defectos del código

1. **Las casillas son un `Switch`, no un pulsable.** `FilaAjuste` con `valor`/`onCambiar` se acciona con `valueChange`; mi primera versión pulsaba y no se movían.
2. **`onEstadoEnvio` con un `onCompletar` que resuelve al instante no avisa nunca de «guardando»:** `setEnviando(true)` y `setEnviando(false)` caen en el mismo lote de React y el efecto solo ve el valor final. En producción hay una escritura de red en medio, así que el estado sí existe. La prueba deja la promesa **en vuelo** para reproducir ese hueco. Es el mismo aprendizaje que el `act` del `onBlur` de roomies: un doble instantáneo borra estados que en la realidad duran.

### Lo que queda en el grupo global

| Archivo | Ramas sin cubrir | Nota |
|---|---|---|
| `components/FormularioPublicacion.tsx` | 30 de 136 | Ya tiene tres archivos de pruebas; lo que falta son ramas de validación sueltas. |
| `components/ficha/DesgloseCalificacion.tsx` | 29 de 31 | Al 0 % práctico. Es el desglose de la calificación, presentación casi pura. |
| `app/publicacion/[id].tsx` | 28 de 61 | **El siguiente de verdad:** aquí vive revelar contacto, que consume cuota. |
| `app/perfil/[usuarioId].tsx` | 28 de 54 | Perfil público: lo que ve un extraño, o sea qué se filtra y qué no. |
| `lib/mapboxAutocomplete.ts` | 14 de 14 | Al 0 %. |
| `lib/geocoding.ts` | 8 de 8 | Al 0 %. Relacionado con el bloqueo de la clave de Maps. |

> **Orden para la próxima sesión:** `app/publicacion/[id].tsx`, y dentro de él **revelar contacto**. Es la única acción del producto que consume cuota y escribe una fila con índice único (AUD-11); una doble pulsación o un fallo mal tratado ahí cuesta dinero y reputación, no píxeles.
