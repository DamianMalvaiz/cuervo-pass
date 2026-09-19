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

**Tuyos — nadie más puede hacerlos**

- [ ] Activar **"Prevent use of leaked passwords"** (Authentication → Attack
      Protection). Corre en el servidor y vale más que cualquier regla de
      composición. No es configurable desde `config.toml`.
- [ ] Activar **Confirm email** (Authentication → Providers → Email), que es lo
      que la `0026` da por supuesto. Ojo: a partir de ahí registrarse exige
      correo `.edu.mx` y confirmar un buzón, así que **no registres una cuenta
      en vivo delante del evaluador**.
- [ ] **Google Maps** (orden E.1): sin la clave el mapa de la ficha sale gris en
      Android. Alternativa evaluada: una imagen estática de Mapbox, cuyo token
      ya existe, evita crear cuenta con tarjeta y evita un módulo nativo — a
      cambio de que el mapa no sea interactivo. Es decisión de producto.
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

- [ ] **B.3, B.5, B.6, C.5, C.6, C.7** — filtro de tipo en el servidor, ritmo
      real en la geocodificación, dejar de mandar 384 flotantes al teléfono, la
      calificación fuera de la URL, códigos de error en vez de subcadenas, y
      refirmar las URLs antes de que caduquen.
- [ ] **D.5, D.6, D.8 a D.12** — un carrusel o ninguno, escalado de fuente real,
      esqueletos con forma de ficha, movimiento y tacto, responsive donde
      importa, capa semántica de color, y reescribir `DESIGN.md` desde lo
      construido.
- [ ] **E.1, E.3, E.4, E.5, E.6** — plataforma: `app.json`, umbrales de
      cobertura, pinear el resto de CI, la API deprecada de imágenes, e higiene
      de operación del túnel.
- [ ] Retirar la vista de compatibilidad `roomings` (migración 0011) cuando ya
      no quede ningún APK viejo instalado. Sigue viva con 30 filas.
- [ ] `README.md` tiene la sección de capturas de pantalla vacía.

**Abiertos, de calidad**

- [ ] La cobertura sigue lejos del 70 % que pide la compuerta de la Fase 2 para
      `src/services` y `src/store`, aunque ambos dejaron el 0 %.
- [ ] **Ninguna prueba dice si algo se VE bien.** 199 en verde no es eso, y
      conviene no confundirlo nunca.
- [ ] El reparto de las pruebas de envío de `FormularioPublicacion` en su propio
      archivo contiene un síntoma cuya causa ya se explicó —`unmount()` envenena
      los renders posteriores del archivo— pero no se ha comprobado si quitar
      su `afterEach(cleanup)` permite volver a juntarlas.

**Riesgo operativo permanente**

- [ ] El túnel de cloudflared es efímero, y el proceso **no se muere** cuando su
      dominio caduca: se queda reintentando, así que nada avisa. Mitigado —no
      resuelto— por `scripts/tunel.sh` y `scripts/verificar.mjs`. Correr el
      verificador **antes de cada exposición**.
