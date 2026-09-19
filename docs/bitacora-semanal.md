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

### Pendientes abiertos

- [ ] Probar el flujo completo en el teléfono: registro → cuestionario →
      sugerencias → ver contacto → chat.
- [ ] Verificar el consentimiento en vivo: desmarcar la casilla de IA y
      comprobar que las sugerencias caen a **Nivel 1**; volver a marcarla y
      comprobar que regresan a **Nivel 2**. Es la demostración de §18 y §29 en
      una sola interacción.
- [ ] `ANTHROPIC_API_KEY` está vacía, así que `/parsear-perfil` devuelve valores
      por defecto en vez de atributos extraídos del texto libre. Degrada sin
      romperse; decidir si se configura antes de la entrega.
- [ ] Separar el `.env` de cliente y el de servidor (ver Hallazgos).
- [ ] Activar **"Prevent use of leaked passwords"** en el panel
      (Authentication → Attack Protection). Es la comprobación contra
      HaveIBeenPwned, corre en el servidor y vale más que cualquier regla de
      composición. No es configurable desde `config.toml`.
- [ ] Las 109 cuentas existentes conservan su contraseña anterior: las reglas
      nuevas aplican a registros nuevos y a cambios de contraseña.
- [ ] Retirar la vista de compatibilidad `roomings` (migración 0011) cuando ya
      no quede ningún APK viejo instalado.
- [ ] El túnel de cloudflared es efímero: `*.trycloudflare.com` cambia de
      dominio en cada arranque, y `AI_SERVICE_URL` hay que volver a fijarlo. Si
      el túnel se cae durante la exposición, la app degrada a Nivel 1 — que es
      demostrable, pero conviene saberlo antes de que pase.
