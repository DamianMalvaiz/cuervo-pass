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

### Nota sobre el consentimiento de IA

El `consiente_analisis_ia` de las 109 cuentas se otorgó manualmente el
18/09/2026. **Las 109 cuentas son del propio desarrollador** —cuentas de demo y
pruebas de registro—, no de terceros. Si alguna hubiera sido de otra persona,
otorgarlo en lote habría sido justo lo que la casilla sin premarcar existe para
impedir (§29). Al revisar el motor resultó, además, que el consentimiento ajeno
era innecesario: `sugerencias_con_ranking` solo lee el `perfil_vector` de
`auth.uid()`, y las sugerencias de roomies comparan contra
`roomies.vector_busqueda`, que no depende del consentimiento de nadie.

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
- [ ] Retirar la vista de compatibilidad `roomings` (migración 0011) cuando ya
      no quede ningún APK viejo instalado.
- [ ] El túnel de cloudflared es efímero: `*.trycloudflare.com` cambia de
      dominio en cada arranque, y `AI_SERVICE_URL` hay que volver a fijarlo. Si
      el túnel se cae durante la exposición, la app degrada a Nivel 1 — que es
      demostrable, pero conviene saberlo antes de que pase.
