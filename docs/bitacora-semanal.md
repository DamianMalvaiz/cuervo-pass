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

### Pendientes abiertos

Actualizado el 19/09/2026. El trabajo **sigue**: esta lista es el estado de un
proyecto en marcha, no un cierre.

**Hechos desde la última revisión**

- [x] Flujo completo en el teléfono: registro → cuestionario → sugerencias →
      ver contacto → chat. Cerrado el 19/09 tras arreglar `revelar_contacto`.
- [x] Consentimiento de IA verificado en vivo, con la fila de la base antes y
      después de cada paso.
- [x] Prueba de aislamiento entre cuentas, aplazada desde la semana 8:
      15/15 barreras (`scripts/prueba-rls.mjs`).
- [x] Separar el `.env` de cliente y el de servidor.
- [x] Limpieza de las cuentas de prueba y de la publicación mal geocodificada.

**Abiertos, del proyecto**

- [ ] Activar **"Prevent use of leaked passwords"** en el panel
      (Authentication → Attack Protection). Es la comprobación contra
      HaveIBeenPwned, corre en el servidor y vale más que cualquier regla de
      composición. No es configurable desde `config.toml`, así que no puede
      entrar en una migración ni en `config push`.
- [ ] `ANTHROPIC_API_KEY` sigue vacía. **Corrección respecto a lo que se
      escribió antes:** la clave va en `ai-service/.env`, no en los secrets de
      las Edge Functions — quien llama al modelo es el microservicio. Se
      rastreó qué se pierde sin ella: solo `horario_predominante`, un campo del
      perfil público que ya degrada a "Variable". **No toca el ranking ni el
      embedding**, porque no aparece ni en el motor de la 0015 ni en
      `perfilTexto.ts`. El Nivel 2 corre en un modelo local y no depende de
      ninguna API de pago. Se puede añadir después: poner la variable y
      reiniciar el microservicio, que la lee con `os.getenv` al importar.
- [ ] Retirar la vista de compatibilidad `roomings` (migración 0011) cuando ya
      no quede ningún APK viejo instalado. Sigue viva con 30 filas.
- [ ] Las cuentas existentes conservan su contraseña anterior: las reglas nuevas
      aplican a registros nuevos y a cambios de contraseña.
- [ ] `README.md` tiene la sección de capturas de pantalla vacía, con la
      interfaz ya rediseñada.

**Abiertos, de calidad**

- [ ] Las pruebas de pantalla cubren lo que se tocó estos dos días, no las
      diecisiete pantallas. Quedan sin cubrir, entre otras, el chat y el detalle
      de publicación.
- [ ] Ninguna prueba dice si algo se **ve** bien: ni un botón fuera de pantalla,
      ni un texto cortado, ni un contraste insuficiente. Eso solo se juzga en un
      dispositivo, y conviene no confundir 92 pruebas en verde con eso.
- [ ] El reparto de las pruebas de envío en su propio archivo contiene un
      síntoma cuya causa no se encontró.

**Riesgo operativo permanente**

- [ ] El túnel de cloudflared es efímero: `*.trycloudflare.com` cambia de
      dominio en cada arranque y `AI_SERVICE_URL` hay que volver a fijarlo. Peor
      aún, el proceso **no se muere** cuando su dominio caduca: se queda
      reintentando, así que nada avisa. Mitigado —no resuelto— por
      `scripts/tunel.sh`, que fija el secret antes de esperar al DNS, y por
      `scripts/verificar.mjs`, que pregunta por el dominio público y no por
      `localhost`. Correr el verificador **antes de cada exposición**.
