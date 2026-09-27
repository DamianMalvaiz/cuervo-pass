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

*Revisado el 20/09/2026, tras ejecutar el plan completo. El dictamen original está al final de esta sección.*

**Los cuarenta hallazgos están remediados y aplicados en producción.** No es una afirmación de proceso: se verificó contra la base real —migraciones hasta la `0039`, 19 de 19 barreras de aislamiento— y se contrastaron cuatro correcciones contra el código vivo (END-08, END-09, END-16, END-30) en vez de contra sus mensajes de commit.

Lo que importa del ejercicio no es el recuento. Son dos cosas.

**La primera: el patrón se confirmó, y volvió a aparecer en este documento.** El dictamen original decía que la documentación de este repositorio describe un sistema distinto al construido. Mientras se ejecutaba el plan, este archivo —escrito precisamente para combatir eso— se quedó listando treinta y uno de sus propios hallazgos como «abiertos» cuando ya estaban cerrados. El README quedó afirmando ochenta y tres aserciones de pgTAP cuando eran ochenta y seis, en cuatro sitios, y uno de ellos dice literalmente *«el número se lee del archivo, no se escribe a mano»* con el comando debajo, sin correr.

No es descuido: es que **afirmar cuesta un minuto y verificar cuesta diez**, y bajo presión esa asimetría siempre gana. La conclusión práctica no es «esforzarse más» sino la regla que salió de aquí: toda cifra en un documento cita el comando que la produce, o no se escribe.

**La segunda: una remediación puede abrir un agujero.** END-39 —el mejor hallazgo de todo el proyecto, y salió del propio equipo— demostró que `revoke ... from public` no revocaba nada en Supabase. Dos funciones quedaron explotables con la anon key, y **una de ellas la introdujo la orden B.4 de este mismo plan**: `devolver_cuota` permitía resetear la cuota propia en bucle, o sea extraer la base de teléfonos entera, que es exactamente lo que AUD-04 existe para impedir.

Lo destapó la aserción 72 de la `0035`, **la primera del proyecto que comprobaba un `revoke` en vez de escribirlo**. Ese es el argumento entero a favor de la regla «prueba en rojo antes del arreglo», y la razón por la que no se puede tratar una lista de remediaciones como una lista de cosas que ya no hay que mirar.

Queda trabajo, pero no del plan original: cinco cosas que aparecieron **al revisar el trabajo hecho**, y están en [`cola-de-trabajo.md`](cola-de-trabajo.md).

<details>
<summary>Dictamen original, del 19/09/2026</summary>

v5 corrigió los veintiocho hallazgos de v4 y la implementación arrastra **defectos propios de la misma familia**. El patrón es uno solo y se repite:

> **La documentación describe un sistema distinto al construido.**

No por descuido en la prosa: la prosa es excelente. Por una asimetría de esfuerzo entre afirmar y verificar. `DESIGN.md` tiene 27 KB; la capa de servicios tenía **0 % de cobertura de pruebas**. Se midieron doce pares de contraste de texto a mano y **ninguna superficie contra superficie** —la que falla—. Se escribieron tres párrafos justificando `hmac.compare_digest` contra ataques de temporización mientras el guardia de al lado **fallaba abierto**.

Los tres hallazgos críticos comparten forma con AUD-01, el hallazgo estrella de v5: **dos decisiones correctas por separado que se contradicen al correr juntas**, produciendo un fallo silencioso.

1. **END-01** — la migración titulada «storage privado» cambió «cualquiera en internet» por «cualquiera con una cuenta», y el registro era abierto.
2. **END-02** — el microservicio que guarda `ANTHROPIC_API_KEY`, expuesto por un túnel público, **no autenticaba a nadie** en su ruta de arranque documentada.
3. **END-03** — el botón «Reportar usuario» insertaba la fila, mostraba un acuse y **el trigger salía sin hacer nada**. En la ruta de seguridad personal, en un producto donde alguien de dieciocho años queda con un desconocido.

El cuarto, **END-08**, no se ha remediado y es el de mayor impacto en lo que el evaluador va a ver: **el motor esconde publicaciones válidas sin decirlo**. Es AUD-01 reintroducido una capa más arriba.

</details>

### 0.3 Hallazgos remediados · primera tanda

*Los cuarenta hallazgos de este documento están remediados. La correspondencia
con el commit que cerró cada uno se deriva del repositorio:*

```bash
git log --format='%h|%s' pre-endurecimiento..HEAD \
  | grep -oE '^[0-9a-f]+\|.*END-[0-9]+.*' \
  | awk -F'|' '{ n=$2; while (match(n, /END-[0-9]+/)) { print substr(n,RSTART,RLENGTH) " " $1; n=substr(n,RSTART+RLENGTH) } }' \
  | sort -t- -k2 -n -u
```

| Hallazgo | Cerrado en | | Hallazgo | Cerrado en |
|---|---|---|---|---|
| END-01 | `5719f29` | | END-21 | `4623856` |
| END-02 | `a8e179f` | | END-22 | `b428206` |
| END-03 | `8bd670d` | | END-23 | `3e2c980` |
| END-04 | `bb58fb8` | | END-24 | `983885a` |
| END-05 | `b3d2124` | | END-25 | `8ba9493` |
| END-06 | `b9cad05` | | END-26 | `08e9d63` |
| END-07 | `08df5a9` | | END-27 | `3f298dd` |
| END-08 | `86fc8d2` | | END-28 | `46b50c6` |
| END-09 | `6f974f6` | | END-29 | `1ebdd90` |
| END-10 | `9b7185d` | | END-30 | `bc2e3df` |
| END-11 | `8ba9493` | | END-31 | `dec661a` |
| END-12 | `71813b7` | | END-32 | `4210794` |
| END-13 | `f87dde0` | | END-33 | `4b472be` |
| END-14 | `f87dde0` | | END-34 | `98ffa67` |
| END-15 | `aaf2044` | | END-35 | `5c1b1ec` |
| END-16 | `5cd7d41` | | END-36 | `9395268` |
| END-17 | `af63b54` | | END-37 | `8db5ed8` |
| END-18 | `7074bd6`, `163004f` | | END-38 | `812ff18` |
| END-19 | `5cd7d41` | | END-39 | `5f5c877` |
| END-20 | `5cd7d41` | | END-40 | `d16c742` |

> El comando de arriba devuelve **30** de las 40 filas: los commits del bloque A
> (END-01 a END-07) describen el defecto en su asunto sin citar el identificador,
> y END-18, END-39 y END-40 se cerraron en commits que tampoco lo llevan. Esas
> diez se completaron a mano y se verificaron una por una con `git cat-file -e`.
>
> La lección, y por eso queda escrita: **un identificador en el asunto del commit
> vale más que cualquier tabla.** Las treinta que lo llevan se regeneran solas; las
> diez que no, envejecen. En adelante, el asunto cita el hallazgo.

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

### 0.4 Hallazgos remediados · segunda tanda

*Esta sección se escribió como «Hallazgos abiertos» el 19/09 y se renombró el
20/09: los treinta y uno estaban cerrados. **Que tardara un día en actualizarse
es el propio hallazgo del §0.2**, así que el título original queda dicho aquí en
vez de borrado.*

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

### 0.5 Hallazgos de diseño · remediados

*Los diez se cerraron entre el 19 y el 20/09. El texto describe el defecto tal
como estaba; la corrección, en el commit de la tabla de §0.3.*


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

**END-37 · Sin movimiento y sin tacto** · **Bajo** — Reanimated y Worklets instalados, y `expo-haptics` **no**: un mundo cuya pieza central se llama «sello» y no vibra al estampar. El único feedback de pulsación en toda la app es `opacity: 0.7`, el valor por defecto de React Native. Un archivo —`ficha/DesgloseCalificacion.tsx`— anima con `LayoutAnimation`, que es de React Native y no de Reanimated.

> **Corrección del 26/09/2026, al ejecutar V.8 capa 4.** Este hallazgo llevaba un dato mal contado, y conviene decir exactamente cuál para no dar por retirado lo que sí valía.
>
> **Lo que era falso.** La redacción original decía que «Reanimated, Worklets y Gesture Handler» estaban «usados en **dos** archivos (`components/ui/collapsible.tsx` y `app/perfil/[usuarioId].tsx`)», y de ahí concluía que se cargaba el runtime completo de Reanimated «para un acordeón y una pantalla de perfil». Dos errores:
>
> · **Eran seis archivos, no dos.** Además de esos dos: `ficha/Pulsable.tsx`, `ficha/Calificacion.tsx`, `ficha/FichaEsqueleto.tsx` y `(tabs)/inicio.tsx`. Los tres de `ficha/` se crearon el 18 y el 19 de septiembre y este documento se escribió el **20**: ya existían cuando conté. Fue un recuento mal hecho, no un dato caducado, y la conclusión que colgaba de él —que el runtime no se amortizaba— no se sostiene.
> · **Gesture Handler no se importa en ningún archivo del proyecto, y aun así hace falta:** es dependencia de `expo-router`. Nombrarlo junto a los otros dos lo pintaba como equipaje gratuito cuando no se puede quitar.
>
> **Lo que sí valía, y se arregló.** La mitad del tacto era correcta y está cerrada en `8db5ed8`: `expo-haptics` instalado y `src/lib/tacto.ts` con **dos** funciones a propósito —`sello()` para lo que queda registrado y no se deshace, `toque()` para lo que solo responde—, hoy en cuatro pantallas. El razonamiento de por qué son dos y no ocho vive en la cabecera de ese archivo.
>
> **Y una consecuencia de V.8 capa 4:** al borrar `components/ui/collapsible.tsx` —el `Collapsible` de la plantilla de Expo, cero importaciones en todo el proyecto— Reanimated queda en cinco archivos, todos deliberados.


**END-38 · Catorce spinners, cero esqueletos** · **Bajo** — `ActivityIndicator` en 14 archivos. El esqueleto se escribe solo en este mundo: dibujar la ficha vacía con sus etiquetas y llenar los valores al llegar. Está inventado y sin construir.

### 0.6 Hallazgos posteriores al documento

*Los encontró el equipo ejecutando el plan, no esta auditoría. Los dos son de
seguridad y el primero es el mejor trabajo del proyecto.*

**END-39 · `revoke ... from public` no revocaba nada** · **Crítico** · migración `0036` · `5f5c877`

Supabase trae configurado `alter default privileges ... grant execute on functions to anon, authenticated, service_role`. Cada función nueva nace con esas tres concesiones **escritas en su propia ACL**, y `revoke ... from public` no las quita, porque no vienen de PUBLIC. Comprobado leyendo la ACL real de una función recién creada, inmediatamente después del revoke:

```
{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
```

**Doce migraciones creían estar cerrando funciones y no cerraban ninguna.** Dos explotables con la sola anon key:

1. **`devolver_cuota('revelar_contacto')`** decrementaba la cuota del **propio llamante**. Veinticinco llamadas la devolvían a cero y permitían revelar veinticinco teléfonos más. En bucle, la base de teléfonos entera — exactamente el scraping que AUD-04 existe para impedir.
2. **`afinidad_de_para(usuario, publicacion)`** aceptaba el uuid de cualquiera. La `0031` la separó de `afinidad_de` precisamente para que nadie pidiera la afinidad de otra persona; la separación no existía, porque además de estar concedida la envoltura era `security invoker` y llamaba a la interna **con la identidad del cliente**. Una envoltura invoker no encapsula nada.

Dos cosas que hay que decir sobre este hallazgo:

**`devolver_cuota` la introdujo la orden B.4 de este mismo plan.** Una remediación puede abrir un agujero. Es la razón por la que una lista de hallazgos cerrados no es una lista de cosas que ya no hay que mirar.

**Lo destapó la aserción 72 de la `0035`, la primera del proyecto que COMPROBABA un `revoke` en vez de escribirlo.** Doce migraciones lo escribieron y ninguna lo verificó. Es el patrón del §0.2 en su forma más cara.

> **Remediación:** cambiar la forma. No se revoca función por función —una lista de lo que se cierra hay que acordarse de ampliarla— sino que se **cierra todo y se abre por lista**, que se revisa entera cada vez que se lee. La aserción 75 la fija.

**END-40 · Cuatro CRITICAL del advisor que NO se corrigen, y diecinueve policies que sí** · **Medio** · `d16c742`

El Security Advisor de Supabase reporta cuatro hallazgos CRITICAL. Se revisaron uno por uno contra el esquema real antes de tocar nada, y **ninguno se corrige** — tres de ellos porque «corregirlos» reintroduce el fallo que este proyecto ya pagó caro:

- **`Security Definer View`** en `perfiles_publicos`, `publicaciones_publicas` y `roomies_publicos`: las tres son `security_invoker = false` **a propósito** (AUD-14). Existen para evadir el RLS de `usuarios` y exponer solo una lista blanca. Ponerlas en `invoker` las evaluaría con la identidad del cliente, el RLS devolvería cero filas, y eso es **AUD-01**. El comentario de la vista ya lo dice; el linter no puede saberlo.
- **`Exposed Auth Users`** en `perfiles_publicos`: la vista une `auth.users`, pero lo único que saca es `(email_confirmed_at is not null)` — un booleano derivado, no el correo. La vista no está concedida a `anon`, y las aserciones 477 y 479 fijan que no expone `email` ni `email_confirmed_at`.

Lo accionable estaba en lo que la herramienta marcaba como simples **avisos**: diecinueve policies con `auth.uid()` suelto en el `USING`, que Postgres evalúa **una vez por fila**. Medido en esta base, mismo dato, misma policy, 50 000 filas:

| Forma | Tiempo | Plan |
|---|---|---|
| `using (dueno = auth.uid())` | 94.16 ms | Seq Scan + filtro por fila |
| `using (dueno = (select auth.uid()))` | 12.32 ms | InitPlan 1 · Result |

7.6×. Y conviene decir lo que **no** es: con las 114 publicaciones de hoy son décimas de milisegundo. Importa porque crece **lineal** con las filas, y `mensajes` es la que más va a crecer.

Este hallazgo vale por el método más que por el número: **una herramienta que grita CRITICAL cuatro veces y tiene razón cero es peor que no tenerla**, porque entrena a ignorarla. Lo correcto fue revisar los cuatro contra el esquema, documentar por qué se rechazan, y quedarse con lo que la herramienta había clasificado como menor.

> **Remediación:** `alter policy` y no `drop` + `create` — un drop deja la tabla sin esa policy hasta que el create corre, y el estado intermedio de una tabla con RLS es «nadie ve nada» o, peor, «se ve de más». La aserción 83 es una **lista negra**: cualquier policy futura escrita con la forma lenta la rompe sin que nadie tenga que acordarse de añadir su caso.

### 0.7 Hallazgos abiertos

Ninguno de este documento. Los cinco que quedan aparecieron **al revisar el trabajo hecho** y viven en [`cola-de-trabajo.md`](cola-de-trabajo.md), con su orden ejecutable:

| | Qué |
|---|---|
| **V.1** | Este documento estaba desactualizado *(lo que estás leyendo es su remediación)* |
| **V.2** | El README dice 83 aserciones y son 86, en cuatro sitios |
| **V.3** | `.tunel-actual` no se valida: puede desactivar en silencio las dos comprobaciones previas a exponer |
| **V.4** | `app/chat` al 0 % de cobertura |
| **V.5** | `app/(auth)` al 9 %, con la regla de correo institucional sin probar en pantalla |

### 0.8 Orden de remediación

*Se ejecutó completo entre el 19 y el 20/09/2026. Se conserva porque el ORDEN
fue una decisión, y el resultado la respalda: los tres críticos se cerraron y
se aplicaron a producción antes de tocar una sola línea de diseño.*

| Prioridad | Hallazgos | Estado |
|---|---|---|
| 0 | END-01 a END-07 | ✅ remediados y en producción |
| 1 | END-08, END-09 | ✅ |
| 2 | END-10, END-12 | ✅ |
| 3 | END-11, END-13, END-14, END-15 | ✅ |
| 4 | END-16, END-19 a END-23 | ✅ |
| 5 | END-29, END-30, END-31 | ✅ |
| 6 | END-17, END-18, END-24, END-25, END-32 a END-36 | ✅ |
| 7 | END-26, END-27, END-28, END-37, END-38 | ✅ |
| — | END-39, END-40 | ✅ encontrados y cerrados durante la ejecución |

Lo que queda está en [`cola-de-trabajo.md`](cola-de-trabajo.md).

### 0.9 Cómo usar este documento

- **§0** se lee entero una vez. Es el registro de qué estaba mal y por qué.
- **§0.7** dice qué sigue abierto. Hoy: nada de aquí; todo está en [`cola-de-trabajo.md`](cola-de-trabajo.md).
- **§1 y §2** son la evidencia: commits y compuertas, con los comandos que las producen.
- **§3** está vacía a propósito — ya no bloquea nada.

Y la regla que gobierna todo lo demás, heredada de v5 y confirmada dos veces por esta auditoría: **entre una función más y que lo existente sea a prueba de balas, gana siempre lo segundo.**

---

# Parte I — Lo que se hizo

## 1. Registro de remediación

**67 commits** sobre el tag `pre-endurecimiento` (`80eafef`), del 19 al 20 de septiembre de 2026. La correspondencia hallazgo → commit está en la tabla de §0.3, y se regenera con el comando que la acompaña.

Para leer el trabajo por orden de ejecución:

```bash
git log --oneline --reverse pre-endurecimiento..HEAD
```

Cuatro commits que conviene leer aunque no se lea el resto, porque cada uno enseña algo que no está en su diff:

| Commit | Por qué |
|---|---|
| `5f5c877` | **END-39.** `revoke from public` no revocaba. Dos exploits vivos, uno introducido por una orden de este plan |
| `d16c742` | **END-40.** Cuatro CRITICAL del advisor rechazados con argumento, y lo accionable era lo que marcaba como aviso. 7.6× medido |
| `a8e179f` | **END-02.** Al exigir token se rompieron cuatro pruebas existentes: la suite pasaba *gracias* al fallo |
| `09c1045` | Un `grep` de la auditoría se comió la evidencia que la refutaba, y sobre esa premisa se revirtió un commit correcto |

---

## 2. Estado de las compuertas

Medido el **20/09/2026**, árbol limpio. Cada cifra viene de su comando; ninguna se escribió a mano.

| Compuerta | Antes | Ahora | Comando |
|---|---|---|---|
| Migraciones en **producción** | 0021 | **0039** | `npx supabase migration list` |
| pgTAP (RLS y funciones) | 21 | **86** | `npx supabase test db` |
| Aislamiento contra **producción** | 15 | **19 / 19** | `node --env-file=.env --env-file=.env.server scripts/prueba-rls.mjs` |
| Pruebas del frontend | 92 | **306** | `npx jest` |
| Pruebas del microservicio | 9 | **20** | `cd ai-service && .venv/bin/python -m pytest tests -q` |
| Cobertura `src/services` | **0 %** | **66 %** | `npx jest --coverage` |
| Cobertura `src/store` | **0 %** | **70 %** | idem |
| Tipado de Edge Functions | **ninguno** | 4 / 4 | `npx deno@2 check supabase/functions/*/index.ts` |
| Reparto de `.env` | **ninguno** | compuerta en CI | `npm run verificar:env` |
| TypeScript · ESLint | limpio | limpio · 0 errores | `npx tsc --noEmit && npx expo lint` |

**67 commits** sobre el tag `pre-endurecimiento` (`80eafef`).

Huecos conocidos de cobertura, y por eso están en la cola: `app/chat` 0 %, `app/(auth)` 9 %, `app/publicacion/editar` 0 %.

---

# Parte II — Lo que bloquea

## 3. Nada

*El 19/09 esta sección tenía cuatro pasos manuales: aplicar cinco migraciones,
desplegar el barredor de fotos, activar la confirmación de correo y verificar.
**Los cuatro están hechos.***

Comprobado el 20/09: `migration list` da `0039` en remoto, y `prueba-rls.mjs`
devuelve **19 de 19 barreras** contra la base real.

```bash
cd /home/damianml/cuervo-pass && npx supabase migration list
cd /home/damianml/cuervo-pass && node --env-file=.env --env-file=.env.server scripts/prueba-rls.mjs
```

## 4. Dos decisiones que siguen abiertas para el equipo

No son defectos y por eso no llevan END. Son consecuencias de END-07 que alguien tiene que decidir.

**El guion de demo cambió.** De las 104 cuentas de producción, 100 son `@cuervopass-demo.test`, 2 `@ejemplo.mx` y 2 `@gmail.com`: **ninguna pasaría la regla de correo institucional**. Las existentes siguen entrando —la regla solo aplica al registrarse— pero registrar una cuenta en vivo exige ahora un `.edu.mx` y confirmar un buzón.

**La insignia de verificado va a mentir en la demo.** Las 104 tienen `email_confirmed_at` porque el seed las creó con `email_confirm: true`, así que `correo_verificado` sale en verde para cuentas de un dominio que no existe. Si el evaluador pregunta qué significa esa insignia, la respuesta honesta es «el script de siembra la puso». Se corrige sembrando con dominios `.edu.mx` y sin forzar la confirmación; toca datos de demo, así que es decisión del equipo.

---

# Parte III — Lo que falta

## 5. Nada de este documento

Las treinta y cuatro órdenes que vivían aquí se ejecutaron entre el 19 y el 20/09.
Mantener dos colas de trabajo en dos archivos las desincroniza —ya pasó una vez
con este mismo documento— así que la cola vive en un solo sitio:

### → [`cola-de-trabajo.md`](cola-de-trabajo.md)

Cinco órdenes, cada una con defecto, orden copiable, aceptación y verificación.

El formato de aquellas órdenes se conserva allí porque funcionó: **defecto →
orden → aceptación → verificación**, una por sesión, con la regla de escribir
primero la prueba que falla. De los cuarenta hallazgos, el único que se coló sin
prueba previa fue el que abrió END-39.

---

# Parte IV — Cómo se trabaja en este repositorio

## 6. Reglas para Claude Code

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

**R9 · Verifica las condiciones del experimento antes de creerle al resultado.** Ver §7: los cuatro errores de método de esta sesión fueron de aquí, ninguno de razonamiento.

### 7.2 Cuando dos sesiones trabajan a la vez

Ocurrió y produjo una colisión real. Reglas:

- **Una sesión escribe, la otra revisa.** Nunca dos escribiendo sobre el mismo árbol.
- **Cuando el revisor dice «esto está mal», se revierte o se discute.** No se omite en silencio. En esta sesión, la sesión escritora aplicó las dos correcciones que le daban la razón y dejó fuera las dos que decían que se había equivocado; el resultado fue un `AGENTS.md` con una credencial fantasma y una afirmación sin fuente.
- **Cuando un agente diga «X no se usa» o «X vive en Y», pídele el comando y su salida.** Los dos errores de aquel día se detectan con un `grep -rn` y treinta segundos.

## 7. Errores de método cometidos en esta auditoría

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

## 8. Trazabilidad

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
