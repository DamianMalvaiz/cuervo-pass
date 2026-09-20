# Cuervo Pass

**Documento de endurecimiento v6** — auditoría de la implementación, registro de remediación y plan de trabajo pendiente
Proyecto integrador · App de departamentos y roomies universitarios
Revisión: 19 de septiembre de 2026 · Complementa al **documento maestro v5**, no lo sustituye

---

## 0. Informe de auditoría

### 0.1 Alcance y método

Se auditó **el código que existe**, no el documento que lo describe: esquema y policies aplicados, Edge Functions desplegadas, microservicio, capa de servicios del cliente, pantallas, sistema visual, integración continua y procedimientos de operación.

La diferencia de método frente a v5 es la que da valor a este documento y conviene subrayarla. §0.1 de v5 dice:

> «El método fue revisión de diseño y de código sobre el artefacto escrito; **no se ejecutó el sistema**, porque el sistema todavía no existe. […] Antes de dar por buena cualquier remediación, ejecútala.»

Aquí sí se ejecutó. Todo hallazgo marcado como **verificado** se reprodujo contra un sistema corriendo, y toda remediación se comprobó con una prueba que **falló antes del arreglo**. Donde no se pudo ejecutar, se dice.

Escala de severidad, la misma de v5:

| Nivel | Criterio |
|---|---|
| **Crítico** | El sistema no cumple su función principal, o expone datos de usuarios a terceros |
| **Alto** | Falla probable en producción o en la demo, exposición limitada, o costo no acotado |
| **Medio** | Deuda que degrada operación, mantenibilidad o evidencia; no impide entregar |
| **Bajo** | Pulido, consistencia, higiene |

Los hallazgos llevan el prefijo **END-** y no **AUD-** a propósito: los AUD-NN de v5 ya están citados por decenas de comentarios del código y reusar la numeración haría ambiguo cada uno de ellos.

### 0.2 Dictamen

v5 corrigió los veintiocho hallazgos de v4 y la implementación arrastra **defectos propios de la misma familia**. El patrón es uno solo y se repite:

> **La documentación describe un sistema distinto al construido.**

No por descuido en la prosa: la prosa es excelente. Por una asimetría de esfuerzo entre afirmar y verificar. `DESIGN.md` tiene 27 KB; la capa de servicios tenía **0 % de cobertura de pruebas**. Se midieron doce pares de contraste de texto a mano y **ninguna superficie contra superficie** —la que falla—. Se escribieron tres párrafos justificando `hmac.compare_digest` contra ataques de temporización mientras el guardia de al lado **fallaba abierto**.

Los tres hallazgos críticos comparten forma con AUD-01, el hallazgo estrella de v5: **dos decisiones correctas por separado que se contradicen al correr juntas**, produciendo un fallo silencioso.

1. **END-01** — la migración titulada «storage privado» cambió «cualquiera en internet» por «cualquiera con una cuenta», y el registro era abierto.
2. **END-02** — el microservicio que guarda `ANTHROPIC_API_KEY`, expuesto por un túnel público, **no autenticaba a nadie** en su ruta de arranque documentada.
3. **END-03** — el botón «Reportar usuario» insertaba la fila, mostraba un acuse y **el trigger salía sin hacer nada**. En la ruta de seguridad personal, en un producto donde alguien de dieciocho años queda con un desconocido.

El cuarto, **END-08**, no se ha remediado y es el de mayor impacto en lo que el evaluador va a ver: **el motor esconde publicaciones válidas sin decirlo**. Es AUD-01 reintroducido una capa más arriba.

### 0.3 Hallazgos remediados

#### Críticos

**END-01 · Cualquier cuenta leía cualquier foto del bucket** · `§14` · verificado contra producción

La migración `0016_v5_storage_privado.sql` se titula «storage privado» y su encabezado acusa a v3 de que «cualquiera en internet que adivinara el patrón `perfiles/<uuid>.jpg` leía las fotos sin sesión». Lo que dejó escrito fue:

```sql
create policy "leer fotos con sesion" on storage.objects
  for select to authenticated using (bucket_id = 'fotos');
```

Sin restricción de ruta. Eso no cerró el agujero: cambió «cualquiera en internet» por **«cualquiera con una cuenta»**, y con `enable_confirmations = false` esas dos poblaciones se separaban por treinta segundos de trámite.

Las URLs firmadas no protegían: **firmar no es autorizar**. Quien tiene sesión pide la firma él mismo con `createSignedUrl`, o descarga directo.

Quedaba expuesto: la foto de perfil de un usuario desactivado, las fotos de una publicación oculta por reportes o desactivada por su dueño, y —hasta que alguien corriera el barredor a mano— las de una publicación **ya borrada**, que su dueño creía eliminada.

*Evidencia.* Dos cuentas recién creadas contra producción, por HTTP:

```
[  EXPUESTO ] A no lee la foto de una publicación DESACTIVADA de B
              SE DESCARGÓ — la lectura del bucket no filtra por visibilidad
[  EXPUESTO ] A no lee la foto de perfil de una cuenta DESACTIVADA
              SE DESCARGÓ — un usuario dado de baja sigue expuesto
```

> **Remediación:** `0022_storage_lectura_acotada.sql`. La visibilidad del objeto **se deriva** de la visibilidad de la fila que lo referencia, consultando `perfiles_publicos` y `publicaciones_publicas`, en vez de reescribir el criterio. Si mañana una vista cambia su filtro, las policies lo heredan. El dueño conserva acceso siempre. Las vistas y no las tablas, a propósito: un `exists` contra `publicaciones` se evaluaría como `authenticated` y ocultaría las fotos de todo el mundo — AUD-01 otra vez, esta vez en Storage.
>
> **Verificación:** aserciones 22 a 25 de `supabase/tests/rls.test.sql`, escritas antes de la migración y confirmadas en rojo con `have: 1, want: 0`. Más barreras 16 a 19 de `scripts/prueba-rls.mjs`, contra producción y por HTTP.

**END-02 · El microservicio de IA fallaba ABIERTO** · `§22`, `§24` · verificado en ejecución

El guardia de `identidad()` en `ai-service/main.py` era:

```python
if config.AI_SHARED_TOKEN and not _token_valido(authorization):
    raise HTTPException(status_code=401)
```

Con la variable ausente o vacía, la condición entera es falsa y **no se autentica a nadie**. No era hipotético: era el estado **por omisión** de la ruta de arranque que documenta el README (`uvicorn main:app --reload`), porque `config.py` leía con `os.getenv` pelado y nada cargaba `ai-service/.env`.

Había **tres rutas de arranque y cada una leía un sitio distinto**:

| Ruta | Qué leía |
|---|---|
| `scripts/tunel.sh:42` | el `.env` de la **raíz**, con `set -a && . ../.env` |
| `docker compose up` | `ai-service/.env`, vía `env_file` |
| `uvicorn main:app --reload` (README) | **nada** |

Agravante: `/metricas` no tenía autenticación ninguna y publicaba conteos y latencias internas a cualquiera con la URL del túnel. Y sin `x-usuario-id` el limitador devolvía `"anonimo"` y seguía, degradando la cubeta por usuario a una cubeta global — el defecto que AUD-03 existía para cerrar.

*Evidencia.* `/metricas` respondió **200** con telemetría completa a una petición sin credenciales por el túnel público, con el servicio llevando trece horas en marcha.

> **Remediación:** el ciclo de vida lanza `RuntimeError` si falta `AI_SHARED_TOKEN` — un servicio que no puede autenticar no debe servir. `identidad()` pierde el guardia condicional. Nuevo `exigir_token()` para rutas que no actúan en nombre de nadie. `/metricas` detrás del token. Sin `x-usuario-id` se devuelve 400. `config.py` carga `ai-service/.env` con `python-dotenv` y `override=False`, unificando las tres rutas.
>
> **Verificación:** `ai-service/tests/test_endpoints.py`, de 9 a 16 pruebas. Y un dato que vale más que las pruebas nuevas: al exigir token, **cuatro pruebas existentes se rompieron**. `test_embedding_dimension` llamaba sin cabecera de autorización y esperaba 200. La suite pasaba *gracias* al fallo.

**END-03 · Reportar a una persona no hacía absolutamente nada** · `§13` · verificado en local

`reportarUsuario()` existe en `src/services/usuarios.service.ts`, `src/app/perfil/[usuarioId].tsx:91` lo llama, la fila se inserta en `reportes`, y la app responde «Gracias». Y `al_reportar()` empezaba así:

```sql
if new.publicacion_id is null then
  return new;
end if;
```

Sale sin tocar nada. Nunca. Para nadie.

Es **AUD-16 reproducido** —que la propia `0013` documenta como «un valor muerto, que es la clase de detalle que delata que el esquema y la lógica se escribieron por separado»— en la ruta de seguridad personal. Un botón de seguridad que miente es peor que no tenerlo: produce la sensación de protección sin la protección.

> **Remediación:** `0023_reportes_de_usuario.sql`. A los tres reportes de cuentas distintas: `suspendido = true`, `activo = false`, notificación al reportado, sus roomies a `pausado` y sus publicaciones a `activa = false`. `activo = false` es lo que hace el trabajo: toda la visibilidad del producto cuelga de `perfiles_publicos`.
>
> `trg_suspension_inmutable` impide que el suspendido se quite la suspensión: `usuarios_update_propio` permite el UPDATE y una policy limita **filas, no columnas** — mismo motivo por el que `0012` usa un trigger para la inmutabilidad de los mensajes.
>
> **Verificación:** aserciones 26 a 31, confirmadas en rojo con `column "suspendido" does not exist`.

#### Altos

**END-04 · La separación de secretos era un párrafo, no un mecanismo** · `§34`

`.env.example` lleva desde v3 diciendo que mezclar cliente y servidor en un solo archivo «es el defecto más peligroso que tenía», y el proyecto lo estaba haciendo igual: `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, `AI_SHARED_TOKEN` y `PERFIL_ENCRYPTION_KEY` vivían en el `.env` de la raíz, que el README declara «del cliente».

Además había **dos credenciales muertas** que nadie lee (`git grep`, cero resultados en `src/`, `scripts/`, `ai-service/` y `supabase/functions/`): `PERFIL_ENCRYPTION_KEY` —cuyo cifrado retiró §30— y `MAPBOX_ACCESS_TOKEN`. Una credencial que nadie usa sigue siendo una credencial que se puede filtrar.

> **Remediación:** tres archivos con tres destinos (`.env`, `.env.server`, `ai-service/.env`), las dos muertas borradas, y `scripts/verificar-env.mjs` como compuerta en CI. Más un job de `gitleaks`: Trivy escaneaba la imagen de Docker y **nadie miraba el árbol**, en un proyecto cuyo tema central son las credenciales.
>
> **Verificación:** `npm run verificar:env`. Comprobado que detecta en las **dos** direcciones, no solo que pasa en verde.

**END-05 · El borrado de fotos dependía de que alguien corriera un script** · `§29`, `AUD-10`

`0021` fue honesta sobre lo que dejaba abierto: «encolar no borra. Si nadie vacía esta tabla, los archivos siguen ahí. Se cambia un fallo ruidoso por una **deuda visible**.»

No era una deuda visible. Quien vaciaba la cola era un script **manual**, así que el derecho de cancelación que promete el aviso de privacidad dependía de que alguien se acordara. Encadenado con END-01: el usuario borra, la app dice que borró, el archivo sigue en el bucket, y cualquiera podía leerlo. **Tres decisiones defendidas una por una que, compuestas, reproducían el fallo que cada una decía corregir.**

> **Remediación:** Edge Function `barrer-fotos` + `0025_barrido_programado.sql` con `pg_cron` cada hora. Credenciales desde Vault, no desde la migración: una migración vive en git. `verificar.mjs` pasa la cola de **aviso a fallo** cuando hay filas de más de dos horas — con barrido automático, filas viejas ya no son deuda, son prueba de que el barrido no corre.
>
> **Verificación:** aserción 37, y `select ... from cron.job` tras `db reset` devuelve `barrer-fotos · 7 * * * * · activa=true`.

**END-06 · `roomies` era la tercera tabla y estaba abierta** · `§13`

El README afirma que «las tablas están **cerradas**» y que las vistas «deliberadamente no incluyen presupuesto, universidad, vector de perfil ni teléfono». No era cierto para `roomies`: `select * from roomies` bajaba todas las columnas de toda fila activa. Se hizo la cirugía de vistas en `usuarios` y en `publicaciones` y **se saltó la tercera**.

Lo grave es `vector_busqueda`: 384 flotantes derivados del texto libre de esa persona, del que existe literatura de inversión. Es exactamente la columna que `perfiles_publicos` excluye a propósito en `usuarios`, expuesta sin barrera en la tabla de al lado.

*Rectificación registrada.* En la primera lectura se agrupó `presupuesto_aportacion` con `usuarios.presupuesto_max` como dato filtrado. No son lo mismo: el segundo es lo que puedes pagar, privado; el primero es lo que **ofreces** en un anuncio que publicaste para que te contacten. Se queda expuesto, y queda escrito por qué.

> **Remediación:** `0024_roomies_publicos.sql`. Vista con lista blanca, tabla cerrada a la fila propia, y `sugerencias_roomies` a `security definer` porque necesita leer una columna que su llamador no puede leer. §17 de v5 rechazó `security definer` para publicaciones con un argumento correcto; se sostiene aquí porque **la auditoría está en la firma de retorno**, y la aserción 36 afirma sobre ella.
>
> **Verificación:** aserciones 32 a 36. La 35 es la que importa: cerrar la tabla sin tocar la función la dejaría en cero filas, sin error y sin log.

**END-07 · Registro sin coste y sin señal de confianza** · `§12`

`enable_confirmations = false`. Combinado con el ocultamiento automático a los tres reportes, **tres cuentas desechables creadas en dos minutos tumbaban a cualquiera**. El umbral de tres no era el problema: lo era que una cuenta no costara nada.

Y del otro lado: `PRODUCT.md` dice que el usuario primario decide *sight-unseen*, desde otra ciudad. Toda la confianza descansa en foto, biografía y reportes —las tres escritas por la misma persona de la que hay que fiarse— y la señal más barata y fuerte que existe, «esta persona tiene correo de una universidad», estaba sin usar.

> **Remediación:** `enable_confirmations = true`, filtro de dominio institucional en `src/lib/correoUniversitario.ts`, e insignia `correo_verificado` en `perfiles_publicos` (`0026`), **derivada** de `auth.users` en la consulta y no copiada a una columna: una insignia de confianza desincronizada es peor que no tenerla.
>
> **Verificación:** seis pruebas unitarias, cuatro de ellas sobre trampas que un `endsWith` ingenuo acepta (`ana@edu.mx.atacante.com`). Aserciones 38 a 40.

### 0.4 Hallazgos abiertos

#### Críticos

**END-08 · El motor esconde publicaciones válidas sin decirlo** · `§18` · verificado por lectura, no ejecutado

`sugerencias_con_ranking` (`0015:149`) descarta toda publicación sin embedding:

```sql
where yo.perfil_vector is not null
  and c.vector_embedding is not null
```

Y `obtenerSugerencias` (`src/services/publicaciones.service.ts:60`) devuelve Nivel 2 si hay **una sola** fila:

```ts
if (!conIA.error && conIA.data?.length) return { datos: conIA.data, nivel: 2 };
```

De veinte publicaciones viables con tres vectorizadas, el usuario ve **tres** y cree que ese es el catálogo. Las otras diecisiete pasan el filtro duro perfectamente.

Es **AUD-01 otra vez**, una capa más arriba: lista incompleta, sin error, sin log, sin pista. La degradación es todo-o-nada en la granularidad equivocada.

> **Remediación:** una sola consulta con `left join` a la similitud y `coalesce` a `c.score` cuando falte. `nivel` pasa a ser **columna por fila**, no bandera global. El kicker de la pantalla deja de ser binario y dice `12 DE 20 CON AFINIDAD SEMÁNTICA` — que además es mejor demo, porque el número prueba que el motor corre y cuánto alcanza.

#### Altos

**END-09 · El score de mascotas hace lo contrario de su comentario** · `§17`

`0015:72`:

```sql
case when p.permite_mascotas = yo.mascotas then 0.5 else 0 end
```

Sin mascota + departamento que las acepta → `true ≠ false` → **0 puntos**. Se penalizan los alojamientos *pet friendly* a quien no tiene mascota. Treinta líneas más abajo el comentario afirma lo contrario: «si no tienes, uno que las permite no te estorba. Asimetría deliberada.» El comentario describe el filtro duro; el score suave hace lo opuesto.

> **Remediación:** `case when yo.mascotas then (case when p.permite_mascotas then 0.5 else 0 end) else 0.5 end`, y corregir el comentario. Prueba: usuario sin mascota, dos publicaciones idénticas salvo `permite_mascotas` → **mismo score**. Hoy difieren en 0.125.

**END-10 · El mapa sale gris en Android y iOS no compila** · `§14`

`src/app/publicacion/[id].tsx:285` usa `MapView`. En `app.json` no hay `android.config.googleMaps.apiKey` ni `ios.bundleIdentifier`.

> **Remediación:** añadir ambos, más `runtimeVersion` y `updates.url` para tener ruta de reversión OTA antes de la demo. `npx expo-doctor` reporta además ocho paquetes desalineados con el SDK 57.

**END-11 · Un error de red se presenta como dato borrado** · `§27`

Dos sitios, mismo defecto:

- `src/app/publicacion/[id].tsx:77` — `.catch(console.warn)` deja `publicacion` en `null` y la pantalla dice **«FICHA NO DISPONIBLE — pudo desactivarse u ocultarse tras varios reportes»**. Se cayó el wifi y la app afirma que la publicación fue reportada.
- `src/store/usePerfilStore.ts:27` — `set({ perfil: error ? null : data })`. Al fallar, `ResumenFiltros` pinta **«Sin presupuesto · Sin distancia · Sin universidad»**: un fallo de lectura presentado como pérdida de datos.

> **Remediación:** tipo `Resultado<T>` con tres estados (`ok` / `vacio` / `error`). Prohibido que un `catch` produzca `vacio`. En el store, conservar el último valor conocido y marcar el error aparte.

**END-12 · Sin red de seguridad en tiempo de ejecución** · `§27`

No hay `ErrorBoundary` ni reporte de crashes. El principio #1 declarado en `PRODUCT.md` es *«Reliability over features»*. Un error de render en release es **pantalla blanca**, sin traza, en vivo. Los 24 `console.warn` de `src/` desaparecen en producción.

> **Remediación:** exportar `ErrorBoundary` desde `src/app/_layout.tsx` (expo-router lo reconoce por nombre) más Sentry con `beforeSend` que elimine `perfil_texto`, `whatsapp`, `descripcion_busqueda` y correos — §29 exige minimización y un reporte de crash es donde más se filtra. Diez líneas eliminan la pantalla blanca.

**END-13 · La cuota se cobra cuando no se entrega** · `§24`, `AUD-04`

Dos casos:

- `revelar_contacto` consume cuota **antes** del `on conflict do nothing`. Reabrir cinco publicaciones cinco veces agota las 25 diarias por usar la app con normalidad.
- `ai-proxy:68` consume cuota y luego el `fetch` falla con 503. Con el túnel muerto, treinta reintentos agotan el día **sin una sola llamada al modelo**.

> **Remediación:** en `revelar_contacto`, devolver el teléfono sin consumir si el contacto ya existe. En `ai-proxy`, `devolver_cuota()` en el `catch` y cuando el microservicio responda 5xx.

**END-14 · `ai-proxy` reenvía el cuerpo ajeno sin filtrar y no maneja CORS** · `§24`

`ai-proxy:90` hace `new Response(await r.text(), { status: r.status })`. Se sanitizan con cuidado los errores propios —el comentario de `motivo` es ejemplar— y se deja pasar un traceback de FastAPI entero. Y `req.method !== 'POST'` → 405, así que **no hay manejo de `OPTIONS`**: con `react-native-web` en dependencias y script `web` en `package.json`, el preflight falla.

**END-15 · La cola de geocodificación no existe** · `§9`, `AUD-02`

El encabezado de `supabase/functions/geocodificar/index.ts:13` afirma que se geocodifica «desde el SERVIDOR, **en cola**, nunca desde el cliente», como una de las tres obligaciones de la licencia ODbL. **No hay cola ni límite de ritmo**, solo caché. La serialización vive en el cliente (`publicaciones.service.ts:243`), donde no se puede garantizar. Es además la única Edge Function sin `consumir_cuota`.

**END-16 · La lista de chats es el anti-patrón que su propio encabezado condena** · `§15`

`mensajes.service.ts:107` trae **1200 mensajes** (`limite * PAGINA_MENSAJES`) para resolver 30 hilos, plegándolos en JavaScript. El encabezado del archivo acusa a v3 de «traerse TODOS los mensajes y agruparlos en JavaScript». Y tiene dos defectos visibles: el orden es `creado_en desc` **global**, así que un chat activo se come la ventana y un hilo tranquilo aparece **sin último mensaje**; y el contador de no leídos se trunca en silencio.

Relacionado: `listarMensajes` pagina con `.lt('creado_en', cursor)`, así que dos mensajes con el mismo timestamp hacen que uno **desaparezca** al paginar.

#### Medios

**END-17 · Los chips de tipo mienten** · `§17` — `inicio.tsx:188` filtra por tipo **en el cliente** sobre el top-30 del servidor. Si en esos 30 no hay cuartos, la app dice «SIN REGISTROS DE ESE TIPO» con cincuenta cuartos disponibles. Toda la arquitectura mueve el filtrado a Postgres y el último filtro que el usuario toca vive en el teléfono.

**END-18 · Sin capa de datos** — `useState` + `useFocusEffect(cargar)`. Cada regreso del detalle reconsulta el motor completo: sin caché, sin deduplicación, sin reintento, sin backoff, sin offline, y el arreglo se reemplaza entero (parpadeo y pérdida de scroll).

**END-19 · Fugas de memoria y suscripciones duplicadas** — `useChatStore` nunca desaloja conversaciones; `useAuthStore.cargarSesionInicial` registra `onAuthStateChange` sin guardar ni cancelar la suscripción; `agregarMensaje` hace un `.sort()` completo por cada mensaje entrante.

**END-20 · El chat no es optimista** — `chat/[conversacionId].tsx:135` espera el viaje de ida y vuelta antes de pintar. Y `cargarAnteriores` **no tiene `catch`**: una página que falla no muestra nada y el usuario cree que no hay más historial.

**END-21 · La calificación viaja por la URL** — `inicio.tsx:207` pasa `score`, `base` y `sim` como parámetros de ruta. Un deep link a una ficha no tiene score, así que el desglose desaparece: la tesis del producto es opcional según por dónde entres. Peor: ese valor se escribe en `contactos.score_mostrado`, así que **la métrica que se presenta es un dato suministrado por el cliente**.

**END-22 · Cobertura donde no sirve** — 98 pruebas en verde y `src/services` al 0 %, `src/store` al 0 %, `app/chat` al 0 %, `app/publicacion` al 0 %, `app/(auth)` al 9 %. `obtenerSugerencias` —donde vive END-08— no tiene ninguna. *(Mejora parcial: `src/lib` subió con las pruebas de correo universitario.)*

**END-23 · La suite es inestable** — en cuatro corridas, una falló tres pruebas de `pantallas.humo.test.tsx:89` bajo la carga de instrumentación de cobertura. Los runners de CI son más lentos que la laptop. Una compuerta que falla al azar se acaba apagando — lo dice el propio comentario de Trivy en `ci.yml`.

**END-24 · URLs firmadas que caducan sin refirmar** — una hora (`storage.ts:15`), firmadas una vez al montar. App abierta más de una hora: todas las fotos en 403, para siempre.

**END-25 · Fallo mudo de Storage** — `firmarRutas` devuelve un `Map` vacío al fallar (`storage.ts:74`). Una caída de Storage deja la app sin fotos y **sin un solo aviso**, contra lo que §27 exige.

#### Bajos

**END-26 · API deprecada** — `ImageManipulator.manipulateAsync` está marcada `@deprecated` en la versión instalada.

**END-27 · Detección de errores por subcadena** — `publicacion/[id].tsx:101` usa `mensaje.includes('duplicate')`. Depende del texto de error de Postgres, que cambia por versión y locale. Lo correcto es `error.code === '23505'`.

**END-28 · Payload innecesario** — `sugerencias_publicaciones` devuelve `vector_embedding vector(384)` al teléfono. Con `limite=30` son ~250 KB de JSON por refresco de un valor que el cliente nunca usa.

### 0.5 Hallazgos de diseño

**END-29 · El bloque destacado es invisible** · **Alto** · medido

Los contrastes de **texto** declarados en `src/constants/theme.ts` son correctos: 16.86, 6.53, 5.46, 8.80, 3.40/3.53, todos verificados. Y ahí se acabó el rigor, porque nunca se midió **superficie contra superficie**:

| Par | Razón |
|---|---|
| `tintedSurface` vs `background` (claro) | **1.00** |
| `backgroundElement` vs `background` (claro) | 1.12 |
| `tintedBorder` vs `tintedSurface` (claro) | 1.35 |
| `tintedSurface` vs `background` (oscuro) | 1.12 |

**1.00.** El «lavado del sello» —que el sistema define como *«el bloque que la hoja quiere destacar»*— tiene **exactamente la misma luminancia que el papel**. Es un cambio de matiz con cero cambio de valor: desaparece bajo sol, con reflejo, en escala de grises y para un daltónico. El encabezado del archivo afirma que «todos los contrastes de este archivo están medidos, no supuestos». Se midió lo que se sabía medir.

> **Remediación:** `scripts/verificar-contraste.mjs` que cubra texto (≥4.5), bordes de control (≥3.0) **y superficie contra superficie** (≥1.2 de razón, o borde ≥3.0), en CI. Corregir el valor manteniendo el matiz.

**END-30 · «AFINIDAD 9.4» afirma más de lo que el motor calcula** · **Alto**

Se toma `0.6 × score + 0.4 × similitud` —mezcla ponderada de cuatro heurísticas normalizadas a mano—, se multiplica por 10, se le pone **un decimal** y se renderiza en `Archivo_900Black` a **56 px**, el elemento más grande de la pantalla, dentro de una casilla que imita un **kardex universitario**.

Tres problemas apilados:

1. **Precisión fabricada.** Ese número no tiene un decimal de resolución. 8.7 y 8.6 son ruido entre sí.
2. **Significado falso.** Por el término de presupuesto (`0015:69`), lo más barato siempre gana. Un «9.4» no significa «excelente departamento»: significa **barato y cerca**.
3. **Autoridad prestada.** Una calificación de kardex es un número ganado y auditable. La metáfora no decora el dato: **le presta credibilidad que no tiene**, a alguien que está eligiendo dónde va a vivir sin haber visto el lugar.

> **Remediación:** redondear a medios puntos, renombrar a «AJUSTE», y **mostrar el desglose en la tarjeta** — `1.2 km · $500 bajo tu tope · afinidad 0.87`. Un motor que explica su recomendación se defiende solo.

**END-31 · Dos implementaciones divergentes de la pieza central** · **Medio** — `FichaCompacta.tsx:108` reimplementa la calificación a mano (`fontFamily`, `fontSize: 18`, casilla propia) en vez de usar `Calificacion`, y **sin la etiqueta**: el número flota sin decir qué es. `fontSize:`/`fontFamily:` aparecen **61 veces** en `src/components` y `src/app`; 32 son excepciones legítimas (`themed-text.tsx` define la escala, los dos `_layout.tsx` alimentan React Navigation) y **29 en 19 archivos son deuda**.

**END-32 · La pantalla de inicio renderiza el mismo contenido hasta cuatro veces** · **Medio** — `inicio.tsx:198`: el carrusel «Mejor afinidad» es `filtradas.slice(0, 8)`, un **prefijo literal** de la lista que está 24 tarjetas más abajo; los otros dos son reordenamientos del mismo conjunto. No es arquitectura de información: es indecisión renderizada.

**END-33 · La densidad contradice el posicionamiento** · **Medio** — `FichaPublicacion` mide ~420–450 px: **una tarjeta y media por pantalla**. `PRODUCT.md` dice «Airbnb ordena por deseo […] esto ordena por **ajuste**». El ajuste se evalúa comparando, y comparar exige ver varias opciones a la vez.

**END-34 · El escalado de fuente prometido está roto** · **Medio** — `PRODUCT.md` compromete respetar el escalado del sistema. **Cero usos** de `maxFontSizeMultiplier` o `allowFontScaling`, y todos los `lineHeight` en px fijos. Al 200 %, `cifraLista: { fontSize: 40, lineHeight: 44 }` con `numberOfLines={1}` recorta, y `adjustsFontSizeToFit` **invierte la jerarquía**.

**END-35 · Objetivos táctiles bajo el propio estándar** · **Medio** — el estándar declarado es 44×44. Sin `hitSlop`: `perfil.tsx:475` (30), `perfil.tsx:494` (32), `FormularioPublicacion.tsx:846` (36), `FormularioCuestionario.tsx:509` (38), `inicio.tsx:387` (40).

**END-36 · Sistema responsive sin aplicar donde importa** · **Medio** — `useTamanoPantalla` está en 8 pantallas de formularios y auth, y **en ninguna** de `inicio`, `publicaciones`, `roomies`, `chats`, `chat/[id]` ni `publicacion/[id]`. `MaxContentWidth = 800` tiene **cero usos** en todo el código: un token muerto en el corazón del sistema.

**END-37 · Sin movimiento y sin tacto** · **Bajo** — Reanimated, Worklets y Gesture Handler instalados y usados en **dos** archivos (`components/ui/collapsible.tsx` y `app/perfil/[usuarioId].tsx`). Un tercero —`ficha/DesgloseCalificacion.tsx`— anima con `LayoutAnimation`, que es de React Native y no de Reanimated. O sea: se carga el runtime completo de Reanimated para un acordeón y una pantalla de perfil. `expo-haptics` **no está instalado**: un mundo cuya pieza central se llama «sello» y no vibra al estampar. El único feedback de pulsación en toda la app es `opacity: 0.7`, el valor por defecto de React Native.

**END-38 · Catorce spinners, cero esqueletos** · **Bajo** — `ActivityIndicator` en 14 archivos. El esqueleto se escribe solo en este mundo: dibujar la ficha vacía con sus etiquetas y llenar los valores al llegar. Está inventado y sin construir.

### 0.6 Orden de remediación

Por riesgo y por costo de arreglarlo tarde, no por comodidad.

| Prioridad | Hallazgos | Cuándo |
|---|---|---|
| **0** | END-01 a END-07 | **Hecho.** Falta aplicarlo a producción (§2) |
| 1 | END-08, END-09 | Antes de enseñar el motor a nadie: es lo que el evaluador mira |
| 2 | END-10, END-12 | Antes de cualquier demo: sin esto, un fallo es pantalla gris o pantalla blanca |
| 3 | END-11, END-13, END-14, END-15 | Fiabilidad y coste; semana siguiente |
| 4 | END-16, END-19, END-20, END-21, END-22, END-23 | Chat, estado y pruebas |
| 5 | END-29, END-30, END-31 | Diseño: lo medible y lo que afirma de más |
| 6 | END-17, END-18, END-24, END-25, END-32 a END-36 | Percepción de producto |
| 7 | END-26, END-27, END-28, END-37, END-38 | Pulido |

### 0.7 Cómo usar este documento

- **§0** se lee entero una vez, antes de tocar nada.
- **§1** es el registro de lo hecho, con su evidencia. No se reabre.
- **§2** es lo que bloquea: pasos manuales que ningún agente puede dar por ti.
- **§3** son órdenes ejecutables, una por sesión de Claude Code.
- **§4** son las reglas que gobiernan cualquier trabajo sobre este repositorio.

Y la regla que gobierna todo lo demás, heredada de v5 y confirmada por esta auditoría: **entre una función más y que lo existente sea a prueba de balas, gana siempre lo segundo.**

---

# Parte I — Lo que se hizo

## 1. Registro de remediación

Rama `endurecimiento`, trece commits sobre el tag `pre-endurecimiento` (`80eafef`).

| Commit | Hallazgo | Qué entró |
|---|---|---|
| `1e7d8d0` | — | `AGENTS.md` completo, en vez de tres líneas |
| `88d4926` | — | *(revertido)* alineación de `.env` sobre premisa falsa |
| `424f931` | END-04 | invariante de tokens con sus excepciones y su deuda medida |
| `a9cfbfa` | — | reversión de `88d4926` |
| `09c1045` | — | corrección de la propia revisión (§5) |
| `a8e179f` | **END-02** | el microservicio falla cerrado |
| `5719f29` | **END-01** | `0022` · lectura del bucket acotada |
| `8d66f7a` | END-01 | 4 barreras de lectura contra producción |
| `8bd670d` | **END-03** | `0023` · reportar a una persona hace algo |
| `b9cad05` | END-06 | `0024` · `roomies_publicos` |
| `b3d2124` | END-05 | `0025` · barrido programado + Edge Function |
| `bb58fb8` | END-04 | tres `.env` + guardián en CI |
| `08df5a9` | END-07 | `0026` · correo institucional verificado |

## 2. Estado de las compuertas

Medido el 19/09/2026, árbol limpio:

| Compuerta | Antes | Ahora | Comando |
|---|---|---|---|
| pgTAP (RLS, local) | 21 | **40** | `npx supabase test db` |
| Aislamiento contra producción | 15 | **19** | `node --env-file=.env --env-file=.env.server scripts/prueba-rls.mjs` |
| Pruebas del microservicio | 9 | **16** | `cd ai-service && .venv/bin/python -m pytest tests -q` |
| Pruebas del frontend | 92 | **98** | `npx jest` |
| Tipado de Edge Functions | **ninguno** | 4/4 | `npx deno@2 check supabase/functions/*/index.ts` |
| Reparto de `.env` | **ninguno** | compuerta | `npm run verificar:env` |
| TypeScript | limpio | limpio | `npx tsc --noEmit` |
| ESLint | 0 errores | 0 errores | `npx expo lint` |

Artefactos nuevos: 5 migraciones (`0022`–`0026`), 1 Edge Function (`barrer-fotos`), 2 jobs de CI (`secretos`, `edge-functions`), 2 scripts (`verificar-env.mjs` y el barredor programado), 1 módulo (`correoUniversitario.ts`).

---

# Parte II — Lo que bloquea

## 3. Pasos manuales pendientes

Ningún agente puede darlos: escriben en producción o en un panel.

### 3.1 Aplicar las cinco migraciones

```bash
cd /home/damianml/cuervo-pass && npx supabase db dump --data-only -f respaldos/$(date +%F)-pre-bloqueA.sql && npx supabase db push
```

Debe listar **las cinco**: `0022`, `0023`, `0024`, `0025`, `0026`. Si aparecen menos, el proceso leyó la carpeta antes de que existieran — cancela y relanza.

Dos avisos propios de este push:

- **`0025` crea `pg_cron`.** Funcionó en local. Si el proyecto la tiene bloqueada, la migración falla ahí y **aborta la transacción entera**: ninguna de las cinco se aplica. Es el comportamiento correcto.
- **`0026` usa `create or replace view`** porque la policy de `0022` depende de `perfiles_publicos`. Verificado contra `db reset` desde cero.

### 3.2 Desplegar el barredor de fotos

Sin esto, `0025` programa una tarea que llama a una función inexistente.

```bash
cd /home/damianml/cuervo-pass && npx supabase secrets set CRON_SECRET=$(openssl rand -hex 32) && npx supabase functions deploy barrer-fotos --no-verify-jwt
```

Después, los dos secretos de Vault con el SQL exacto del encabezado de `supabase/migrations/0025_barrido_programado.sql`. Y el mismo `CRON_SECRET` en `.env.server`.

### 3.3 Activar la confirmación de correo en producción

`config.toml` rige solo el entorno local. En el panel: **Authentication → Providers → Email → Confirm email**.

### 3.4 Verificar que la remediación aplica de verdad

```bash
cd /home/damianml/cuervo-pass && node --env-file=.env --env-file=.env.server scripts/prueba-rls.mjs
```

Las barreras 16 a 19 deben pasar de `[ EXPUESTO ]` a `[ BLOQUEADO ]`, con 19 de 19.

## 4. Dos decisiones que quedan al equipo

**El guion de demo cambia.** De 104 cuentas en producción, 100 son `@cuervopass-demo.test`, 2 `@ejemplo.mx` y 2 `@gmail.com`: **ninguna pasaría la regla de END-07**. Las existentes siguen entrando —la regla solo aplica al registrarse— pero registrar una cuenta en vivo exige ahora correo `.edu.mx` y confirmar un buzón.

**La insignia va a mentir en la demo.** Las 104 tienen `email_confirmed_at` porque el seed las creó con `email_confirm: true`. `correo_verificado` saldrá en verde para cuentas `@cuervopass-demo.test`, que no es un dominio real. Se corrige sembrando con dominios `.edu.mx` y sin forzar la confirmación; toca datos de demo, así que es decisión del equipo.

---

# Parte III — Lo que falta

## 5. Órdenes ejecutables

Una orden por sesión de Claude Code. Formato fijo: **defecto → orden → aceptación → verificación**. Reglas del plan:

- Una orden, una rama, un commit.
- **Ninguna orden se cierra sin su verificación en verde.**
- **Ningún arreglo sin una prueba que falle antes.** Si no puedes escribirla, no entendiste el defecto.
- Si una orden lleva más de una sesión, está mal descompuesta: pártela.

### Bloque B — El motor

**B.1 · END-08 · Que Nivel 2 no esconda publicaciones**

> Escribe primero la prueba en `supabase/tests/rls.test.sql`: siembra 5 publicaciones viables de las cuales solo 2 tengan `vector_embedding`, y un usuario con `perfil_vector`. Afirma que `count(*) from sugerencias_con_ranking(30)` es **5**. Corre `npx supabase test db` y **confirma que devuelve 2** antes de seguir.
>
> Después, migración nueva (no edites `0015`): elimina el `where yo.perfil_vector is not null and c.vector_embedding is not null`. Usa `left join lateral` y deja `similitud` en `null` cuando falte, con `score_final = c.score` en ese caso. Añade una columna `nivel int` con 2 cuando hay similitud y 1 cuando no.
>
> En `src/services/publicaciones.service.ts`, `obtenerSugerencias` pasa a **una sola llamada**; elimina el fallback todo-o-nada. Devuelve `{ datos, conAfinidad, total }`. En `src/app/(tabs)/inicio.tsx` el kicker deja de ser binario: `NIVEL 2 · 12 DE 20 CON AFINIDAD SEMÁNTICA`.
>
> Añade `src/services/__tests__/publicaciones.service.test.ts` con el cliente de Supabase mockeado: filas mixtas, ninguna se pierde.

**Aceptación:** la prueba pasa de 2 a 5. `src/services` deja de estar al 0 %.
**Verificación:** `npx supabase test db && npx jest src/services`

**B.2 · END-09 · Arreglar el score de mascotas**

> En migración nueva, sustituye `case when p.permite_mascotas = yo.mascotas then 0.5 else 0 end` por `case when yo.mascotas then (case when p.permite_mascotas then 0.5 else 0 end) else 0.5 end`. Corrige el comentario de las tres decisiones del `where`, que hoy describe una asimetría que el score no implementaba.
>
> Prueba pgTAP: usuario **sin** mascota, dos publicaciones idénticas salvo `permite_mascotas` → mismo score. Hoy difieren en 0.125. Confirma el rojo.

**Verificación:** `npx supabase test db`

**B.3 · END-17 · Filtro de tipo en el servidor** — *hazlo después de C.3.*

> Añade `p_tipo text default null` a `sugerencias_publicaciones` y `sugerencias_con_ranking`, con `and (p_tipo is null or p.tipo = p_tipo)`. Propaga por `obtenerSugerencias(limite, tipo)` y elimina el `useMemo` de `filtradas` en `inicio.tsx`. Con C.3 hecho, el tipo entra en la `queryKey` y hay caché por chip gratis.

**B.4 · END-13 y END-14 · Higiene de cuotas y de errores ajenos**

> 1. `revelar_contacto`: si ya existe la fila en `contactos` para `(auth.uid(), p_publicacion_id)`, devuelve el teléfono **sin** llamar a `consumir_cuota`. Prueba: tres revelaciones del mismo contacto consumen 1.
> 2. Crea `devolver_cuota(p_recurso text)` `security definer` con piso en 0, `revoke from public`, `grant to authenticated`.
> 3. En `ai-proxy`, llámala en el `catch` y cuando `r.status >= 500`.
> 4. En el mismo punto, **deja de reenviar el cuerpo ajeno**: responde `{ degradado: true, motivo: 'servicio-error' }` y manda el cuerpo real a `console.error`.
> 5. Añade manejo de `OPTIONS` con cabeceras CORS a las cuatro Edge Functions.

**Verificación:** `npx supabase test db && npx deno@2 check supabase/functions/*/index.ts`

**B.5 · END-15 · Ritmo real en la geocodificación**

> Añade `consumir_cuota('geocodificacion', 40)` a la Edge Function y el valor al `CHECK` de `cuotas_uso.recurso`. Implementa el límite de 1 petición por segundo del lado servidor con una tabla `geocodificaciones_ritmo` y un `select ... for update`: es la única forma de honrar la obligación de ODbL cuando todas las peticiones salen de la IP de Supabase.
>
> **Y corrige el comentario del encabezado.** Si implementas un límite de ritmo y no una cola, escribe «límite de ritmo».

**B.6 · END-28 · Dejar de mandar 384 flotantes al teléfono**

> Elimina `vector_embedding` de la tabla de retorno de `sugerencias_publicaciones`; que `sugerencias_con_ranking` se una internamente por id. Ajusta `PublicacionSugerida`.

### Bloque C — Fiabilidad del cliente

**C.1 · END-12 · `ErrorBoundary` y reporte de crashes**

> Exporta `ErrorBoundary` desde `src/app/_layout.tsx`. Debe renderizar con el sistema de diseño (`BloqueEstado` con `tono="alerta"`), mostrar el mensaje, y ofrecer **Reintentar** (`retry()`) y **Copiar detalle**. Nunca una pantalla blanca.
>
> Instala `@sentry/react-native` con `npx expo install`. DSN en `EXPO_PUBLIC_SENTRY_DSN` (público por diseño), `tracesSampleRate: 0.2`, y un `beforeSend` que **elimine** `perfil_texto`, `whatsapp`, `descripcion_busqueda` y cualquier correo: §29 exige minimización y un reporte de crash es donde más se filtra.
>
> Sustituye los 24 `console.warn`/`console.error` de `src/` por `src/lib/registro.ts`.

**C.2 · END-11 · Distinguir «falló la red» de «no existe»**

> Crea `src/lib/resultado.ts` con `type Resultado<T> = { estado:'ok'; datos:T } | { estado:'vacio' } | { estado:'error'; mensaje:string }`.
>
> `publicacion/[id].tsx`: tres estados distintos. `error` muestra «NO PUDIMOS CONSULTAR» con reintento. **Prohibido que un `catch` produzca `vacio`.**
>
> `usePerfilStore`: añade `error`. Al fallar **no toques `perfil`**: conserva el último valor conocido. `ResumenFiltros` muestra ese valor con indicador de desactualizado, jamás «Sin presupuesto · Sin distancia · Sin universidad».
>
> `storage.ts`: `firmarRutas` propaga el fallo en vez de devolver un `Map` vacío.

**Verificación:** `npx jest src/app/publicacion`

**C.3 · END-18 · TanStack Query**

> `npx expo install @tanstack/react-query`. Provider en `_layout.tsx` con `staleTime: 30_000`, `retry: 2` con backoff, `refetchOnWindowFocus: false`. Crea `src/hooks/queries/` con `useSugerencias(tipo)`, `usePublicacion(id)`, `useConversaciones()`, `useMensajes()` (`useInfiniteQuery`) y `useMiPerfil()`. Las mutaciones (`revelarContacto`, `reportarPublicacion`, `enviarMensaje`) pasan a `useMutation` con invalidación.
>
> Si al terminar sigue habiendo `const [cargando, setCargando]` en una pantalla de lista, no terminaste.

**C.4 · END-16, END-19, END-20 · El chat**

> 1. RPC con `lateral join` que devuelva `(conversacion_id, ultimo_mensaje, no_leidos)`. Treinta filas en vez de mil doscientas.
> 2. Cursor compuesto `(creado_en, id)` en `listarMensajes`.
> 3. `useChatStore`: `limpiarConversacion(id)` al desmontar, máximo 3 conversaciones retenidas, e **inserción binaria** en vez de `.sort()` completo.
> 4. `useAuthStore`: guarda y expón la cancelación de `onAuthStateChange`, con guard contra doble registro.
> 5. Envío optimista con `id: 'temp-…'` y estado `enviando`/`fallido`, con reintento **en la burbuja**. El texto nunca vuelve al campo.
> 6. `catch` en `cargarAnteriores`.

**C.5 · END-21 · La calificación deja de viajar por la URL**

> Crea `afinidad_de(p_publicacion_id uuid)` que devuelva `(score, similitud, score_final, nivel)` para una publicación. `publicacion/[id].tsx` la consulta en vez de leer los params. Y `revelar_contacto` **deja de aceptar `p_score` del cliente**: lo calcula dentro.

**C.6 · END-27 · Códigos de error, no subcadenas**

> `src/lib/erroresPostgres.ts` con constantes (`UNIQUE_VIOLATION='23505'`, etc.). `grep -rn "includes('duplicate')" src` debe quedar vacío.

**C.7 · END-24 · URLs firmadas que se renuevan**

> `use-fotos-firmadas.ts`: reprograma la refirma a los 50 minutos con cancelación en el cleanup, o —si C.3 está hecho— conviértelo en `useQuery` con `staleTime` y `refetchInterval`.

### Bloque D — Diseño

**D.1 · END-29 · Medir superficies, no solo texto**

> Crea `scripts/verificar-contraste.mjs` con una tabla de pares declarada en el propio script: texto/fondo ≥4.5, bordes de control ≥3.0, **superficie contra superficie ≥1.2 de razón o borde ≥3.0**. Córrelo contra el tema actual y **confirma que falla** en `tintedSurface/background` claro (1.00), `tintedBorder/tintedSurface` (1.35) y `tintedBorder/background` (1.36). Corrige manteniendo el matiz y moviendo el valor. Añádelo a CI y a `package.json` como `verificar:contraste`.
>
> Actualiza el encabezado de `theme.ts`: hoy afirma que todos los contrastes están medidos.

**D.2 · END-30 · Desmontar «AFINIDAD 9.4»**

> Redondea a medios puntos. Cambia la etiqueta a `AJUSTE`. **Muestra el porqué en la tarjeta**: bajo la casilla, una línea `type="folio"` con `1.2 km · $500 bajo tu tope · afinidad 0.87`, omitiendo el tercero cuando `nivel === 1`. En el detalle, `DesgloseCalificacion` siempre visible, con la ponderación explícita. Y una línea: *«Este ajuste compara tus filtros con lo publicado. No verificamos el inmueble.»*

**D.3 · END-31 · Un solo componente de calificación**

> Añade `tamano="compacta"` a `Calificacion`. Borra los estilos `casilla` y `cifraCalificacion` de `FichaCompacta` y usa el componente, con su etiqueta. Añade una regla ESLint `no-restricted-syntax` que prohíba `fontSize:`, `fontFamily:` y literales `#` en `src/components/**` y `src/app/**`, con las tres excepciones nombradas. Corre el lint y **arregla las 29 apariciones restantes**.

**D.4 · END-33 · Densidad comparable**

> Crea `src/components/FilaPublicacion.tsx` de **128–140 px**: foto cuadrada de 96 px a la izquierda; a la derecha, tres columnas de ancho fijo —`AJUSTE`, `RENTA`, `DISTANCIA`— con `fontVariant: ['tabular-nums']` para que formen columna al recorrer. Úsala en `inicio`. Conserva `FichaPublicacion` para «Mis publicaciones», donde no se compara. Verifica en dispositivo que caben **al menos 4 filas**.

**D.5 · END-32 · Un carrusel, o ninguno**

> Elimina los tres. Sustitúyelos por **uno** con contenido que la lista no tenga: `nuevas_esta_semana(p_limite)` en Postgres. Si devuelve menos de 3 filas, no se renderiza. Añade un control de orden explícito que reordene la lista **en el sitio**.

**D.6 · END-34 · Escalado de fuente real**

> `maxFontSizeMultiplier` por tipo en `themed-text.tsx`: 1.4 para `default`/`small`, 1.2 para títulos, **1.0 para `calificacion`, `cifra`, `folio` y `etiqueta`** (cifras en casillas de ancho fijo). Sustituye `minHeight` fijo por `minHeight` + `paddingVertical`. Crea `docs/prueba-escalado.md` con el procedimiento, **ejecútalo y adjunta capturas**. Sin eso, borra la línea de `PRODUCT.md`: es falsa.

**D.7 · END-35 · Objetivos táctiles**

> Corrige las cinco violaciones listadas. Añade `scripts/verificar-toques.mjs` que falle ante `minHeight`/`height` numérico < 44 en estilos cuyo nombre contenga `chip|boton|accion|control|toggle|casilla`.

**D.8 · END-38 · Esqueletos con forma de ficha**

> `src/components/ficha/FichaEsqueleto.tsx`: la ficha vacía con sus etiquetas reales y los valores como bloques de `theme.backgroundElement`. Pulso sutil con Reanimated respetando `AccessibilityInfo.isReduceMotionEnabled`. Sustituye el `ActivityIndicator` de pantalla completa en `inicio`, `publicaciones`, `roomies`, `chats` y `publicacion/[id]`. **Nunca borres la pantalla para cargar.**

**D.9 · END-37 · Movimiento y tacto**

> `npx expo install expo-haptics`. `notificationAsync(Success)` al revelar contacto y al publicar; `impactAsync(Light)` al cambiar chip y enviar mensaje. **Nada más.** Conteo de la cifra en el detalle (400 ms, `Easing.out(Easing.cubic)`), solo ahí. Entrada escalonada `FadeInDown.delay(index*30)` con tope de 8. Un componente `Pulsable` que sustituya `opacity: 0.7`. **Todo respeta `useReducedMotion()`.**

**D.10 · END-36 · Responsive donde importa**

> Aplica `useTamanoPantalla` en `inicio`, `publicaciones`, `roomies`, `chats`, `chat/[id]` y `publicacion/[id]`. Usa `MaxContentWidth` para centrar en tablet, y en el carrusel de fotos usa `Math.min(ancho, MaxContentWidth)`. **Si al terminar `MaxContentWidth` sigue sin usarse, bórralo del tema:** un token muerto es peor que ningún token.

**D.11 · Capa semántica de color**

> Añade `Tramas` a `theme.ts` con tres tratamientos sin color nuevo —`solido`, `rayado`, `punteado`— para codificar el tipo de publicación. Si prefieres color, añade **exactamente dos** matices, mídelos con `verificar-contraste.mjs` y documenta su regla de uso.

**D.12 · Reescribir `DESIGN.md` desde lo construido**

> Al terminar el bloque: cada afirmación de contraste cita el script, no un número a mano. **Borra la metáfora de la lámpara** — `#12100E` es negro cálido, no papel iluminado. Documenta cada componente con su archivo y sus variantes reales. Añade una sección «Lo que este sistema NO resuelve todavía».

### Bloque E — Plataforma

**E.1 · END-10 · Que la app compile y el mapa se vea**

> En `app.json`: `ios.bundleIdentifier: "mx.cuervopass.app"`, `android.config.googleMaps.apiKey` desde `EXPO_PUBLIC_GOOGLE_MAPS_KEY`, `runtimeVersion: { policy: "appVersion" }` y `updates.url`. Añade la clave a `.env.example` con instrucciones para restringirla por huella de firma. Resuelve los 8 paquetes de `npx expo-doctor`.

**E.2 · END-23 · Estabilizar la suite**

> En `pantallas.humo.test.tsx`, sustituye todo `getByText` posterior a un `await` por `findByText` con `{ timeout: 5000 }`. `jest.setTimeout(15000)` en `jest.setup.js`. Verifica con **diez corridas consecutivas** de `npx jest --coverage` en verde.

**E.3 · END-22 · Umbrales de cobertura**

> Añade `--coverageThreshold` por directorio: `src/services` y `src/store` al **70 %**, global al 45 %. Sube el umbral conforme avances; **nunca lo bajes**.

**E.4 · Pinear el resto de CI**

> `supabase/setup-cli` usa `version: latest` y `aquasecurity/trivy-action` usa **`@master`**, en el mismo archivo que explica por qué `npm ci` y no `npm install`. Pínealos por SHA. Sustituye el `curl | sh` de syft por `anchore/sbom-action`. Añade `concurrency` y `npm audit --audit-level=high`.

**E.5 · END-26 · API deprecada**

> Migra `src/lib/storage.ts` de `ImageManipulator.manipulateAsync` a la API contextual.

**E.6 · Higiene de operación**

Tres defectos observados en vivo durante esta auditoría:

> 1. **`tunel.sh` no avisa si el puerto 8000 ya está ocupado.** `uvicorn` falla al enlazar **después** de cargar el modelo, así que tarda entre 6 y 40 segundos en decirlo y mientras tanto parece que arrancó. Costó una verificación falsa: se midió un servidor viejo y se reportó que END-02 seguía rota.
> 2. **Nada ata el proceso en marcha a la versión del repositorio.** Un uvicorn llevaba **trece horas** con código anterior a la remediación. Expón el commit en `/listo` (`git rev-parse --short HEAD` inyectado al arrancar) y que `verificar.mjs` lo compare con el árbol de trabajo.
> 3. **`tunel.sh` mata un túnel sano.** No comprueba si `.tunel-actual` responde y el secret ya apunta ahí; siempre empieza de cero. Dos ejecuciones seguidas dejaron el sistema sin túnel durante diez minutos de propagación de DNS.

## 6. Secuencia y compuertas

| Fase | Órdenes | Compuerta para avanzar |
|---|---|---|
| **0** | §3 completo | `prueba-rls.mjs` 19/19 contra producción |
| 1 | B.1, B.2, C.1, E.1 | prueba «5 no 2» en verde; `src/services` > 0 % |
| 2 | C.2, C.3, C.5, B.4 | cobertura de `src/services` y `src/store` ≥ 70 % |
| 3 | B.3, B.5, B.6, C.4, C.6, C.7 | `npx supabase test db` con ≥ 50 aserciones |
| 4 | E.2, E.3, E.4, E.5, E.6 | CI entero en verde diez veces seguidas |
| 5 | D.1 a D.12 | `verificar-contraste` y `verificar-toques` en verde; capturas al 200 % adjuntas |

---

# Parte IV — Cómo se trabaja en este repositorio

## 7. Reglas para Claude Code

Las reglas operativas viven en **[`AGENTS.md`](../AGENTS.md)**, que `CLAUDE.md` importa y que se carga en **cada** sesión. Este documento no las duplica; aquí solo se registran las que esta auditoría añadió y por qué.

### 7.1 Reglas nuevas

**R1 · Toda afirmación debe traer su comando.** Si escribes en un comentario o en un `.md` que algo está resuelto, di con qué se comprueba. Si no hay forma de comprobarlo, escribe «sin verificar». Es la causa raíz de la mitad de los hallazgos de §0.

**R2 · Ningún arreglo sin una prueba que falle antes.** Escribe la prueba, **confirma el rojo**, arregla, confirma el verde. Si no puedes escribir la prueba que falla, todavía no entiendes el defecto. Esta regla produjo el mejor dato del día: al exigir token en END-02, **cuatro pruebas existentes se rompieron** — la suite pasaba gracias al fallo.

**R3 · Fallar cerrado, nunca abierto.** Si falta una credencial, una variable o una policy, el sistema se detiene. Prohibido `if (TOKEN && !esValido(...))`.

**R4 · «Falló la red» y «no hay dato» son estados distintos y se pintan distinto.** Prohibido `catch { setEstado(null) }`.

**R5 · Un filtro que el usuario toca se aplica en el servidor**, nunca sobre una página ya truncada en el cliente.

**R6 · Pregunta siempre: ¿con qué identidad se evalúa esta línea?** `security invoker` sobre una tabla cerrada devuelve cero filas, sin error y sin log. Es AUD-01 y ya apareció **cuatro veces** en este proyecto: en la función de publicaciones (v5), en el ranking (END-08), en Storage (END-01) y en roomies (END-06).

**R7 · Tokens de diseño o nada**, con las tres excepciones nombradas en `AGENTS.md` y la deuda medida con su comando.

**R8 · Antes de declarar que una variable es «de servidor», corre el grep.** Deducir del nombre ya metió una credencial fantasma en `AGENTS.md`.

**R9 · Verifica las condiciones del experimento antes de creerle al resultado.** Ver §8: los cuatro errores de método de esta sesión fueron de aquí, ninguno de razonamiento.

### 7.2 Cuando dos sesiones trabajan a la vez

Ocurrió y produjo una colisión real. Reglas:

- **Una sesión escribe, la otra revisa.** Nunca dos escribiendo sobre el mismo árbol.
- **Cuando el revisor dice «esto está mal», se revierte o se discute.** No se omite en silencio. En esta sesión, la sesión escritora aplicó las dos correcciones que le daban la razón y dejó fuera las dos que decían que se había equivocado; el resultado fue un `AGENTS.md` con una credencial fantasma y una afirmación sin fuente.
- **Cuando un agente diga «X no se usa» o «X vive en Y», pídele el comando y su salida.** Los dos errores de aquel día se detectan con un `grep -rn` y treinta segundos.

## 8. Errores de método cometidos en esta auditoría

Se registran porque son la evidencia más fuerte a favor de R1, R2 y R9, y porque un registro que solo guarda los aciertos no sirve para aprender de él.

| # | Qué pasó | Causa |
|---|---|---|
| 1 | Se afirmó que `. ../.env` «no aparece en ningún script» y se revirtió un commit correcto por esa premisa. **Sí aparece**, en `scripts/tunel.sh:42`. | El propio `grep` terminaba en `\| grep -v "\.venv"`, y esa línea contiene `.venv/bin/uvicorn`. **El filtro se comió la evidencia que lo refutaba.** |
| 2 | Se reportó que END-02 seguía rota tras arreglarla: `/metricas` devolvía 200 y faltaba el 400. | Se midió contra el puerto 8000 sin comprobar quién lo tenía. Un uvicorn de **trece horas** con código viejo respondió las peticiones. |
| 3 | Se leyeron tres 422 como fallos de autenticación. | Comillas mal escapadas dentro de `$( )`: curl envió JSON inválido. |
| 4 | Un `.catch()` sobre un constructor de PostgREST reventó el bloque `finally` de `prueba-rls.mjs`. | El constructor es *thenable*, no una Promesa. |

Los cuatro se detectaron **ejecutando**, ninguno leyendo. Y los tres primeros no fueron errores de razonamiento sino de no validar las condiciones del experimento — exactamente el defecto que §0.2 imputa al proyecto, cometido por quien lo auditaba.

De ahí sale la única regla de §7 que se dirige a quien lee un informe y no a quien lo escribe: **cuando un agente diga «verificado», pregunta contra qué.**

---

## 9. Trazabilidad

| Documento | Qué contiene | Cuándo se lee |
|---|---|---|
| **documento maestro v5** | auditoría de v4, especificación y plan de 12 semanas | una vez, completo, antes de decidir |
| **este documento (v6)** | auditoría de la implementación de v5 y plan de endurecimiento | §0 una vez; §3 y §5 en cada sesión de trabajo |
| [`AGENTS.md`](../AGENTS.md) | reglas operativas | automáticamente, en cada sesión de Claude Code |
| [`PRODUCT.md`](../PRODUCT.md) | usuarios, alcance, principios | al decidir alcance |
| [`DESIGN.md`](../DESIGN.md) | sistema visual | al tocar interfaz — **pendiente de reescritura, D.12** |
| [`docs/bitacora-semanal.md`](bitacora-semanal.md) | qué se hizo y qué se rompió, por semana | cada viernes |
| [`docs/modelo-amenazas.md`](modelo-amenazas.md) | qué protege el diseño y qué no | al tocar seguridad o privacidad |
| [`docs/verificacion-pre-demo.md`](verificacion-pre-demo.md) | checklist previo a exponer | antes de cada demo |

Los hallazgos **AUD-NN** pertenecen al documento maestro v5 y los citan decenas de comentarios del código. Los **END-NN** son de este documento. No se renumeran ni se mezclan.
