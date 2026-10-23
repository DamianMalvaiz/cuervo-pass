# Bitácora semanal

Documento maestro v5 · §31 y §35.

Tres líneas cada viernes: qué se logró, qué se atoró, qué decisión se tomó. Más
una métrica, no una sensación: **horas obligatorias terminadas contra
planeadas** (AUD-24 — "vas atrasado" nunca se dispara si el umbral es un
presentimiento).

Si la rúbrica evalúa el proceso y no solo el producto, este archivo es la
evidencia más barata que existe.

---

## Formato

```
## Semana N — <fechas>
- **Logrado:**
- **Atorado:**
- **Decisión:**
- **Horas:** X terminadas / Y planeadas  (acumulado: A / B)
```

---

## Semana 11 — migración a v5

- **Logrado:** se aplicó el documento maestro v5 sobre el proyecto que venía de
  v3. Diez migraciones nuevas (0009–0018), tres Edge Functions, microservicio
  reescrito y la app adaptada al esquema nuevo. Los veintiocho hallazgos de la
  auditoría quedan cubiertos por código, no por promesa.
- **Atorado:** nada bloqueante. Queda pendiente aplicar las migraciones contra
  el proyecto real y correr `supabase test db`, que es lo único que convierte
  "debería funcionar" en "funciona".
- **Decisión:** migraciones **aditivas** en vez de reescribir `0001`. La base y
  los datos de demo sobreviven, y el historial documenta por qué cada cosa
  cambió — que es la mitad del valor de una auditoría.
- **Horas:** — / —

### Pendientes que este cambio deja abiertos

- [x] **Aplicar las migraciones 0009–0018.** Ojo: este repositorio nunca corrió
      `supabase init` ni `supabase link` —no hay `supabase/config.toml`— así que
      `db push` no funciona todavía. Hasta ahora las migraciones se han pegado a
      mano en el SQL Editor, que es lo que dicen sus propias cabeceras. Dos
      caminos, en `docs/aplicar-migraciones.md`.
- [x] `npx supabase test db` — las doce aserciones de `supabase/tests/rls.test.sql`.
- [x] Desplegar las tres Edge Functions y fijar sus secrets (ver
      `supabase/functions/README.md`).
- [x] Marcar el consentimiento de IA de las cuentas de **demo** (el SQL está
      comentado al final de `0018_v5_vectores_obsoletos.sql`). Las cuentas
      reales tienen que marcar la casilla ellas mismas: §29.
- [x] Regenerar los embeddings con el modelo multilingüe:
      `node --env-file=.env scripts/backfill-embeddings.mjs --todos`, con el
      microservicio corriendo. La migración 0018 ya borró los vectores viejos,
      que eran de `all-MiniLM-L6-v2` y producían ruido con apariencia de
      resultado. Hasta regenerarlos, la app funciona en Nivel 1.
- [x] Completar el responsable y el correo de contacto en
      `docs/aviso-privacidad.md`.
- [ ] Retirar la vista de compatibilidad `roomings` (migración 0011) en la
      semana 12, cuando ya no quede ningún APK viejo instalado.

---

## Semana 12 — puesta en marcha de v5 (18/09/2026)

- **Logrado:** v5 dejó de ser código y pasó a estar corriendo. El repositorio se
  enlazó al proyecto real (`supabase link`), las dieciocho migraciones quedaron
  aplicadas **con historial** —no pegadas a mano—, las tres Edge Functions están
  desplegadas con sus secrets, y los 137 embeddings de publicaciones y roomies
  se regeneraron con el modelo multilingüe. Las doce aserciones pgTAP pasan.
- **Atorado:** nada. El único sobresalto fue que la contraseña de la base no era
  recuperable desde el panel y hubo que resetearla; no afectó a la app, que
  entra por PostgREST y nunca usa la conexión directa.
- **Decisión:** camino B de `docs/aplicar-migraciones.md` (CLI) en vez de pegar
  SQL en el editor. Cuesta más la primera vez —`init`, `link`, `migration
  repair`— y a cambio la base queda con historial de migraciones, que es lo que
  permite que `db push` sepa dónde se quedó. Pegar SQL a mano funciona una vez;
  el historial funciona siempre.
- **Horas:** — / —

### Verificaciones que respaldan lo anterior

- **Sin pérdida de datos.** Recuento antes y después: 109 usuarios, 106
  publicaciones, 31 roomies, 1 mensaje, 1 contacto. Ningún `delete` de filas
  huérfanas encontró nada que borrar. Respaldo previo en `respaldos/`.
- **Las migraciones reconstruyen el proyecto desde cero.** `supabase start`
  aplicó las dieciocho sobre una base vacía sin un solo error. El proyecto se
  puede clonar y levantar, no solo parchear.
- **Producción coincide con las migraciones.** `supabase db diff --linked` salió
  vacío salvo por un objeto que instala la propia plataforma (abajo).
- **El túnel no es una puerta abierta.** `POST /generar-embedding` sin el
  `AI_SHARED_TOKEN` devuelve **401**; con él, un vector de **384 dimensiones** y
  norma L2 = 1.0, que es exactamente lo que declaran las columnas `vector(384)`.

### Hallazgos

- **El "Nivel 2" de v3 llevaba tiempo caído.** Los registros del servidor de
  desarrollo mostraban `PGRST202: Could not find the function
  ordenar_por_similitud` en cada arranque. El cliente se tragaba el error y caía
  al orden básico **en silencio**, y en pantalla no se notaba nada. Es el
  argumento entero a favor del `IndicadorNivel` de v5: un modo degradado que no
  se anuncia es indistinguible de uno que funciona.
- **El aviso de privacidad era imposible de leer.** La pantalla de registro
  pedía aceptarlo enlazando a `github.com/cuervo-pass/cuervo-pass` —un
  repositorio que no existe— y, aun con la URL corregida, el repositorio real
  era privado. Se pedía consentimiento informado sobre un documento que daba
  404. Ahora el aviso vive **dentro de la app**
  (`src/app/aviso-privacidad.tsx`), se lee sin red, y
  `src/lib/__tests__/avisoPrivacidad.test.ts` falla si sus secciones dejan de
  coincidir con las de `docs/aviso-privacidad.md`.
- **Producción tiene una red de seguridad que local no tiene.** Supabase instala
  un event trigger `ensure_rls` que activa RLS automáticamente en cualquier
  tabla nueva de `public`. No está en las migraciones porque no es nuestro. El
  problema es la dirección de la divergencia: si una migración futura crea una
  tabla y se olvida el `enable row level security`, producción lo corrige sola
  y **el entorno de pruebas —donde corre el CI— queda más laxo que producción**.
  Regla que se sigue de esto: escribir siempre el `enable row level security`
  explícito, aunque parezca redundante. La red desaparece en cualquier Postgres
  que no sea Supabase.
- **El `.env` de la raíz mezcla cliente y servidor.** Tiene
  `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` y `PERFIL_ENCRYPTION_KEY`
  junto a las `EXPO_PUBLIC_*`. Funciona porque ninguna lleva el prefijo, pero es
  exactamente la mezcla contra la que advierte el comentario de `.env.example`:
  basta un prefijo mal puesto para que una clave de servidor acabe dentro del
  APK. Los scripts de Node leen de ahí, así que separarlo es trabajo de la
  semana 12, no un parche de hoy.

### Endurecimiento de contraseñas y hallazgos del 18/09 (tarde)

- **La contraseña solo exigía seis caracteres, y solo en el teléfono.** La
  validación era `z.string().min(6)` dentro de `registro.tsx`: "123456" pasaba.
  Además zod corre en el cliente, así que quien llamara a la API de Auth
  directamente se la saltaba entera. Ahora hay dos barreras que dicen lo mismo:
  `src/lib/password.ts` (10 caracteres, mayúscula, minúscula, dígito, que no
  contenga el correo/usuario/nombre, que no esté en una lista de conocidas) y
  `minimum_password_length = 10` + `password_requirements` en el proyecto real.
  `password.test.ts` lee `config.toml` y falla si las dos dejan de coincidir.
  Los requisitos ahora se **muestran** y se marcan mientras se escribe, en vez
  de aparecer como error al enviar.
- **`supabase config push` habría apagado el MFA.** El `config.toml` que generó
  `supabase init` trae valores de PLANTILLA, y `config push` empuja todo lo que
  el archivo declara. El diff previo mostró diez ajustes reales que habría
  pisado: `mfa.totp.enroll_enabled` y `verify_enabled` (ambos **true** en el
  proyecto y `false` en la plantilla), `email.otp_length` 8 → 6,
  `email.max_frequency` 1m → 1s, el pooler a la mitad. La solución no fue
  corregir los diez valores sino **dejarlos sin declarar**, porque lo que el
  archivo no declara no se toca. Regla: ante `config push`, correr siempre
  `config diff` antes y leerlo entero.
- **Faltaba la policy de UPDATE de Storage (migración 0019).** La 0002 creó
  INSERT y DELETE para `publicaciones/<uid>/...` pero nunca UPDATE, y
  `subirFotoPublicacion` sube con `upsert: true`. Reemplazar una foto ya subida
  fallaba con error de RLS; subir una nueva funcionaba, que es por lo que nadie
  lo notó. Tres aserciones pgTAP nuevas (13, 14 y 15) lo cubren.
- **`supabase stop` respalda la base local por omisión y la restaura al
  arrancar.** Por eso la primera corrida de la aserción 14 falló: el stack
  levantó el estado anterior a la 0019 en vez de reaplicar migraciones. Se
  arregla con `supabase db reset`. Conviene saberlo: un `test db` después de un
  `stop`/`start` puede estar probando un esquema viejo sin avisar.

### El aviso de privacidad, reescrito frente a la LFPDPPP

Pasó de 9 a 10 secciones. Le faltaban elementos exigidos por el art. 16 y por el
art. 30 del Reglamento: **domicilio** del responsable (una dirección de correo
no cubre la fracción I), distinción entre finalidades **primarias y
secundarias** con el medio para negarse a estas últimas, cláusula de
**transferencias**, procedimiento de **revocación**, **plazos** de 20 y 15 días
hábiles, mención del **INAI**, advertencia sobre **datos sensibles** en el campo
de texto libre, y fecha de última actualización.

Dos decisiones de fondo:

- **Supabase y Anthropic se declaran *encargados*, no terceros.** Tratan datos
  por cuenta nuestra, así que conforme al art. 36 **no hay transferencia** y no
  se requiere consentimiento adicional. Listarlos en una tabla de "con quién se
  comparten", como hacía la versión anterior, daba a entender lo contrario.
- **La sección de seguridad dice la verdad en vez de sonar bien.** Declara que
  las fotos **no** están cifradas de extremo a extremo y explica qué sí las
  protege —bucket privado, enlaces firmados a una hora, cifrado en reposo—
  incluyendo la parte incómoda: mientras un enlace firmado no caduque, funciona
  para quien lo tenga. Y aclara que la contraseña no se cifra sino que se
  **hashea con bcrypt**, que no es lo mismo y es lo correcto. Un aviso que
  exagera sus medidas es una declaración falsa, y `avisoPrivacidad.test.ts`
  ahora verifica que esas afirmaciones sigan ahí.

El domicilio se tomó del sitio oficial del Gobierno del Estado de México
(utvt.edomex.gob.mx/ubicación), no de memoria ni de un directorio de terceros.

### Nota sobre el consentimiento de IA

El `consiente_analisis_ia` de las 109 cuentas se otorgó manualmente el
18/09/2026. **Las 109 cuentas son del propio desarrollador** —cuentas de demo y
pruebas de registro—, no de terceros. Si alguna hubiera sido de otra persona,
otorgarlo en lote habría sido justo lo que la casilla sin premarcar existe para
impedir (§29). Al revisar el motor resultó, además, que el consentimiento ajeno
era innecesario: `sugerencias_con_ranking` solo lee el `perfil_vector` de
`auth.uid()`, y las sugerencias de roomies comparan contra
`roomies.vector_busqueda`, que no depende del consentimiento de nadie.

### El diagnóstico del Nivel 2 (19/09/2026)

Tardó cuatro intentos y el error era mío en dos de ellos. Vale la pena escribirlo
porque el patrón se repite.

**Lo que parecía:** el túnel de Cloudflare caído tres veces seguidas.
**Lo que era:** el DNS de un túnel rápido tarda hasta media hora en publicarse, y
el script lo daba por muerto a los dos minutos — saliendo con error ANTES de
fijar el secret, así que la Edge Function se quedaba apuntando al túnel anterior,
ese sí muerto.

**Segundo error, peor:** al fijar el secret a mano usé `tail -1` sobre un glob de
registros en /tmp. El orden alfabético NO es el cronológico, así que apunté al
túnel muerto teniendo el vivo disponible. Redesplegar la función no arregló nada
porque la instancia nueva leía el mismo valor equivocado.

**Cómo se cerró:** instrumentando en vez de adivinando. Se creó una cuenta
temporal para llamar a `ai-proxy` con una sesión real y ver el código exacto
—503 `{degradado:true}`— en vez del "non-2xx" que reporta la app. Eso descartó la
cuota (límite 200, consumo 4) y probó que la función llegaba hasta el `fetch`.

**Lo que quedó del arreglo:**
- `ai-proxy` clasifica el fallo: `sin-conexion` contra `tiempo-agotado`. Un 503
  mudo no orienta a nadie, y la diferencia entre "no conecta" y "tarda" lleva a
  diagnósticos opuestos. El detalle completo va al registro del servidor porque
  el mensaje de Deno incluye la URL.
- `scripts/tunel.sh` fija el secret ANTES de esperar al DNS, espera diez minutos
  y guarda el dominio vivo en `.tunel-actual`. Rastrearlo por el nombre aleatorio
  del registro fue justo lo que falló.

**Verificado en las tres capas**, no en la pantalla: el microservicio registró la
petición con el id de usuario real y 168 caracteres de texto; la base guardó un
vector de 384 dimensiones con norma L2 = 1.0; la app pasó a Nivel 2.

Los 168 caracteres confirman de paso una decisión del diseño: quien consiente el
análisis pero no escribe texto libre igual obtiene vector, porque
`construirTextoPerfil` arma la descripción con los datos estructurados.

### La palanca del consentimiento, comprobada en vivo (19/09/2026)

El §18 y el §29 dejaron de ser promesas de documento. Ciclo completo ejecutado en
el teléfono y verificado contra la base en cada paso:

| Paso | consiente_analisis_ia | perfil_vector | Nivel en pantalla |
|---|---|---|---|
| Inicial | true | 384 dimensiones | 2 |
| Retirar el consentimiento | **false** | **NULL** | **1** |
| Volver a otorgarlo | true | 384 dimensiones, norma 1.0 | 2 |

Lo que importa del paso intermedio: el vector no se quedó ahí apagado, **se
borró**. Un dato derivado de un consentimiento retirado no tiene fundamento para
seguir existiendo, y la mayoría de las apps se limitan a apagar la casilla. Al
reotorgarlo el vector se REGENERA desde cero, no se recupera, porque ya no
existía — el microservicio registró la segunda petición con el id de usuario real.

Sirve como guion de exposición de treinta segundos, sin diapositivas: enseñar el
Nivel 2, retirar el consentimiento, ver la app seguir funcionando en Nivel 1,
volver a darlo y ver regresar el Nivel 2. Y si lo piden, enseñar la fila de la
base antes y después.

### Tres fallos silenciosos en un día (19/09/2026)

Aparecieron el mismo día, sin relación de causa entre ellos, y con una cosa en
común que vale más que los tres arreglos juntos: **ninguno se anunció**. Los tres
se encontraron ejecutando el camino real, y los tres habrían aparecido en vivo.

**1 · "Ver contacto" no funcionó nunca.** `revelar_contacto` moría con `42P10`:
su `on conflict` apuntaba a `contactos_unico_publicacion`, que es un índice único
**parcial** (`where publicacion_id is not null`), y PostgreSQL no puede inferir un
índice parcial desde una lista de columnas pelada. La función abortaba antes de
escribir nada, así que no quedaba rastro ni en `contactos` ni en `cuotas_uso`. El
índice es parcial a propósito —`contactos` sirve a publicaciones y a roomies—, de
modo que la corrección fue repetir el predicado, no tocar el índice
(migración 0020).

Lo que hay que explicar no es el bug, es el verde: las aserciones 9 y 10 probaban
`consumir_cuota` por separado y pasaban. Nadie llamaba a `revelar_contacto` de
punta a punta. **Probar las piezas no prueba que la función que las usa corra.**

**2 · Un hipo de red borraba el `perfil_vector`.** Las dos pantallas que guardan
el cuestionario no distinguían "retiré el consentimiento" de "el servicio falló":
ambos escribían `null`. Lo primero es intencional y correcto —§29—; aplicarle el
mismo castigo a veinte segundos sin conexión no lo es, y encima en silencio,
porque el fallo solo iba a un `console.warn`. Se encontró una cuenta en
producción con `consiente_analisis_ia = true` y vector nulo: Nivel 2 muerto para
siempre sin un solo aviso.

La regla vive ahora en `src/lib/perfilVector.ts` y tiene **tres** estados. El
tercero devuelve un objeto vacío: PostgREST solo actualiza las claves presentes,
así que omitir la columna deja intacto el vector anterior. El compromiso se
asumió a sabiendas —conservar un vector viejo deja el ORDEN desfasado hasta el
siguiente guardado— y por eso el fallo se avisa en pantalla: cambiar un silencio
por otro no habría sido un arreglo.

**3 · El túnel muerto con el proceso vivo.** `cloudflared` no se cae cuando su
dominio caduca: se queda reintentando para siempre. El `AI_SERVICE_URL` seguía
apuntando ahí y el Nivel 2 caía sin que nada avisara.

### El derecho de cancelación estaba roto (19/09/2026)

El hallazgo más serio de las doce semanas, y el que mejor resume por qué las
pruebas en verde no bastan.

La migración 0016 creó `trg_limpiar_fotos`, que al borrar una publicación hacía
`delete from storage.objects`. Supabase añadió después una barrera que lo
prohíbe: *"Direct deletion from storage tables is not allowed."* El trigger
reventaba, la transacción entera se caía, y con ella todo lo que dependiera de
borrar esa publicación — incluido el borrado en cascada desde `auth.users`.

**Consecuencia:** "Eliminar mi cuenta" devolvía error para cualquiera que hubiera
subido una foto. El aviso de privacidad promete esa pantalla en la tabla de
derechos ARCO, y promete que *"al eliminar tu cuenta todo lo anterior se borra en
cascada, incluidas tus fotos"*. La pantalla existía, el botón estaba ahí, y no
cumplía. Eso no es una molestia de interfaz: es un incumplimiento de la LFPDPPP.

La ironía está escrita en el comentario de la propia migración que lo rompió:
*"la eliminación de cuenta de §29 también limpia el almacenamiento. Eso no es
higiene: es el derecho de cancelación cumpliéndose."*

Se comprobó montando una cuenta con una publicación y una foto y llamando a la
función igual que lo hace la app:

```
antes:   eliminar-cuenta -> FALLO (non-2xx) · la cuenta SIGUE EXISTIENDO
después: eliminar-cuenta -> {"eliminada":true,"fotosBorradas":2} · eliminada
```

**El arreglo (migración 0021)** invierte la responsabilidad. El trigger ya no
borra: **encola** las rutas en `fotos_huerfanas`, una tabla de servicio con RLS y
cero policies, como `cuotas_uso` —son rutas de almacenamiento de otras personas—.
Un trigger que no borra no puede tumbar un borrado. Quitarlas de verdad es
trabajo de quien puede hablar con la Storage API: la función `eliminar-cuenta`,
que ya lo hacía con la foto de perfil.

El coste se nombra en voz alta porque es real: **encolar no borra**. Si nadie
vacía la tabla, los archivos siguen ahí. Se cambia un fallo ruidoso por una deuda
visible. Por eso `verificar.mjs` la mira y existe `limpiar-fotos-huerfanas.mjs`.

Ninguna prueba lo cubría porque ninguna borraba una publicación **con** fotos.
Las aserciones 18 a 21 lo fijan, y la 21 comprueba además que la cola no sea
legible desde el cliente.

### Verificación reproducible en vez de suerte (19/09/2026)

Los tres fallos se encontraron por casualidad. Convertir esa casualidad en una
pregunta que se hace a propósito produjo dos herramientas:

**`node scripts/verificar.mjs`** — diez segundos antes de exponer. Revisa
secrets, el túnel *preguntando por fuera* y no en `localhost`, cuentas con
consentimiento y vector nulo, publicaciones activas sin vector o mal
geocodificadas, la cola de fotos huérfanas, la cadena completa app → `ai-proxy` →
túnel → microservicio, y que `revelar_contacto` y `abrir_conversacion` corran de
verdad y sean idempotentes. Sale con código 1 si algo está roto, y **dice
explícitamente qué no cubre**: un verificador que insinúa más cobertura de la que
tiene es peor que no tenerlo.

**`node --env-file=.env scripts/prueba-rls.mjs`** — la prueba de aislamiento
entre cuentas, aplazada desde la semana 8. Crea dos cuentas temporales con
sesiones reales, comprueba que la primera no puede tocar nada de la segunda, y
las borra. **15 de 15 barreras aguantaron.**

No reemplaza a las 21 aserciones de pgTAP; responde dos preguntas que aquéllas no
pueden. Corre contra **producción**, que no es idéntica al esquema local —tiene un
event trigger `ensure_rls` que instala Supabase y el local no, así que CI valida
un esquema *más laxo* que el real—, y pregunta **por HTTP a través de PostgREST**,
que es el camino de la app; pgTAP habla con Postgres directamente, así que una
vista o un `grant` que expusieran de más se le escaparían.

El detalle que hace que esa prueba valga algo: **RLS casi nunca da error**. En un
`select` devuelve cero filas y en un `update` afecta cero filas, en silencio. Cada
comprobación afirma sobre el *número de filas*, no sobre la presencia de una
excepción. Una prueba que solo mirara `error !== null` pasaría en verde con la
tabla completamente abierta.

### De cero a treinta y una pruebas de pantalla (19/09/2026)

La app tenía diecisiete pantallas y **cero** pruebas de pantalla. Las sesenta y
una existentes cubrían funciones puras y un solo componente. Los tres fallos del
día los encontró el dedo, no la suite.

| Qué cubre | Pruebas |
|---|---|
| Preferencias: el vector no se borra por un fallo, y se avisa | 5 |
| El desplegable de dirección (pasó de `FlatList` a `ScrollView`) | 7 |
| Editar: los ocho campos nacen llenos; la dirección sobrevive intacta | 6 |
| "Eliminar mi cuenta": la pantalla, no solo la función | 5 |
| Humo de seis pantallas: montan y pintan su encabezado | 6 |

De **61 a 92** pruebas, de 6 a 12 suites.

La más importante es la que comprueba que, **si el borrado de cuenta falla, la
app NO navega al login**. Arreglar el backend no sirve de nada si el botón que lo
llama deja a la persona creyendo que ejerció un derecho que no ejerció.

Dos cosas salieron mal y quedan escritas en el código, no escondidas:

- Un renombrado de variables dejó la clave exportada de un doble mal escrita, así
  que el módulo real importaba `undefined`. **Dos pruebas pasaban por la razón
  equivocada**: daban por bueno el camino de fallo porque el doble estaba roto,
  no porque se simulara la caída. El mismo verde engañoso contra el que trata
  toda esta entrada.
- Las pruebas de envío viven en archivo aparte porque, junto a las demás,
  cualquier prueba posterior a un `enviar()` se quedaba sin pintar. Se probaron
  `cleanup()` explícito y drenar microtareas; ninguna lo arregla. Eso **contiene
  el síntoma y no explica la causa**, y así está dicho en el archivo.

Lo que estas pruebas **no** cubren, para no confundirlo: que las pantallas se
vean bien. Eso solo se juzga en un dispositivo.

### Limpieza de datos antes de exponer (19/09/2026)

Doce cuentas de prueba acumuladas entre el 16 y el 19 de septiembre, con una
publicación activa geocodificada en Tabasco a ~600 km de la UTVT. Se borraron con
respaldo previo completo, fuera del repositorio porque contiene correos reales y
el repositorio es público.

Dos cosas que la cascada de Postgres no hace y el script sí: borrar los objetos
de Storage —las rutas salen del arreglo `fotos[]` de cada publicación, que es la
lista autoritativa— y verificar que cada id siga correspondiendo al correo
esperado antes de borrar, abortando sin tocar nada si no.

**Tres de las doce resistieron**, y resultaron ser exactamente las que tenían
publicaciones: fue así como se destapó el fallo del derecho de cancelación. La
limpieza no encontró el bug por listeza, sino por chocar con él.

Estado: 102 usuarios, 104 publicaciones activas, 104/104 con vector,
geocodificación dentro del rango esperado, cola de huérfanas vacía.

### Endurecimiento: siete hallazgos propios, tres críticos (19/09/2026)

- **Logrado:** auditoría de la implementación —no del documento— ejecutando el
  sistema. Treinta y ocho hallazgos propios (END-01 a END-38) en
  [`docs/endurecimiento-v6.md`](endurecimiento-v6.md). Siete remediados en trece
  commits sobre la rama `endurecimiento`. pgTAP 21 → 40, aislamiento contra
  producción 15 → 19, pruebas del microservicio 9 → 16, frontend 92 → 98, y las
  cuatro Edge Functions tipadas **por primera vez**.
- **Atorado:** las cinco migraciones nuevas (0022–0026) siguen **sin aplicar a
  producción**, así que ninguna de las remediaciones protege nada todavía. El
  túnel de Cloudflare estuvo diez minutos sin resolver DNS y quedó abajo.
- **Decisión:** los hallazgos llevan prefijo **END-** y no AUD-. Reusar la
  numeración de v5 haría ambiguo cada uno de los comentarios del código que ya
  la citan.
- **Horas:** — / —

Los tres críticos comparten forma con AUD-01 —dos decisiones correctas por
separado que se contradicen al correr juntas— y los tres eran silenciosos:

1. La migración titulada «storage privado» cambió *cualquiera en internet* por
   *cualquiera con una cuenta*. Comprobado contra producción: una cuenta recién
   creada **descargó los bytes** de la foto de perfil de un usuario dado de baja.
2. El microservicio con `ANTHROPIC_API_KEY` dentro, expuesto por un túnel
   público, **no autenticaba a nadie** en la ruta de arranque del README. Lo
   delataba la propia suite: cuatro pruebas llamaban sin cabecera y esperaban
   200, así que pasaba *gracias* al fallo.
3. «Reportar usuario» insertaba la fila, mostraba «Gracias», y el trigger salía
   con `return new`. Nunca hizo nada. Es AUD-16 otra vez, en la ruta de
   seguridad personal.

Lo que esta entrada deja escrito para el futuro, porque es el patrón y no el
incidente: **la documentación de este repositorio describe un sistema distinto
al construido**, no por descuido en la prosa sino por una asimetría entre
afirmar y verificar. `DESIGN.md` tiene 27 KB y la capa de servicios tenía 0 % de
cobertura. Se midieron doce pares de contraste de texto a mano y ninguna
superficie contra superficie — la que falla, con razón **1.00**.

Y cuatro errores de método de la propia auditoría quedan registrados en su §8.
Los cuatro se detectaron ejecutando, ninguno leyendo; tres no fueron de
razonamiento sino de no validar las condiciones del experimento. El peor: un
`grep` terminado en `| grep -v ".venv"` se comió la única línea que refutaba una
afirmación, y sobre esa premisa falsa se revirtió un commit correcto.

### Fase 0 aplicada, y cinco órdenes del plan (19/09/2026 · tarde)

- **Logrado:** las cinco migraciones del bloque crítico aplicadas a producción
  con respaldo previo, `pg_cron` activo, los dos secretos de Vault puestos y el
  barredor desplegado y probado de punta a punta. **19 de 19 barreras** contra
  producción, que es la compuerta que cierra la Fase 0. Después, cinco órdenes
  del §5: B.1, B.2, B.4, C.1, C.2 y E.2.
- **Atorado:** dos barreras de seguridad reportaban `[ EXPUESTO ]` con la
  remediación aplicada y funcionando. Costó media hora descartar policies,
  vistas y permisos antes de encontrar que el problema era la prueba.
- **Decisión:** ninguna orden se cerró sin su prueba en rojo primero. Las seis
  lo tuvieron, y dos de esos rojos —`have: 2 want: 5` y `have: 3 want: 1`— son
  la evidencia más barata de que el defecto era real y no una interpretación.
- **Horas:** — / —

**Compuertas antes y después de esta tanda:**

| | Antes | Después |
|---|---|---|
| pgTAP | 40 | **51** |
| Aislamiento contra producción | 15 (4 fallando) | **19 de 19** |
| Frontend | 98 | **144** |
| Migraciones en producción | 0021 | **0029** |

#### Las dos barreras que medían la caché, no la policy

El hallazgo más instructivo del día, y va contra una prueba nuestra.

Tras aplicar la `0022`, `prueba-rls.mjs` insistía en que una cuenta cualquiera
seguía descargando la foto de una publicación desactivada. Se descartó una por
una: las policies de `storage.objects` son correctas e **idénticas** en local y
producción, la permisiva de la `0016` ya no existe, `publicaciones_publicas`
filtra por `activa`, `perfiles_publicos` por `activo`, y el bucket es privado en
ambos entornos.

El experimento que lo cerró: con la publicación ya desactivada, la ruta hermana
`1.jpg` —**nunca pedida**— quedó bloqueada, mientras `0.jpg` —pedida cuando era
visible— seguía descargando. Storage servía la segunda petición desde caché y
**la policy no llegaba a evaluarse**.

La prueba pedía la misma ruta antes y después de ocultar el objeto. Ahora cada
barrera negativa usa una ruta fría; para la foto de perfil, cuya ruta es fija
por persona, la ruta fría es la de una cuarta cuenta.

Es el §8 del documento de endurecimiento aplicado al script que ese documento
produjo: **verifica las condiciones del experimento antes de creerle al
resultado**. Y una prueba de seguridad que grita sin motivo acaba ignorada, que
es peor que no tenerla.

#### Lo que cambió para quien usa la app

- **END-08** · El motor devolvía solo las publicaciones vectorizadas y el
  servicio daba eso por «Nivel 2» con que hubiera una sola fila. Medido en
  producción: una cuenta sin vector propio recibía **cero** sugerencias del
  motor y ahora recibe **diez**, las mismas que siempre pasaron el filtro duro.
  El error era de granularidad: lo que degrada cuando falta un embedding es el
  ORDEN de una fila, no la EXISTENCIA de la lista. El kicker deja de ser una
  bandera y dice «12 DE 20 CON AFINIDAD SEMÁNTICA», que además demuestra en vez
  de afirmar.
- **END-09** · El score de mascotas restaba 0.125 a los alojamientos *pet
  friendly* de quien **no** tiene mascota, al revés de lo que su propio
  comentario afirmaba treinta líneas más abajo. Afectaba a **62 de 102** cuentas
  y a las 29 publicaciones que aceptan mascotas.
- **END-11** · El peor mensaje que tenía la app: un fallo de red hacía que la
  ficha dijera «pudo desactivarse u ocultarse tras varios reportes». Se caía el
  wifi y la app **acusaba de abuso** al anuncio de otra persona. Y en el perfil
  propio, «Sin presupuesto · Sin distancia · Sin universidad» a quien acababa de
  llenar el cuestionario.
- **END-12** · Un error de render en release era **pantalla blanca**. Ahora hay
  `ErrorBoundary` con reintento, y los 21 `console.warn` —invisibles en un build
  de release— pasan por `src/lib/registro.ts`, que limpia en profundidad lo que
  §29 no deja salir del teléfono.
- **END-13** · Reabrir cinco publicaciones cinco veces agotaba las 25 cuotas
  diarias **usando la app con normalidad**. Verificado en producción: tres
  revelaciones del mismo contacto consumen **una**.

#### Dos errores propios de esta tanda

Se registran por la misma razón que los cuatro del §8 del documento: un registro
que solo guarda los aciertos no sirve para aprender de él.

1. **La transformación de E.2 rompió una suite entera y casi pasa
   desapercibido.** Metió un `await` dentro del callback no-async de un
   `waitFor` multilínea. `tsc` lo marcó, pero lo que de verdad lo delató fue que
   el TOTAL DE PRUEBAS bajó de 144 a **137**: esa suite dejó de compilar y la
   salida seguía diciendo *passed*. **Mirar el color y no el número deja
   desaparecer siete pruebas sin que nadie lo note.**
2. **Se contó mal un `plan()` de pgTAP** —cinco aserciones declaradas como
   cuatro—, que es exactamente el tipo de error que `plan()` existe para
   atrapar. Lo atrapó.

#### Lo que se decidió no hacer, y por qué

- **Sentry no se instaló.** Es un módulo nativo y obliga a reconstruir el dev
  client a días de exponer. El gancho queda puesto (`registrarSumidero`): son
  diez líneas el día que se decida, y cero en los 21 sitios que registran. El
  `ErrorBoundary` ya elimina el fallo catastrófico; Sentry solo añade telemetría
  que nadie va a mirar esa tarde.
- **`expo-clipboard` tampoco**, por lo mismo. El botón «Compartir detalle» usa
  `Share`, que ya viene en React Native y además permite mandarse el error por
  WhatsApp.
- **`barrer-fotos` se quedó sin CORS**, al contrario que las otras tres
  funciones. La llama `pg_cron` vía `pg_net`, nunca un navegador: abrirla no
  habilita ningún caso de uso y sí amplía su superficie. Queda escrito en el
  propio archivo para que nadie «arregle» la inconsistencia.
- **No se editó el comentario de la `0015`** que la orden B.2 pedía corregir.
  Editar una migración ya aplicada está prohibido por el invariante 6, y además
  ese comentario nunca fue falso: describía el filtro duro, que siempre estuvo
  bien. Lo que estaba mal era el score, que ahora por fin lo obedece.

### La capa de datos, el chat y cuatro órdenes de diseño (19/09/2026 · noche)

- **Logrado:** siete órdenes más — C.3, C.4, D.1, D.2, D.3, D.4 y D.7. La app
  gana una capa de datos con caché, el chat deja de perder mensajes, y tres
  reglas de diseño que el repositorio declaraba y violaba pasan a ser
  compuertas que corren en CI.
- **Atorado:** nada bloqueó. Lo que costó tiempo fueron dos peleas con el arnés
  de pruebas, ambas registradas abajo porque se van a repetir.
- **Decisión:** ninguna orden se cerró sin su prueba en rojo primero, incluidas
  las de diseño. Un verificador de contraste que solo se comprueba «en verde»
  pasaría igual si no mirara nada.
- **Horas:** — / —

| Compuerta | Antes | Ahora |
|---|---|---|
| Frontend | 144 | **199** |
| pgTAP | 51 | **55** |
| Contraste | **ninguna** | script en CI |
| Objetivos táctiles | **ninguna** | script en CI |
| Tokens de diseño | prosa en AGENTS.md | regla de ESLint |

#### El chat perdía mensajes, y eso no es rendimiento

**END-16** · `listarConversaciones` pedía **1200 mensajes** para resolver treinta
hilos y los plegaba en JavaScript, en el mismo archivo cuyo encabezado acusa a
v3 de «traerse TODOS los mensajes y agruparlos en JavaScript». Y no era solo
coste: el orden de esa ventana es global, así que **un chat activo escondía el
último mensaje de los tranquilos**, que aparecían como si estuvieran vacíos.
Ahora son dos `left join lateral` en Postgres: treinta hilos, treinta filas.

**END-20** · El cursor de paginación era solo `creado_en`. Dos mensajes con la
misma marca de tiempo —dos personas escribiendo a la vez— hacían que **uno
desapareciera** al paginar: el primero cerraba la página y el segundo caía fuera
del `<`. Un mensaje perdido en un chat no es un fallo de rendimiento: **es la
app borrando algo que alguien escribió.** El cursor pasa a ser el par
`(creado_en, id)`, que sí es único.

Y el envío se vuelve optimista. Si falla, **el texto ya no vuelve al campo**: la
burbuja se queda en su sitio marcada como fallida, con reintento al tocarla.
Devolverlo al campo se lee como que el mensaje se borró, cuando la persona ya lo
había mandado.

#### Tres reglas que el repositorio declaraba y violaba

Las tres tenían la misma forma: una afirmación escrita en un documento, sin
nada que la comprobara.

**END-29 · El bloque destacado era invisible.** `theme.ts` afirmaba que «todos
los contrastes de este archivo están medidos, no supuestos». Era verdad a
medias, y la mitad que faltaba era la que fallaba: se midieron doce pares de
TEXTO sobre fondo y **ninguna superficie contra superficie**. El «lavado del
sello» daba **1.00** contra el papel — la misma luminancia exacta. Un cambio de
matiz con cero cambio de valor: desaparece bajo el sol, con reflejo, en escala
de grises y para alguien con daltonismo.

El umbral de superficie **no existe en WCAG**, y por eso ese par se escapó. WCAG
cubre texto y bordes de control; nadie mide superficie contra superficie porque
ninguna norma lo pide.

**END-35 · Objetivos táctiles bajo el propio estándar.** El invariante 8 dice
«44×44 pt, sin excepciones» y llevaba semanas escrito. Había **cinco controles
por debajo**: 30, 32, 36, 38 y 40 pt.

**END-31 · Deuda de tokens.** El invariante 7 prohíbe `fontSize` y `fontFamily`
sueltos, y había 29 apariciones. Al encender la regla de ESLint salió el
hallazgo de fondo: **la mayoría no eran descuido.** Eran estilos de `TextInput`,
y a un TextInput no se le puede aplicar `ThemedText` — no tenían alternativa,
porque la escala tipográfica vivía DENTRO de `themed-text.tsx` y el tema no la
tenía para ofrecerla. Movida a `Texto` en `theme.ts`, la deuda bajó a **cero** y
`themed-text` dejó de ser excepción: era la única que existía por una limitación
del propio sistema y no del entorno, así que era la única que se podía eliminar
en vez de nombrar.

#### La cifra que afirmaba de más

**END-30** · «AFINIDAD 9.4», en `Archivo_900Black` a 56 px, dentro de una
casilla que imita un kardex universitario. Tres problemas apilados:

1. **Precisión fabricada.** El número es `0.6 × score + 0.4 × similitud`, una
   mezcla ponderada de cuatro heurísticas normalizadas a mano. No tiene una
   décima de resolución: 8.7 y 8.6 son ruido entre sí. Ahora redondea a medios
   puntos — veintiún valores en vez de ciento uno.
2. **Significado falso.** Por el término de presupuesto, lo más barato siempre
   gana: un «9.4» significaba *barato y cerca*, no «excelente departamento». La
   etiqueta pasa a **AJUSTE**.
3. **Autoridad prestada.** Una calificación de kardex es un número *ganado y
   auditable*, y la metáfora le prestaba a este una credibilidad que no tiene, a
   alguien que elige dónde va a vivir sin haber visto el lugar. Bajo la casilla
   van ahora sus razones —`1.2 km · $500 bajo tu tope · afinidad 0.87`—, y en el
   detalle: *«Este ajuste compara tus filtros con lo publicado. No verificamos
   el inmueble.»*

Una cifra con su desglose al lado se puede **discutir**, y eso es lo que
distingue una recomendación de una sentencia.

#### La densidad contradecía el posicionamiento

**END-33** · La ficha medía 420–450 px: **una tarjeta y media por pantalla**. Y
`PRODUCT.md` dice «Airbnb ordena por deseo […] esto ordena por ajuste». El
ajuste se evalúa comparando, y comparar exige ver varias opciones a la vez. La
fila nueva mide 132 px y pone las tres cifras en columnas de ancho fijo con
`tabular-nums`, para que formen columna al recorrer. La ficha grande se conserva
para «Mis publicaciones», donde la pregunta es «cómo va la mía» y no «cuál de
estas».

#### Dos peleas con el arnés, registradas porque se repiten

1. **Una prueba que llama a `unmount()` deja sin pintar a todo render posterior
   del mismo archivo.** Comprobado: aislada pasa, en medio hace fallar a las
   tres siguientes, movida al final pasan las siete. Esto explica además el
   misterio de `FormularioPublicacion`, donde hubo que partir las pruebas de
   envío a otro archivo sin entender por qué: aquel archivo tiene
   `afterEach(cleanup)`, que es un unmount explícito.

2. **Declarar `transform` en `package.json` REEMPLAZA el del preset de Expo.**
   Al intentar añadir una entrada para `.mjs`, `.ts` y `.tsx` dejaron de
   transformarse y cuatro suites fallaron con «Jest failed to parse a file», que
   no menciona la causa por ningún lado. Spreadear el preset tampoco sirve:
   rompe sus rutas internas.

#### Tres cosas que el linter encontró y una prueba no habría encontrado

Vale la pena registrarlo porque contradice la intuición de que las pruebas son
la única red:

- Al migrar la lista a la fila nueva, una variable quedó huérfana — y esa
  variable era la que alimentaba la línea del «porqué» que D.2 acababa de
  añadir. **Media orden anterior se deshacía sin que ninguna prueba fallara.**
- Catorce archivos dejaron de importar `Tipografia` tras D.3, lo que confirmó
  que ya no tocan las tipografías crudas en absoluto.
- Un `useState` colocado después de un `return` temprano en `_layout.tsx`
  —añadido al montar el provider de react-query— es un error de reglas de hooks
  que ninguna prueba de esta suite habría detectado.

#### Lo que sigue sin poder comprobarse aquí

La orden D.4 pide verificar **en un dispositivo** que caben al menos cuatro
filas. Está comprobado por aritmética —132 px más 8 de separación sobre 800 px
útiles dan cinco—, no con un teléfono en la mano. Ningún agente puede hacer eso,
y confundir una cosa con la otra es exactamente el defecto que §0.2 del
documento de endurecimiento imputa al proyecto.

### Primera pasada en dispositivo tras el bloque D (19/09/2026 · noche)

- **Logrado:** el rediseño se probó en el teléfono, con el túnel arriba y Nivel 2
  vivo. Confirmado por quien lo usó: las sugerencias son filas y **caben cuatro
  por pantalla**, la calificación dice AJUSTE en medios puntos, el desglose
  aparece al abrir una ficha —sin depender de por dónde entres— y el envío de
  mensajes pinta la burbuja al instante.
- **Atorado:** nada. Pero la segunda pasada, con el tamaño de letra del sistema
  al máximo, **no se hizo**.
- **Decisión:** D.4 se da por cerrado —su aceptación pedía «al menos 4 filas» y
  hay cuatro— y **D.6 NO**. `PRODUCT.md` sigue diciendo «implementado, sin
  verificar en dispositivo» para el escalado de fuente, y
  `docs/prueba-escalado.md` sigue diciendo «sin ejecutar». Dar por buena una
  promesa de accesibilidad con un «se ve bien» de la pasada normal sería
  exactamente el defecto que §0.2 del endurecimiento imputa a este repositorio.
- **Horas:** — / —

Un apunte de método que costó un susto: al correr `verificar.mjs` para dejar el
terreno listo, reportó FALLO en `revelar_contacto` sobre una función que estaba
perfectamente bien. La migración `0031` le había quitado el parámetro `p_score`
—porque la métrica la dictaba el cliente— y el propio verificador seguía
llamándola con él. **Cambiar la firma de una RPC obliga a revisar todo lo que la
llama, y los scripts de verificación son llamadores como cualquier otro.**

De paso, el conteo de aserciones de pgTAP pasó a leerse del archivo de pruebas:
decía «37» cuando ya eran 59. Un verificador que miente sobre su propia
cobertura es peor que uno que calla.

### Seis órdenes: el servidor recupera lo que el cliente dictaba (19/09/2026 · madrugada)

- **Logrado:** C.5, C.6, C.7, D.6, E.4 y B.6. Cuatro de las seis quitan una
  decisión de las manos del cliente y la devuelven al servidor, que es de lo que
  iba media auditoría sin haberlo dicho así.
- **Atorado:** nada bloqueó. Lo que sí apareció fue un agujero de secretos en
  `main` que ninguna de las seis órdenes buscaba; queda abajo.
- **Decisión:** las dos migraciones —`0032` y `0033`— se escribieron con su
  prueba pgTAP en rojo primero, y la `0033` se verificó contra **producción**
  con una medición que podía salir mal, no con una que solo podía confirmar.
- **Horas:** — / —

| Compuerta | Antes | Ahora |
|---|---|---|
| Frontend | 199 | **217** |
| pgTAP | 55 | **64** |
| RLS contra producción | 19/19 | 19/19 |
| Acciones de CI pineadas por SHA | 0 de 16 | **16 de 16** |

#### El hilo común: quién tiene la autoridad

Tres órdenes distintas resultaron ser la misma falla en tres capas:

- **C.5** — la calificación viajaba como parámetro de ruta y se escribía en
  `contactos.score_mostrado`. La métrica que el producto presenta **la
  suministraba el medido**: cualquiera con la anon key registraba el número que
  quisiera. Ahora la fórmula vive en `score_ajuste(...)`, en un solo sitio, y la
  aserción 56 afirma que `afinidad_de` y `sugerencias_con_ranking` devuelven el
  mismo valor — si alguien vuelve a copiar la fórmula, esa igualdad se rompe.
- **C.6** — la app distinguía «llegaste a tu límite» de «falló la red»
  buscando subcadenas en el mensaje de Postgres. El diagnóstico incómodo no era
  la pereza sino que **no había código que leer**: las dos excepciones propias
  usaban `check_violation`, el mismo que devuelve cualquier CHECK de cualquier
  tabla. La `0032` les da uno (clase `CP`). Con subcadenas, un «no hay cuota de
  disco en el servidor» habría hecho que la persona leyera que agotó su cupo
  diario.
- **B.6** — `sugerencias_publicaciones` devolvía 384 flotantes por fila que
  ninguna pantalla lee. Medido antes de tocar nada: **4 697 bytes por fila, el
  85 % del payload**; ~138 KB por refresco a 30 filas.

Las otras dos no son de autoridad sino de tiempo y de personas: **C.7**, las URLs
firmadas caducaban a la hora y se pedían una sola vez —una app abierta más de
sesenta minutos se quedaba sin ninguna foto y no se recuperaba nunca—, y **D.6**,
el escalado de fuente que `PRODUCT.md` prometía y que tenía cero usos en todo el
código.

#### Tres tipos que no verificaban nada

`PublicacionSugerida` **nunca declaró** `vector_embedding`. La orden B.6 pedía
«ajusta el tipo» y no había nada que ajustar: el tipo ya mentía por omisión.
`tsc` dejó pasar 4,7 KB por fila durante meses porque la interfaz lleva
`[key: string]: unknown`, y ese índice está en casi todas las de
`database.types.ts`. Es un agujero sistemático, no un caso.

La segunda fuga, que la auditoría no listaba: `obtenerPublicacionPublica` hacía
`select('*')` sobre `publicaciones_publicas`, y esa vista **sí** expone el
vector, porque el ranking lo necesita del lado del servidor. Quitarlo de las
sugerencias y dejar el asterisco habría movido la fuga a la pantalla que más se
abre. Al enumerar las columnas hay que hacerlo en **un literal de una pieza**:
partido con `+`, supabase-js no puede leerlo en tiempo de compilación y `data`
degrada a `GenericStringError` — 31 errores de tsc que no nombran la causa.

#### La verificación que podía salir mal

Para la `0033` no bastaba medir que el payload bajó: eso lo confirma cualquier
cosa. Lo que había que comprobar es que el `left join lateral` por id trae **la
fila correcta**, no una cualquiera. Se le copió a una cuenta desechable el vector
de una publicación real de producción: esa publicación salió con similitud
**exactamente 1**, ninguna otra la alcanzó, y 30 de 30 filas siguieron en Nivel
2. La cuenta se borró al terminar.

#### 211 + 9 no da 217

El mensaje del commit de C.6 dice «nueve pruebas». El archivo tiene **seis**
bloques `it(`, y el total medido pasó de 211 a 217. Los totales son reales —se
comprobaron corriendo la suite en los dos commits—; el «nueve» era mío y estaba
mal. Se registra porque es la misma clase de defecto que §0.2 imputa al
repositorio, esta vez en un mensaje de commit: **un número escrito a mano no es
una medición, aunque lo escriba quien acaba de medir.**

De paso, el mismo hábito destapó que `AGENTS.md` decía «la siguiente migración es
la **0022**» cuando la última aplicada era la **0033**. Un contador a mano que
hay que actualizar en cada migración y que nadie actualizó doce veces seguidas.
Se sustituyó por el comando que lo consulta.

#### CI dejó de confiar en referencias móviles

`ci.yml` explicaba con detalle por qué `npm ci` y no `npm install`, y dos jobs
más abajo usaba `aquasecurity/trivy-action@master` **en el job de seguridad** y
un `curl … install.sh | sh` desde la rama `main` de otro proyecto, con escritura
en `/usr/local/bin`, dentro del job que produce el inventario de seguridad.

El hallazgo que más sorprende: `supabase/setup-cli@v1` **no es una etiqueta, es
una rama**. Comprobado con la API de GitHub — `git/ref/tags/v1` devuelve 404 y
`git/ref/heads/v1` devuelve un SHA. Se veía exactamente igual que una versión
fijada y no lo era.

Dieciséis acciones pineadas por SHA, cada una anotada con la etiqueta que
representa: un SHA sin su etiqueta al lado es imposible de auditar de un vistazo.
Y `npm audit --audit-level=high` en el frontend, porque Trivy miraba la imagen
del microservicio y **nadie miraba `node_modules`**, que es donde vive la mayor
parte del código de terceros que acaba en el APK. El umbral es `high` y no
`moderate` a propósito, y queda escrito por qué: hoy hay 14 moderadas, todas
transitivas de Expo, que no se corrigen sin salir del SDK 57; con `moderate` el
job nacería en rojo permanente, y una compuerta siempre roja se acaba apagando.

#### Un agujero de secretos que sigue abierto en `main`

Apareció por accidente, al volver de un `git checkout` para contar pruebas:
`.env.server` sale como **no ignorado** en `main`. La línea que lo ignora existe
solo en la rama `endurecimiento`. Ese archivo tiene la `SUPABASE_SERVICE_ROLE_KEY`
y **el repositorio es público**, así que un `git add -A` hecho desde `main`
publica la llave que se salta toda la RLS.

Comprobado antes de alarmar:

```bash
git log --all --oneline -- .env.server     # vacío: nunca se commiteó
git log --all -S 'SUPABASE_SERVICE_ROLE_KEY='   # solo plantillas vacías
```

Nunca ocurrió. El riesgo se cierra solo cuando `endurecimiento` se fusione a
`main`; **hasta entonces, no hacer `git add -A` desde `main`.**

### El filtro que no filtraba, y el revoke que no revocaba (19/09/2026 · madrugada)

- **Logrado:** B.3 y B.5, más una corrección de datos y un arreglo de seguridad
  que ninguna orden pedía.
- **Atorado:** nada. Pero las dos órdenes de esta tanda destaparon defectos
  MAYORES que las órdenes mismas, y las dos veces por el mismo mecanismo: una
  compuerta que empezó a funcionar enseñó lo que llevaba tapando.
- **Decisión:** el arreglo de seguridad se hizo de inmediato y antes que
  cualquier cosa de diseño. Dos agujeros explotables con la anon key y sin
  herramientas no esperan a que toque su turno en un plan.
- **Horas:** — / —

| Compuerta | Antes | Ahora |
|---|---|---|
| pgTAP | 64 | **78** |
| Frontend | 217 | **219** |
| RLS contra producción | 19/19 | 19/19 |
| Migraciones aplicadas | 0033 | **0036** |

#### B.3 · El chip pedía un tipo que no existe

`inicio.tsx` filtraba por tipo en el CLIENTE, sobre el top-30 que Postgres ya
había truncado: si en esos treinta no caía ningún cuarto, la app decía «SIN
REGISTROS DE ESE TIPO» habiendo cincuenta. Es el invariante 5 al revés.

La migración `0034` mete `p_tipo` en la función INTERNA, la que trunca. Ponerlo
en la envoltura habría seguido truncando antes de filtrar y el defecto habría
sobrevivido con otra ropa.

Dos cosas vivas que la orden no nombraba:

- **Los chips llevaban sin filtrar nada desde C.3.** Metí el tipo en la
  `queryKey` y dejé `queryFn: () => obtenerSugerencias(30)` ignorándolo. Cada
  chip estrenaba su cubo de caché y pedía lo mismo. **Una clave que distingue lo
  que la consulta no distingue reparte el mismo resultado en cubos distintos y
  parece que funciona** — por eso pasó la prueba en dispositivo de la noche
  anterior.
- **El chip mandaba `'casa'`, y ese valor no existe.** El formulario, el enum de
  zod, `TipoPublicacion`, la ficha y el CHECK de la `0010` dicen todos
  `'casa_compartida'`. `inicio.tsx:38` era el único sitio del proyecto que decía
  otra cosa, y sobrevivió porque el arreglo estaba tipado `string | null`. Al
  mandarlo al servidor habría devuelto vacío **para siempre**. Ahora es
  `TipoPublicacion | null` y lo atrapa el compilador.

#### Lo primero que hizo el filtro al funcionar fue enseñar que los datos mentían

Las 104 publicaciones estaban etiquetadas `depa`. No por descuido: la migración
`0010` añadió la columna `tipo` sobre una tabla que ya tenía filas y las marcó en
bloque con `set tipo = 'depa' where tipo is null`, que era lo único que podía
hacer. Pero eso dejó publicaciones cuya propia descripción dice «Cuarto amplio,
baño compartido» o «Casa con jardín» marcadas como departamento.

Nadie lo vio en un año **porque el filtro corría en el cliente y, desde C.3, no
corría en absoluto**. Una compuerta que no corre no es que pase: es que no mide.

`scripts/corregir-tipos-demo.mjs` no adivina. Las ocho descripciones de
producción corresponden 1:1 con las PLANTILLAS de `seed-demo.mjs`, que ya traen
su tipo escrito, y el script usa ese catálogo como tabla de equivalencias.
Inferirlo por palabras sueltas sería exactamente lo que el comentario de ese
archivo condena. Una descripción fuera del catálogo se deja intacta y se
reporta.

Resultado: `depa 56 · cuarto 41 · casa_compartida 7`, y después de sembrar diez
casas cerca de la UTVT, `casa_compartida 17`. El chip pasó de **1 fila a 11**.

#### B.5 · El encabezado decía «en cola» y no había ninguna

`geocodificar/index.ts` presentaba la cola como una de las tres obligaciones que
la ODbL impone a cambio de permitir ALMACENAR coordenadas. No existía: solo
caché. La única serialización era un `for` del cliente que **ni siquiera
esperaba entre vueltas**, y aunque hubiera esperado, dos teléfonos a la vez
duplicaban el ritmo igual — Nominatim ve una sola IP, la de Supabase.

La `0035` reparte turnos con un `update ... returning` atómico. La base **no
duerme**: devuelve los milisegundos que faltan y espera la Edge Function, que es
efímera. Un `select ... for update` con `pg_sleep` dentro habría sido más corto
de leer y habría retenido una conexión del pool por cada espera.

Medido tras desplegar, tres geocodificaciones simultáneas: **1167 / 2616 / 3334
ms**.

#### El hallazgo de la tanda: `revoke ... from public` no revocaba nada

La aserción 72 de la `0035` fue la primera del proyecto que **comprobaba** un
revoke en vez de escribirlo, y falló. Supabase concede EXECUTE a `anon` y
`authenticated` de forma **explícita** en la ACL de cada función nueva, y
`revoke from public` no las toca porque no vienen de PUBLIC. Doce migraciones
llevaban ese revoke creyendo que cerraba algo.

Dos cosas explotables **en producción**, con la anon key y sin herramientas:

- **`devolver_cuota('revelar_contacto')` decrementaba la cuota del propio
  llamante.** Veinticinco llamadas la devolvían a cero y permitían revelar
  veinticinco teléfonos más. En bucle, la base de teléfonos entera: justo el
  scraping que AUD-04 existe para impedir. Lo abrió B.4 al concederla a
  `authenticated`, que la necesitaba porque `ai-proxy` la llamaba con el token
  del usuario.
- **`afinidad_de_para` aceptaba el uuid de cualquiera.** El commit de la `0031`
  dice que separarla de su envoltura «es lo que impide pedir la afinidad de OTRA
  persona». No impedía nada, y por partida doble: estaba concedida, y
  `afinidad_de` era `security invoker`, así que llamaba a la interna **con la
  identidad del cliente** y el cliente NECESITABA poder ejecutarla. **Una
  envoltura invoker no encapsula nada.**

Menores del mismo origen: `barrer_fotos_programado`, `limpiar_cuotas_antiguas`,
`enviar_notificacion_push` —destinatario, título y cuerpo arbitrarios— y ocho
funciones de trigger.

La `0036` cierra TODO con un bucle sobre `pg_proc` y abre por lista blanca. De lo
que se cierra hay que acordarse de ampliar la lista; lo que se abre se revisa
entero cada vez que se lee.

#### Y mi propio arreglo estuvo a medias, por la misma razón que el error

Añadí `alter default privileges ... revoke execute from anon, authenticated` y
la aserción 76 siguió en rojo. PostgreSQL concede además a **PUBLIC** de fábrica,
y ahí el revoke de default privileges **no funciona**. Medido aislado: con el
revoke aplicado y el catálogo diciendo `{postgres=X,service_role=X}`, la función
recién creada seguía naciendo con `{=X/postgres,...}`. Se descartó que hubiera un
event trigger reconcediendo.

Lo atrapó la prueba, no la lectura. Por eso la garantía no es esa línea sino la
**aserción 75**: una lista blanca de lo ejecutable por `authenticated` que se
rompe sola en cuanto aparece una función de más. Los tres auxiliares del propio
archivo de pruebas se revocan también, para que la lista no tenga excepciones —
**una lista blanca con excepciones es donde acaban escondiéndose las de verdad.**

#### Tres comandos documentados que no podían funcionar

Aparecieron al correrlos, no al leerlos:

- `backfill-embeddings.mjs` respondía **401**. Lee `AI_SHARED_TOKEN`, que vive
  solo en `ai-service/.env`, y la invocación documentada carga `.env` y
  `.env.server`. Sin el token, `...(tokenCompartido ? { Authorization } : {})`
  omite la cabecera y manda la petición sin autenticar. El servicio la rechaza
  —falla cerrado del lado correcto— pero el script no dice por qué.
- `prueba-rls.mjs`, tal como lo documentaba AGENTS.md, **revienta al arrancar**:
  sin `.env.server` no hay service role key. Y decía «15 barreras» cuando son 19.
- Con el backfill corriendo se arregló de paso la cuenta **«Mit»**, que consentía
  análisis de IA y no tenía `perfil_vector`: sus sugerencias salían en Nivel 1.

Los tres están corregidos en AGENTS.md, y esta vez **corridos antes de
escribirlos**. Es el mismo defecto que §0.2 imputa al repositorio, en el archivo
que dicta cómo se trabaja aquí.

#### Lo que sigue sin poder comprobarse aquí

Unsplash respondió **429** al sembrar las diez casas y se quedaron sin foto. El
script aborta en vez de repetir la misma imagen ocho veces, que es lo correcto.
`verificar.mjs` gana el aviso que lo dice: descubrirlo durante la exposición no
tiene arreglo y resolverlo antes es un comando.

### El bloque D, el bloque E, y el final del documento (20/09/2026)

- **Logrado:** D.5, D.8, D.9, D.10, D.11, D.12, E.1, E.3, E.5 y E.6. Con esto
  **el documento de endurecimiento queda cerrado**: los 38 hallazgos, atendidos.
- **Atorado:** nada. Tres veces el trabajo destapó que una compuerta llevaba
  tiempo midiendo otra cosa, y esa es la línea que une toda la tanda.
- **Decisión:** en tres órdenes me aparté de la letra del documento y lo digo en
  cada caso, porque seguirlo al pie habría reintroducido un defecto que la orden
  anterior acababa de quitar.
- **Horas:** — / —

| Compuerta | Antes | Ahora |
|---|---|---|
| Frontend | 219 | **296** |
| Microservicio (pytest) | 16 | **20** |
| pgTAP | 82 | 82 |
| Cobertura, medida honestamente | *no existía* | **51 % con trinquete en CI** |
| `expo-doctor` | 8 paquetes desalineados | **21/21** |

#### Lo que une la tanda: tres compuertas que medían otra cosa

No estaban rotas. Estaban midiendo algo distinto de lo que su nombre decía, que
es peor, porque una compuerta rota se nota.

- **La cobertura decía 66.9 % y era 45.8 %.** Jest solo instrumenta los archivos
  que ALGÚN test importa: lo que no tiene pruebas no baja el porcentaje,
  desaparece del cálculo. Tres de los cuatro servicios no figuraban en el
  informe. **El número mejoraba al no escribir pruebas.**
- **El microservicio llevaba horas sirviendo código viejo.** Respondía, el modelo
  estaba cargado, `/listo` decía «ok». Se midió ese proceso y se concluyó que un
  fallo ya corregido seguía abierto: verificar produjo una conclusión falsa.
- **`revoke ... from public` no revocaba** —esto fue en la tanda anterior, pero
  es el mismo patrón— y lo destapó la primera aserción que COMPROBABA un revoke
  en vez de escribirlo.

El denominador común: en los tres casos el indicador decía «ok» y el sistema no
lo estaba. Lo que los destapó no fue leer el código, fue **preguntarle al sistema
en vez de al archivo**.

#### D.5 · El carrusel que mentía, y por qué el orden se fue al servidor

Tres carruseles y una lista sobre el mismo conjunto. El primero era
`filtradas.slice(0, 8)`: un prefijo LITERAL de la lista que empezaba veinticuatro
fichas más abajo.

La orden pedía «un control de orden que reordene la lista **en el sitio**». Se
puso en el SERVIDOR, contra la letra, porque «Las de menor renta» ordenaba por
precio el top-30 **ya truncado por encaje**: enseñaba las más baratas de las
treinta que mejor encajan, no las más baratas. Es END-17 con otro disfraz — el
defecto que B.3 acababa de quitar de los chips—, y hacerlo en el cliente lo
habría reintroducido un día después.

Medido contra producción: **seis de las treinta** publicaciones que salen
ordenando por renta NO están en el top-30 por ajuste. Si el orden se aplicara en
el cliente ese número sería exactamente 0.

#### D.8 · Un spinner que borraba la pantalla, y un membrete que adivinaba

En `inicio` el indicador de carga era un `return` temprano que borraba
encabezado, filtros y chips. Al sustituirlo por esqueletos, el membrete quedó al
descubierto **declarando «NIVEL 1 · FILTROS PONDERADOS» y «0 REGISTROS» antes de
haber preguntado** — y corrigiéndose solo delante de quien lo estuviera leyendo.
Un esqueleto honesto no puede llevar encima un encabezado que adivina.

Las etiquetas del esqueleto van de verdad: «AJUSTE», «RENTA» y «DISTANCIA» no
dependen de la respuesta, se saben antes de preguntar.

#### D.9 · El pulso que arrancaba para quien pidió que no hubiera movimiento

`AccessibilityInfo.isReduceMotionEnabled()` es una promesa. Empezando en `false`,
el primer render arrancaba la animación y el segundo la apagaba: **un destello de
movimiento para justo la persona a la que el ajuste sirve.**

Lo atrapó una prueba que **cuenta las llamadas a `withRepeat`** — eran tres antes
de conocerse la preferencia. Mirar solo el estado final habría dado verde. De ahí
salió un tercer estado, `null` («todavía no sé»), que después reutilizaron el
conteo de la cifra y el hundido de `Pulsable`.

Segunda desviación deliberada: la orden pedía que «todo» respetara reducir
movimiento. El movimiento sí; **el tacto no**. Son dos ajustes distintos y para
algunas personas que se marean con el movimiento la vibración es justo el canal
que sí toleran.

#### D.11 · Una clave sin leyenda

La orden pedía codificar el tipo de publicación con una trama. El tipo **no
aparecía en la lista**: solo en la ficha de detalle. Con los chips de B.3 se
podía filtrar por algo que la lista nunca decía.

Una trama sola habría sido una clave que nadie tiene. Va la trama Y la palabra:
codificar información solo con un tratamiento visual falla para la misma gente
que codificarla solo con color.

Y un detalle que parece estético y no lo es: el sello **no lleva radio**. En
Android, `borderStyle` de guiones y puntos se degrada a línea continua en cuanto
hay `borderRadius`, y las tres tramas se volverían una sola sin que nada fallara.

#### D.12 · El documento describía un sistema que ya no existe

`DESIGN.md` llevaba los colores ANTERIORES a D.1 —los que daban 1.00 de
contraste—, describía un selector de orden retirado, declaraba «sin escalonado
entre hermanos» cuando D.9 lo acababa de añadir, y decía «las 87 imágenes» de un
catálogo que acredita **27**.

Se retiró la metáfora de la lámpara: bajo una lámpara el papel sigue siendo
claro, y `#12100E` es un negro cálido. La imagen invitaba a tratar el oscuro como
una versión atenuada del claro, cuando es una superficie con su propia paleta.

**Estaba viva en cuatro sitios**, y el cuarto lo encontró una prueba que fijaba
el texto de la salida del verificador de contraste — que es exactamente para lo
que sirve fijar el texto de una salida.

Ahora ninguna cifra de contraste se escribe a mano: la tabla lleva encima el
comando que la genera. Y se admite lo que antes se callaba: el par
`backgroundElement / background` **no llega** a su mínimo por sí solo y pasa
porque el elemento va delineado.

#### E.1 · El primer fotograma de la app era del sistema visual anterior

Además de lo que pedía la orden —`bundleIdentifier`, clave de Maps,
`runtimeVersion`—, apareció esto: el splash era azul `#208AEF` y el icono de
Android es azul `#0C7BE4` sobre `#E6F4FE`. La paleta que «La Ficha» reemplazó.

El splash se corrigió (su logotipo es BLANCO: sobre papel desaparecería, sobre la
tinta da 18.6:1). **El icono no se arregla con un hexadecimal**, hay que
redibujarlo, y queda en la lista de deuda de `DESIGN.md`.

`verificar-env.mjs` rechazó la clave nueva, correctamente. Va a la lista de
públicas por diseño **con su motivo escrito**, y de paso las otras dos entradas
ganaron el suyo: una lista de exenciones sin motivos es donde acaba escondiéndose
la que sí era un secreto.

#### E.5 · Migrar la API de imágenes no era cambiar un nombre

La forma vieja devolvía un archivo; la nueva devuelve un contexto que retiene un
BITMAP nativo. La documentación de `release()` nombra este caso exacto como uno
de los pocos en que liberar a mano se justifica. Subir cinco fotos de 4 MB son
cinco bitmaps vivos a la vez si nadie los suelta.

Se liberan en `finally`. La prueba que lo protege es «libera también cuando
guardar falla»: si alguien los mueve después del `return` —que es lo natural al
escribirlo— en el camino feliz no cambia nada y ninguna otra prueba lo nota.

#### Dos pruebas mías que estaban mal, y cómo se supo

- **«Animada, arranca en cero»** daba verde solo porque ningún cuadro había
  corrido antes de la aserción. Al actualizar React corrieron dos y leyó «3.7».
  No fallaba el conteo: fallaba la prueba. Ahora congela `Date.now`, y se añadió
  la que faltaba — que el conteo TERMINE en el valor final.
- **`tsc` atrapó un estado de roomie inventado** (`'buscando'`) que el dominio no
  tiene. Jest pasaba: el doble no valida tipos.

#### Lo que no se pudo verificar, y queda dicho

- En la primera corrida con cobertura fallaron 2 pruebas. **No se reprodujo en
  seis intentos** (cinco en caliente, uno con caché limpia). Queda anotado como
  visto una vez y sin reproducir, no como resuelto.
- El tacto está integrado y probado contra su propio fallo, pero `expo-haptics`
  es un módulo NATIVO: hasta reconstruir el cliente de desarrollo, no vibra nada.
- Las tres tramas no se han comparado en un Android real, que es donde
  `borderStyle` más se desvía.

### Pendientes abiertos

Actualizado el 19/09/2026 por la noche. El plan completo, con sus órdenes
ejecutables y su secuencia, está en
[`docs/endurecimiento-v6.md`](endurecimiento-v6.md) §5 y §6.

**Cerrados**

- [x] Flujo completo en el teléfono, consentimiento de IA en vivo, y la prueba
      de aislamiento entre cuentas aplazada desde la semana 8 — hoy **19/19**
      contra producción.
- [x] Separación real de los `.env`, con `npm run verificar:env` en CI.
- [x] Limpieza de las cuentas de prueba.
- [x] **Fase 0 completa**: migraciones 0022–0026 aplicadas, `pg_cron`, secretos
      de Vault, barredor desplegado y verificado de punta a punta.
- [x] **B.1, B.2, B.4** — el motor deja de esconder publicaciones, el score de
      mascotas obedece a su propio comentario, y la cuota solo se cobra cuando
      entrega.
- [x] **C.1, C.2** — `ErrorBoundary` y registro propio; y «falló la red» deja de
      presentarse como dato borrado.
- [x] **C.3, C.4** — capa de datos con caché, y el chat: 1200 mensajes pasan a
      30 filas, cursor compuesto, envío optimista, desalojo de memoria.
- [x] **D.1, D.2, D.3, D.4, D.7** — contraste medido, la cifra deja de afirmar
      de más, un solo componente de calificación con deuda de tokens en cero,
      densidad comparable, y objetivos táctiles a 44 pt.
- [x] **E.2** — la suite dejó de fallar al azar. Re-verificada tras cada tanda,
      no dada por buena.
- [x] **C.5, C.6** — la calificación sale de la URL y la calcula el servidor; y
      los errores se distinguen por código (clase `CP`) en vez de por subcadena.
- [x] **C.7** — las URLs firmadas se refirman a los 50 minutos, con diez de
      holgura fijada por una aserción y no por dos números que casualmente
      cuadran.
- [x] **B.6** — el vector de 384 flotantes deja de bajar al teléfono. Verificado
      contra producción: 756 bytes por fila y Nivel 2 intacto, 30 de 30.
- [x] **E.4** — dieciséis acciones de CI pineadas por SHA, `concurrency` con
      cancelación, y `npm audit` mirando `node_modules` por primera vez.
- [x] **D.6, implementación** — topes de escalado por tipo y tres alturas fijas
      convertidas en pisos. **Su verificación en dispositivo sigue abierta**, y
      está en la lista de abajo: sin ella no está cumplido, solo implementado.
- [x] **B.3** — el filtro de tipo corre en Postgres, dentro de la función que
      trunca. De paso: los chips llevaban sin filtrar nada desde C.3, y uno
      mandaba un valor que no existe en el resto del proyecto.
- [x] **B.5** — límite de ritmo real para la ODbL, repartido por la base. Tres
      geocodificaciones simultáneas: 1167 / 2616 / 3334 ms.
- [x] **Datos de demo coherentes** — las 104 publicaciones dejan de decir que
      son departamentos cuando su descripción dice otra cosa, y hay diez casas
      compartidas cerca de la UTVT. Chips: 30 · 24 · 11 · 22, todas nivel 2.
- [x] **Privilegios de ejecución cerrados por defecto** (`0036`). Dos agujeros
      explotables cerrados, seis funciones de servicio protegidas, y una lista
      blanca en pgTAP para que no vuelva a pasar en silencio.
- [x] **Bloque D completo** — D.5 y D.8 a D.12. Un carrusel con contenido propio
      y el orden en el servidor, esqueletos con forma de ficha, movimiento y
      tacto, responsive donde importa, el tipo codificado con trama y palabra, y
      `DESIGN.md` reescrito desde lo construido.
- [x] **Bloque E completo** — E.1 a E.6. `app.config.js` con la clave de Maps y
      ruta de reversión OTA, la suite estabilizada, cobertura honesta con
      trinquete en CI, dieciséis acciones pineadas, la API de imágenes migrada, y
      el microservicio diciendo con qué commit arrancó.
- [x] **El documento de endurecimiento, cerrado.** Los 38 hallazgos atendidos.

**Tuyos — nadie más puede hacerlos**

- [ ] Activar **"Prevent use of leaked passwords"** (Authentication → Attack
      Protection). Corre en el servidor y vale más que cualquier regla de
      composición. No es configurable desde `config.toml`.
- [ ] Activar **Confirm email** (Authentication → Providers → Email), que es lo
      que la `0026` da por supuesto. Ojo: a partir de ahí registrarse exige
      correo `.edu.mx` y confirmar un buzón, así que **no registres una cuenta
      en vivo delante del evaluador**.
- [ ] **Conseguir la clave de Google Maps.** E.1 dejó todo cableado:
      `app.config.js` la lee de `EXPO_PUBLIC_GOOGLE_MAPS_KEY`, y la ausencia hace
      ruido en tres sitios —`expo config` al compilar, `verificar.mjs` antes de
      exponer, y `.env.example` junto a la variable—. Falta la clave. Las
      instrucciones para restringirla por paquete + huella SHA-1 están en
      `.env.example`, con los dos comandos para obtener la huella.

      Alternativa que sigue sobre la mesa: una imagen estática de Mapbox, cuyo
      token ya existe, evita crear cuenta con tarjeta y evita un módulo nativo —
      a cambio de que el mapa no sea interactivo. Es decisión de producto.
- [x] Que caben cuatro filas por pantalla (D.4) y que el contraste corregido se
      ve bien: **comprobado en dispositivo el 19/09/2026**.
- [ ] **Verificar en dispositivo el escalado de fuente al 200 %** (D.6). Es lo
      único de la pasada que quedó sin hacer, y es lo que separa «implementado»
      de «cumplido» en el compromiso de accesibilidad de `PRODUCT.md`. El
      procedimiento está en [`docs/prueba-escalado.md`](prueba-escalado.md):
      siete pantallas, cinco cosas que mirar en cada una. Lo que se busca es una
      sola: **que ninguna cifra quede más pequeña que el texto que la rodea.**
- [ ] Decidir sobre `ANTHROPIC_API_KEY` y sobre **Sentry**. Ambas se pueden
      añadir después sin coste: el gancho de Sentry ya está puesto.

**Abiertos, del plan de endurecimiento**

- [ ] **Reconstruir el cliente de desarrollo.** `expo-haptics` es un módulo
      nativo: con el APK actual la app corre igual y no vibra. Es lo único de
      D.9 que no se puede comprobar sin volver a compilar.
- [ ] **Redibujar el icono de Android.** Es azul `#0C7BE4` sobre `#E6F4FE`, del
      sistema visual anterior. Lo primero que se ve de la app no pertenece a su
      propio mundo, y no se arregla cambiando un hexadecimal.
- [ ] **Fusionar `endurecimiento` a `main`.** Medido el 20/09/2026: **55
      commits** y **16 migraciones** de diferencia (main está en 21, la rama en
      37). Además de traer el documento de endurecimiento entero, es lo que
      cierra el agujero del `.gitignore` descrito arriba: `.env.server` NO está
      ignorado en `main`, y ese archivo tiene la service role key. Comprobado
      que nunca se commiteó; hasta la fusión, **no hacer `git add -A` desde
      `main`**.
- [ ] **Retirar `usuarios.busca_roomie`** (migración 0003). No lo lee NADIE: lo
      escriben el cuestionario y Preferencias, y lo que de verdad te mete en la
      lista de roomies es una fila en `roomies` con `estado = 'activo'`. El
      perfil lo pintaba como si fuera el interruptor real —«BUSCA ROOMIE: Sí»
      mientras no aparecías en la lista de nadie—; eso ya se corrigió en la
      pantalla el 20/09/2026, pero la columna sigue ahí y los dos formularios la
      siguen escribiendo. Retirarla es una migración y tocar dos formularios.
- [ ] Retirar la vista de compatibilidad `roomings` (migración 0011) cuando ya
      no quede ningún APK viejo instalado. Sigue viva con 30 filas.
- [ ] `README.md` tiene la sección de capturas de pantalla vacía.

**Abiertos, de calidad**

- [ ] **`src/services` está al 64.6 % de sentencias y al 72.7 % de líneas.** Las
      líneas ya pasan el 70 % que pedía la compuerta; las sentencias no. Los
      umbrales son un trinquete y solo suben (`jest.config.js`).
- [ ] **Ninguna prueba dice si algo se VE bien.** 296 en verde no es eso, y
      conviene no confundirlo nunca.
- [ ] El reparto de las pruebas de envío de `FormularioPublicacion` en su propio
      archivo contiene un síntoma cuya causa ya se explicó —`unmount()` envenena
      los renders posteriores del archivo— pero no se ha comprobado si quitar
      su `afterEach(cleanup)` permite volver a juntarlas.

**Abiertos, de Cuervo 360 y el código por correo (22/10/2026)**

- [x] **`theme.errorTexto` usado como color de texto sobre el fondo de la app: texto
      invisible en 5 sitios, 3 de ellos botones destructivos.** `errorTexto` es el color
      del texto SOBRE un relleno de `error` (blanco en claro, carbón en oscuro), no un
      color de texto suelto. Sobre el fondo de la app queda en 1.09:1 en claro
      (`#FFFFFF` sobre `#F4F6F2`) y en 1:1 en oscuro (`#171A18` sobre `#171A18`: el mismo
      color). Sitios, sin relleno de `error` detrás (`estilos.accion` / `estilos.borrar`
      solo fijan alto y alineación):
      `SeccionResenas.tsx:195` («Borrar»), `EditorProducto.tsx:148` («Quitar del menú»),
      `FormularioNegocio.tsx:361` («Borrar mi negocio»), `login.tsx:179` y
      `registro.tsx:239` («No pudimos reenviarlo»).
      Los otros tres usos sí van sobre `backgroundColor: theme.error` y están bien:
      `configuracion.tsx:142`, `CampanaAvisos.tsx:33`, `FormularioPublicacion.tsx:903`.
      Arreglo: `theme.error` como color de texto en los cinco, con su prueba roja primero.
      Se localiza con `grep -rn "color: theme.errorTexto" src --include=*.tsx`.
      `npm run verificar:contraste` seguía en verde con el defecto presente (corrida del
      22/10/2026): el par correcto (`texto/error/background`) sí estaba declarado, pero
      nadie vigilaba el uso incorrecto.
      **Corregido el 22/10/2026** (rama `texto-error-visible`): los cinco sitios usan
      `theme.error`, que como texto mide 6.01:1 y 6.54:1 en claro y 10.27:1 y 8.79:1 en
      oscuro. Guarda nueva: `npx jest test-utils/__tests__/errortexto-sobre-relleno.test.ts`
      exige `backgroundColor: theme.error` junto a cada `errorTexto` (fallaba con exactamente
      esos cinco sitios antes del arreglo). **Sin verificar en dispositivo.**
- [ ] **Compilar un APK nuevo** con el código por correo (commits `ba35620` y `355c45c` de
      la rama `codigo-por-correo`): `npx eas-cli build --platform android --profile preview`.
      Conviene juntar más cambios en el mismo build.
- [ ] **Añadir `{{ .Token }}` a la plantilla «Confirm sign up»** de Supabase **solo después
      de instalar ese APK**: antes, el correo traería un código que la app instalada no
      sabe usar. Hoy la plantilla está en español y solo lleva el enlace.
- [ ] **Bajar la caducidad del código** (Authentication → Sign In / Providers → Email) a
      unos 600 s. En el `config.toml` local es `otp_expiry = 3600`; **el valor de
      producción está sin verificar**.
- [ ] **Comprobar que el límite de verificaciones funciona de verdad.** El panel de
      producción (captura del 22/10/2026, `~/Descargas/hoo.png`) muestra «token
      verifications» en 30 por 5 min por IP (360 por hora), 30 correos por hora y 60 s
      entre correos al mismo usuario. **Que el valor esté puesto no prueba que se aplique**:
      en un Supabase local, con el mismo valor de 30, 60 códigos malos seguidos no
      devolvieron ningún 429, y el código bueno seguía siendo válido después. Un intento
      fallido no invalida el código.
- [ ] **Recuperar contraseña con código: implementado y probado, sin verificar en
      dispositivo.** `recuperar-contrasena.tsx` pide el código, y en un segundo paso recibe
      código y contraseña nueva. Verificar el código abre sesión: si el usuario sale sin
      cambiarla, se le cierra; al terminar, se cierra y se manda al login. Comprobado con
      `npx jest "src/app/\(auth\)/__tests__/recuperar"` (incluida la prueba de abandono, que
      falla si se quita la limpieza). **Hueco conocido:** si el usuario MATA la app después de
      verificar el código y antes de cambiar la contraseña, la sesión queda guardada y la
      próxima vez entra directo; cerrarlo exige una marca de «recuperación pendiente» que
      obligue a cambiar la contraseña al reabrir.
- [ ] **Site URL de Supabase** (Authentication → URL Configuration): hoy
      `http://localhost:3000` y sin Redirect URLs (captura del 22/10/2026). El enlace del
      correo confirma la cuenta y termina en «no se puede conectar». Con el código deja de
      bloquear, pero conviene una página de confirmación en `cuervo360.com`.

**Auditoría del 23/10/2026: hallazgos 1, 2 y 3 arreglados en código (rama `endurecer-auditoria`), sin aplicar todavía**

- [ ] **Aplicar las migraciones 0075 y 0076 en producción.** Antes, el respaldo que exige AGENTS.md
      (`npx supabase db dump --data-only -f respaldos/$(date +%F).sql`) y después `npx supabase db push`.
      · **0075 · integridad del consentimiento.** Antes, un `update` directo guardaba cualquier versión y cualquier hora de
      aceptación (comprobado en un Postgres local: `'zzz'` y `1999-01-01`). Ahora la versión tiene que existir en
      `avisos_privacidad` y la dueña de la fila no escribe esas dos columnas (`CP014`); `registro.tsx` ya no las escribe.
      · **0076 · pago atómico.** `simular_pago` leía, calculaba y escribía: dos pagos cruzados dejaban dos pagos registrados y
      30 días. Se reproduce con `./scripts/prueba-carrera-pagos.sh` (antes: 30,0 días; ahora: 60,0).
      Comprobado en local: `npx supabase test db` (630 aserciones), el guion de la carrera y una falsificación real contra
      GoTrue y PostgREST. **Sin probar contra producción.**
- [ ] **Desplegar `verificar-rostro`** (`supabase functions deploy verificar-rostro`): ahora exige la forma `v<n>` y contesta 400
      `aviso_invalido` cuando la base rechaza la versión. `deno check` corre en el CI; aquí no hay `deno`.
- [ ] **Reconstruir el contenedor de IA** (`./scripts/ia-arrancar.sh`) para llevar el arreglo del 500 por una cabecera
      `Authorization` con un byte no ASCII (ahora 401). Hasta entonces `verificar.mjs` verá un contenedor un commit atrás.
- [ ] Hallazgos 4 a 7 de la misma auditoría, sin tocar: `ai-proxy` con cuerpo `null` y errores de base como «cuota agotada»,
      el orden de borrado de `eliminar-cuenta`, la copia de `igualEnTiempoConstante` y `respaldos/`.
- [ ] **Antes de enseñar «Contratar plan»** hay que encender `demo_mode` desde el panel de administración: en producción está en
      `false` (comprobado el 23/10/2026) y la app dice «los pagos de demostración no están activos».

**Riesgo operativo permanente**

- [ ] El túnel de cloudflared es efímero, y el proceso **no se muere** cuando su
      dominio caduca: se queda reintentando, así que nada avisa. Mitigado —no
      resuelto— por `scripts/tunel.sh` y `scripts/verificar.mjs`. Correr el
      verificador **antes de cada exposición**.
