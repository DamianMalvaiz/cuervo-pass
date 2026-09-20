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

## Orden de ejecución

| | Orden | Por qué ahí |
|---|---|---|
| 1 | **V.1** | Es el mapa. Trabajar con él desactualizado es cómo se llega aquí |
| 2 | **V.3** | Desactiva silenciosamente las dos comprobaciones previas a exponer |
| 3 | **V.2** | Media hora, y quita la causa además del síntoma |
| 4 | **V.4** | La lógica más frágil del producto, sin red |
| 5 | **V.5** | Regla nueva sin prueba de integración |
| — | V.6 | Nada que hacer |

## Cuando termines

```bash
cd /home/damianml/cuervo-pass && npx tsc --noEmit && npx expo lint && npx jest && npx supabase test db && npm run verificar:env && (cd ai-service && .venv/bin/python -m pytest tests -q)
```

Y antes de exponer la app a alguien:

```bash
cd /home/damianml/cuervo-pass && node scripts/verificar.mjs && node --env-file=.env --env-file=.env.server scripts/prueba-rls.mjs
```
