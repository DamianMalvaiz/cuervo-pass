# Auditoría · 27/09/2026

Auditoría de estado sobre `main` en `1516be7`. Todo lo de aquí está **medido**, no
recordado: cada hallazgo lleva cómo se comprobó. Lo que no pude verificar está en
la última sección, nombrado, en vez de omitido.

**Resumen: 20 hallazgos.** 4 bloqueantes para la entrega, 3 defectos o posibles
defectos de producto, 6 huecos de prueba en piezas sensibles, 7 de deuda.

---

## A · Bloqueantes para la entrega (4)

### A.1 · 86 commits existen SOLO en esta máquina

```
git rev-list --left-right --count origin/main...main   →   0   86
```

Ochenta y seis commits locales sin subir, incluidos los quince de ayer. **El único
respaldo del proyecto es este disco.** Para un trabajo con calificación, este es el
riesgo de mayor impacto de toda la lista: un fallo de disco borra semanas.

> `git push origin main`

### A.2 · El Nivel 2 (IA) está caído de punta a punta

El verificador del propio proyecto lo declara:

```
node scripts/verificar.mjs   →   9 correctos · 1 avisos · 2 fallos   (sale con 1)

[FALLO] Túnel a Cloudflare      possibility-heroes-such-healing.trycloudflare.com no responde
[FALLO] Cadena de IA (Nivel 2)  ai-proxy falló en 918 ms: non-2xx
```

Cadena de causas, comprobada eslabón por eslabón:

| Eslabón | Estado medido |
|---|---|
| Microservicio FastAPI | **caído** — nada escuchando en `:8000` |
| Túnel de Cloudflare | **muerto** — `.tunel-actual` apunta a un host que no responde |
| Secreto `AI_SERVICE_URL` | apunta a ese túnel muerto |
| `ai-proxy` | devuelve non-2xx |

**Lo que sí funciona pese a esto:** las 114 publicaciones activas ya tienen vector
(`114/114 con vector`), así que el re-ranking sigue ordenando y la app degrada a
Nivel 1 sin romperse — eso está probado. **Lo que no funciona:** generar vectores
nuevos. Todo lo que se publique o se edite mientras la cadena esté caída queda
fuera del Nivel 2, en silencio.

> `cd ai-service && source .venv/bin/activate && uvicorn main:app --port 8000` y
> luego `scripts/tunel.sh`, que ya reescribe el secreto. Volver a correr
> `node scripts/verificar.mjs` hasta 0 fallos.

### A.3 · Falta `EXPO_PUBLIC_GOOGLE_MAPS_KEY`

```
[AVISO] Clave de Google Maps    sin EXPO_PUBLIC_GOOGLE_MAPS_KEY: el mapa saldra GRIS en Android
```

El `.env` tiene tres claves (`EXPO_PUBLIC_MAPBOX_TOKEN`, `..._SUPABASE_ANON_KEY`,
`..._SUPABASE_URL`) y no esta. `app.config.js` avisa al compilar y **no** detiene
la compilación, que es la decisión correcta — pero el mapa de la ficha sale gris en
Android, sin mensaje. Es lo único de esta lista que el evaluador verá a simple
vista. **Solo el usuario puede crearla** (consola de Google Cloud, y restringirla).

### A.4 · El endurecimiento se hizo en `main`, no en su rama

```
git rev-list --left-right --count endurecimiento...main   →   0   30
```

Existe la rama `endurecimiento` y la etiqueta `pre-endurecimiento` (en `80eafef`),
creadas para este trabajo. Los treinta commits del endurecimiento fueron a `main`
directamente. No hay rama de respaldo ni etiqueta nueva, así que **no hay un punto
de retorno limpio** si algo de lo hecho resulta equivocado.

> Etiquetar el estado bueno actual (`git tag post-endurecimiento`) antes de seguir,
> y subirlo con `git push --tags`.

---

## B · Defectos y posibles defectos de producto (3)

### B.1 · ⚠️ ¿Se guarda una colonia escrita a mano? — SIN RESOLVER

**No lo doy por defecto ni por sano. Hay que comprobarlo en un teléfono.**

El desplegable de colonia ofrece «Otra (escribir)» para las que no están en el
catálogo postal. Medido con un `console.log` temporal dentro del `onSeleccionar`:

- `fireEvent.changeText` sobre el campo libre **no llega a `onSeleccionar`**: el
  registro nunca sale, el `value` sigue siendo el anterior, y al enviar se guarda
  la colonia **vieja**.
- Pero `onSeleccionar` **sí** se llama al pulsar una opción de la lista (prueba que
  pasa).
- Y `changeText` **sí** funciona sobre el buscador de otro desplegable (de eso
  dependen las pruebas del antirrebote de calle).

O el `onChangeText` del campo libre no llega en el arnés, o hay un defecto real. No
pude separarlo.

**Si es defecto, importa mucho:** el catálogo de códigos postales es incompleto, la
colonia es **obligatoria**, y quien tenga una fuera de lista **no podría publicar**
— escribiría y al guardar no se respetaría, sin entender por qué.

> **Dos minutos en el teléfono:** nueva publicación → CP válido → abrir Colonia →
> «Otra (escribir)» → teclear una colonia que no esté en la lista → guardar → mirar
> la dirección guardada. Si conserva la anterior o queda vacía, es defecto.

### B.2 · `correo_verificado` está construido y no se ve en ninguna parte

| Capa | Estado |
|---|---|
| Migración `0026_correo_verificado.sql` | existe, aplicada (local y remoto) |
| Vista `perfiles_publicos` | lo expone, derivado de `auth.users` |
| pgTAP | tiene aserción propia (`has_column`) |
| `src/types/database.types.ts` | declarado |
| **Pantallas** | **cero. Ninguna lo pinta.** |

```
grep -rn "correo_verificado" --include="*.tsx" src/   →   solo un fixture de prueba
```

Es una señal de confianza construida de punta a punta en el servidor que **nunca
llega al usuario**. O se pinta donde tiene sentido —el perfil público, que es la
pantalla que existe para dar confianza a quien no puede ir a ver— o se retira. Tal
como está es trabajo hecho y no entregado.

### B.3 · El README dice 296 pruebas; hay 567

```
README.md:191  | Frontend (jest) | 296 pruebas, …
README.md:208  y ninguna de las 296 pruebas dice si algo se VE bien.
npx jest        →   Tests: 567 passed
```

**Es el mismo defecto que V.2**, que decía 83 aserciones de pgTAP cuando eran 86 y
se corrigió en `9e4e9ac`. Aquella corrección cambió los números a mano y **no dejó
ninguna guarda**, así que la deriva volvió en otro sitio. No hay una sola prueba ni
script que vigile los números del README.

> Lo que cierra esto de verdad no es volver a corregir el número: es una prueba que
> lea el conteo real y falle si el README no coincide — como ya se hace con el
> `select plan(86)` de pgTAP. Mientras no exista, este hallazgo reaparecerá.

---

## C · Huecos de prueba en piezas sensibles (6)

No son defectos probados: son zonas donde un defecto no lo detectaría nadie.

| # | Archivo | Sentencias | Ramas | Por qué importa |
|---|---|---|---|---|
| C.1 | **`store/useAuthStore.ts`** | **13.0 %** | **0 %** | Es la frontera de seguridad de la app. Sin cubrir: `iniciarSesion`, `registrarse`, `cargarSesionInicial`, `detenerEscuchaSesion` y la guarda de idempotencia de la suscripción —la que el propio comentario llama «lo que hace que llamarla dos veces sea inofensivo»—. Las pantallas de login y registro sí están probadas, pero **la mockean**: es el cuarto caso del patrón «la prueba mira la capa que no decide». |
| C.2 | `lib/storage.ts` | 46.5 % | **11.1 %** | Firmar lotes de URLs, firmar miniaturas y borrar la foto de perfil. El bucket es privado (§14): si firmar falla mal, las fotos no cargan. |
| C.3 | `services/mensajes.service.ts` | 48.8 % | 33.3 % | Líneas 127-207. El cursor compuesto sí está probado (END-20); el resto no. |
| C.4 | `services/publicaciones.service.ts` | 70.0 % | 50.7 % | Líneas 160-166, 202-204, 256-289. |
| C.5 | `components/ficha/DesgloseCalificacion.tsx` | — | 29 de 31 ramas | Presentación casi pura. Valor bajo; se lista por completitud. |
| C.6 | `lib/geocoding.ts` y `lib/mapboxAutocomplete.ts` | **0 %** | **0 %** | 8 y 14 ramas. Atados al bloqueo A.3: probarlos sin la clave rinde poco. |

**C.1 es el único de este bloque que recomendaría atender antes de la entrega.**

---

## D · Deuda e inconsistencias (7)

| # | Hallazgo | Evidencia |
|---|---|---|
| D.1 | **Deriva de `esCodigo`**: `perfil/[usuarioId].tsx:136` compara `codigo === '23505'` a mano, mientras `publicacion/[id].tsx` usa el ayudante compartido `esCodigo(e, SQL.UNIQUE_VIOLATION)`. Las dos comparan el código y no el texto, así que **no es defecto** — es inconsistencia que hará que la próxima corrección se aplique en un sitio y no en el otro. | lectura del código |
| D.2 | **`scripts/verificar.mjs` no está en los scripts de npm.** Es el verificador pre-demo, el que acaba de encontrar A.2, y solo se puede correr escribiendo la ruta completa. Los otros tres (`verificar:env`, `:contraste`, `:toques`) sí están. | `package.json` |
| D.3 | **14 vulnerabilidades moderadas** en dependencias, de 2 avisos: `decode-uri-component` (DoS por decodificación exponencial) y `uuid <11.1.1` (falta comprobación de límites de búfer). Todas **transitivas** del andamiaje de compilación de Expo (`@expo/config-plugins`, `@expo/prebuild-config`, `expo-splash-screen`), no del código de la app. Ninguna alta ni crítica. | `npm audit --omit=dev` |
| D.4 | **2 avisos de lint preexistentes**, los dos el mismo: `watch()` de React Hook Form no se puede memoizar (`registro.tsx:94`, `FormularioCuestionario.tsx:127`). 0 errores. | `npx expo lint` |
| D.5 | **Supabase CLI desactualizado**: 2.117.0 instalado, 2.118.0 disponible. | salida del CLI |
| D.6 | **`DESIGN.md` pendiente de reescritura (D.12)**, ya documentado en `endurecimiento-v6.md:650`. Describe el sistema visual que «La Ficha» reemplazó. | el propio doc |
| D.7 | **Servicios locales de Supabase parcialmente detenidos**: `imgproxy`, `edge_runtime` y `pooler`. La base sí responde (pgTAP pasa), pero probar Edge Functions en local no funcionaría ahora. | `supabase status` |

---

## E · Lo que está sano (para que la lista de arriba se lea en su proporción)

| Comprobación | Resultado |
|---|---|
| `npx tsc --noEmit` | **0 errores** |
| `npx jest` | **63 suites, 567 pruebas, todas pasan** en 10 s |
| `npx supabase test db` (pgTAP) | **86 aserciones, PASS** |
| `pytest` (microservicio) | **20 pruebas, PASS** |
| Deriva de migraciones local ↔ remoto | **ninguna**: 39 = 39 |
| Edge Functions | **4 despegadas y ACTIVE**; `ai-proxy`, `geocodificar` y `eliminar-cuenta` con `verify_jwt: true`; `barrer-fotos` con `false` a propósito (usa `CRON_SECRET`) |
| Secretos de Edge Functions | 11 configurados, incluidos los 2 obligatorios |
| Secretos en el historial de git | **ninguno**. Solo nombres de variables y plantillas. `.env`, `.env.server` y `ai-service/.env` ignorados; `.env.server` **nunca** fue rastreado |
| `verificar-env` | reparto correcto en 4 archivos |
| Contraste de color | todos los pares declarados cumplen su mínimo |
| Objetivos táctiles | ninguno por debajo de 44 pt |
| Deuda marcada en código | **cero** `TODO`, `FIXME`, `HACK`, `@ts-ignore` ni `eslint-disable` fuera de pruebas |
| Pruebas saltadas | **ninguna** (`.skip`, `.only`, `.todo`, `xit`) |
| Residual de V.7 (aviso de worker) | **no reproducible** en 3 corridas seguidas. Antes aparecía 1 de cada 5; lo dejo como «no reproducido», no como cerrado |
| Datos de demo | 114 activas con vector y con foto, 3 tipos repartidos, cola de fotos huérfanas vacía, geocodificación en rango |

---

## F · Lo que NO pude verificar

Esto no es una lista de cosas sanas. Es lo que queda fuera del alcance de esta
auditoría, dicho para que nadie lo lea como aprobado.

1. **Nada en un dispositivo real.** B.1 (la colonia a mano), A.3 (el mapa gris), el
   tacto del sello y cualquier cosa de aspecto solo se resuelven en un teléfono.
2. **Si la tarea programada del barrido llama a alguien.** La migración `0025`
   ejecuta `cron.schedule('barrer-fotos', '7 * * * *', …)` sin condición y está
   aplicada, así que la tarea existe. Pero la función `barrer_fotos_programado()`
   lee **dos secretos de Vault** (`barrer_fotos_url` y `cron_secret`) que se crean
   **a mano**, y si faltan, la función avisa y **no llama a nadie**: un barrido que
   se cree programado y no lo esté. No pude consultar el Vault remoto (sin `psql` y
   sin credenciales de base en este entorno). **Hay que comprobarlo.**
3. **Las 100 cuentas sembradas y la regla de correo.** Las cuentas de demo usan
   `@cuervopass-demo.test` y la regla exige `.edu.mx`, así que **no podrían
   registrarse por la app**: se sembraron con `email_confirm: true` por el lado del
   servidor. Eso es coherente para poblar la demo, pero conviene decidir a
   conciencia si el guion de la demo toca ese punto.
4. **Aislamiento entre cuentas en el proyecto remoto.** `scripts/prueba-rls.mjs`
   existe y no lo corrí en esta auditoría; el aislamiento en local sí está cubierto
   por las 86 aserciones de pgTAP.
5. **Rendimiento y comportamiento con datos reales a escala.** 114 publicaciones es
   el tamaño de la demo, no una prueba de carga.

---

## Orden sugerido

1. **A.1** — `git push`. Dos segundos, y es el mayor riesgo de la lista.
2. **A.4** — etiquetar el estado bueno antes de seguir tocando.
3. **A.2** — levantar microservicio y túnel; `verificar.mjs` hasta 0 fallos.
4. **B.1** — dos minutos en el teléfono. Si es defecto, arreglarlo antes de todo lo demás.
5. **A.3** — la clave de Maps.
6. **F.2** — comprobar los secretos de Vault del barrido.
7. **B.2** y **B.3** — decidir: pintar o retirar `correo_verificado`; y una guarda para los números del README.
8. **C.1** — pruebas de `useAuthStore`.

Lo demás (C.2–C.6, D.1–D.7) no bloquea la entrega.
