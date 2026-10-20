# Cuervo Pass

App móvil para que alumnos universitarios encuentren departamento y compañeros de vivienda compatibles, usando un motor de sugerencias que combina filtros duros con matching semántico por embeddings.

Construida contra el **documento maestro v5**, que audita el diseño anterior y corrige veintiocho hallazgos (`AUD-01`), y endurecida después contra [`docs/endurecimiento-v6.md`](docs/endurecimiento-v6.md), que auditó el sistema **en ejecución** y encontró cuarenta más (`END-01` a `END-40`). Los comentarios del código citan las secciones (`§17`) y los hallazgos de los dos documentos, con el número al lado del arreglo.

## El problema

Un alumno de nuevo ingreso no conoce la zona ni sabe dónde vivir, y buscar por grupos de Facebook desorganizados es lento y poco confiable.

## Arquitectura

```
┌─────────────────────────────┐
│  App móvil (React Native /  │
│  Expo)                      │
└──────────────┬──────────────┘
               │ HTTPS · solo la anon key viaja en el APK
               ▼
┌───────────────────────────────────────────┐
│  Supabase                                 │
│  ├─ Auth (email/contraseña)               │
│  ├─ Postgres (+ pgvector, + RLS + vistas) │
│  ├─ Storage privado (URLs firmadas)       │
│  ├─ Realtime (chat vía websockets)        │
│  └─ Edge Functions ─┐                     │
└─────────────────────┼─────────────────────┘
                      │ token compartido + id de usuario
        ┌─────────────┴──────────────┐
        ▼                            ▼
┌────────────────────────┐   ┌──────────────────────┐
│ Microservicio de IA    │   │ Nominatim / OSM      │
│ (Docker, FastAPI)      │   │ geocodificación      │
│ ├─ Embeddings locales  │   │ (ODbL, se cachea)    │
│ └─ Claude Haiku (API)  │   └──────────────────────┘
└────────────────────────┘
```

**La app nunca habla con el microservicio ni con el geocodificador.** Todo pasa por Edge Functions, que validan la sesión, aplican la cuota diaria y agregan las credenciales. Lo único que va dentro del APK es la URL de Supabase y la anon key, que son públicas por diseño.

## Modelo de datos

`usuarios`, `publicaciones`, `roomies`, `conversaciones`, `mensajes`, `contactos`, `cuotas_uso`, `notificaciones`, `reportes`, `push_tokens`, `fotos_huerfanas`, `geocodificaciones` y `geocodificaciones_ritmo`.

Las tablas están **cerradas**: cada usuario solo ve sus propias filas. Lo que otros pueden ver sale de dos vistas con lista blanca de columnas — `perfiles_publicos` y `publicaciones_publicas` — que deliberadamente no incluyen presupuesto, universidad, vector de perfil ni teléfono. Ver `supabase/migrations/0014_v5_rls_y_vistas.sql`.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React Native + Expo (Expo Router, TypeScript) |
| Backend/DB | Supabase (Postgres + pgvector + RLS) |
| Microservicio IA | FastAPI (Python 3.11) |
| LLM de parseo de perfiles | Claude Haiku (API de Anthropic) |
| Embeddings | sentence-transformers, `paraphrase-multilingual-MiniLM-L12-v2` (384 dim) |
| Geocodificación | Nominatim sobre OpenStreetMap (ODbL) desde el servidor |
| Mapas y autocompletado | Mapbox (uso temporal, sin almacenar resultados) |
| Gestión de estado | Zustand |
| Validación de formularios | Zod + React Hook Form |
| Testing | Jest + RNTL (frontend), Pytest (microservicio), pgTAP (RLS) |

## Cómo correrlo

```bash
# ── Frontend ───────────────────────────────────────────
npm ci
cp .env.example .env          # solo valores públicos: todo esto acaba en el APK
npx expo start

# ── Supabase ───────────────────────────────────────────
# Producción tiene su historial de migraciones COMPLETO: no hace falta ningún
# repair. Procedimiento entero, con respaldo y verificación: docs/aplicar-migraciones.md
# (el CLI se usa con `npx`, en la versión que fija .github/workflows/ci.yml)
npx supabase link --project-ref TU_PROJECT_REF
npx supabase db dump --data-only -f respaldos/$(date +%F)-antes-de-NNNN.sql   # antes de tocar nada
npx supabase migration list   # qué falta en producción
npx supabase db push --dry-run   # qué empujaría, sin empujar
npx supabase db push          # aplica supabase/migrations/
npx supabase test db          # pruebas de RLS con pgTAP (necesita Docker)

npx supabase functions deploy ai-proxy
npx supabase functions deploy geocodificar
npx supabase functions deploy eliminar-cuenta
npx supabase functions deploy barrer-fotos   # la llama pg_cron cada hora (0025)
npx supabase secrets set AI_SERVICE_URL=... AI_SHARED_TOKEN=$(openssl rand -hex 32)

# ── Microservicio de IA ────────────────────────────────
cd ai-service
cp .env.example .env          # claves del servidor: NUNCA con prefijo EXPO_PUBLIC_
python3 -m venv venv && source venv/bin/activate
pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt
uvicorn main:app --reload     # desde ai-service/, no desde la raíz.
                              # config.py carga ai-service/.env solo; si falta
                              # AI_SHARED_TOKEN el servicio NO arranca, a propósito.
# o con Docker:  docker compose up
#   Requiere ai-service/.env (el `cp` de arriba): docker-compose.yml lo
#   declara en env_file y Compose aborta si falta. Eso es lo correcto —
#   el microservicio sin AI_SHARED_TOKEN no debe arrancar.
#   Compose NO está instalado en la máquina de desarrollo actual
#   (19/09/2026): esta ruta está sin probar aquí. Se usa uvicorn.

# ── Túnel, para que Supabase alcance tu laptop ─────────
./scripts/tunel.sh           # NO uses `cloudflared tunnel --url` a pelo: no
                             # actualiza el secret AI_SERVICE_URL, y la Edge
                             # Function se queda apuntando al túnel anterior

# ── Antes de exponer ───────────────────────────────────
node scripts/verificar.mjs   # túnel, secrets, vectores, RPCs — ver docs/verificacion-pre-demo.md
npx supabase test db         # 612 aserciones de RLS (local, contra el esquema reconstruido)
node --env-file=.env --env-file=.env.server scripts/prueba-rls.mjs   # las barreras, contra PRODUCCIÓN y por HTTP
npm run verificar:bucket     # que Storage APLIQUE los límites de las fotos (sube sondas y las borra)
npx tsc --noEmit && npx expo lint && npm test -- --coverage   # los umbrales rompen el build si baja
```

Los dos `.env` son **dos archivos separados a propósito**: el de la raíz es del cliente y todo lo que lleva `EXPO_PUBLIC_` se compila dentro del bundle; el de `ai-service/` nunca se lee desde la app. Ninguno de los dos se versiona.

Son **tres** archivos, con tres destinos, y ninguno se versiona:

| Archivo | Qué lleva | Quién lo lee |
|---|---|---|
| `.env` | solo `EXPO_PUBLIC_*` | la app (se compila dentro del APK) y los scripts |
| `.env.server` | `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, `AI_SERVICE_URL`, `CRON_SECRET` | los scripts y el CLI |
| `ai-service/.env` | `ANTHROPIC_API_KEY`, `AI_SHARED_TOKEN`, modelos, timeouts | `ai-service/config.py`, y `env_file` de Docker |

Los scripts cargan los dos primeros **a mano**, con una excepción:

```bash
node --env-file=.env --env-file=.env.server scripts/prueba-rls.mjs
node scripts/verificar.mjs        # este se los carga solo (process.loadEnvFile)
```

Y uno necesita **tres**: `backfill-embeddings.mjs` lee `AI_SHARED_TOKEN`, que
vive solo en `ai-service/.env`. Sin él la petición sale sin autenticar y el
microservicio responde **401 sin decir por qué**:

```bash
node --env-file=.env --env-file=.env.server --env-file=ai-service/.env \
     scripts/backfill-embeddings.mjs
```

El reparto no es una advertencia escrita: lo comprueba `npm run verificar:env`,
que corre en CI y rompe el build si un secreto aparece del lado del cliente.

## Decisiones de ingeniería

- **El motor de sugerencias consulta vistas, no tablas.** Una función `security invoker` corre con los permisos de quien la llama, así que RLS se aplica dentro de ella: sobre las tablas cerradas devolvería cero filas, sin error y sin log. Las vistas evaden RLS a propósito y exponen solo columnas seguras (`0015_v5_motor_sugerencias.sql`).
- **Retrieval + ranking, en ese orden.** El filtro duro —presupuesto, distancia, mascotas— descarta primero lo inviable; el embedding solo reordena lo que ya se puede pagar y alcanzar. Un departamento carísimo puede tener un vector muy parecido a tu perfil sin que puedas pagarlo.
- **El teléfono no se lee, se pide.** `publicaciones_publicas` no trae la columna. El número sale de `revelar_contacto()`, que aplica una cuota de 25 revelaciones diarias y deja registro sin duplicar.
- **Control de acceso en vez de cifrado de campos.** Se cifra en tránsito (HTTPS) y en reposo (disco de Supabase). Cifrar columnas con `pgp_sym_encrypt` no protegía contra la amenaza real —un usuario legítimo leyendo datos de otro— y mandaba la clave dentro de la consulta, donde acaba en los logs.
- **Las pruebas de RLS son código.** Corren en CI y rompen el build (`supabase/tests/rls.test.sql`). Una captura de pantalla no se vuelve a ejecutar. Cuántas hay lo dice el archivo — aquí no se escribe, porque un número escrito envejece y este ya lo hizo dos veces:

  ```bash
  grep -oE 'select plan\([0-9]+\)' supabase/tests/rls.test.sql
  ```
- **Sin índice vectorial.** Con unos cientos de filas, un recorrido secuencial sobre `vector(384)` es instantáneo y **exacto**; un índice aproximado solo puede empeorar el resultado. Cuando haga falta será HNSW, no IVFFlat.
- **Degradación visible.** Si el microservicio se cae, la app pasa a Nivel 1 y lo dice en pantalla. Se puede demostrar en vivo apagando el contenedor.

## Alcance fuera del proyecto

- **No se verifican identidades.** Alguien puede publicar un departamento que no es suyo.
- **Solo México**: `^[0-9]{10}$` y `wa.me/52`. Es una decisión declarada, no un descuido.
- **Bloqueo entre usuarios** y despliegue en Kubernetes están en el roadmap posterior a la entrega. Lo que sí hay hoy contra el abuso es reportar —a una persona y a una publicación— con ocultamiento automático por umbral de reportes.
- Las **notificaciones push** salieron del roadmap: están implementadas (`src/lib/pushNotifications.ts`, tabla `push_tokens`, `enviar_notificacion_push` disparada por el trigger de mensaje nuevo).

## Privacidad

- Aviso de privacidad: [`docs/aviso-privacidad.md`](docs/aviso-privacidad.md)
- Modelo de amenazas: [`docs/modelo-amenazas.md`](docs/modelo-amenazas.md)
- El análisis del texto libre con IA es **opcional** y su casilla no viene premarcada. Sin él, la app funciona en Nivel 1.
- Derechos ARCO implementados en la app: *Mi perfil → Descargar mis datos* y *Eliminar mi cuenta*.

## Atribuciones

Datos de geocodificación © OpenStreetMap contributors, bajo licencia ODbL.

## Estado del proyecto

Bitácora semanal: [`docs/bitacora-semanal.md`](docs/bitacora-semanal.md).

**Endurecimiento cerrado.** El documento maestro v5 se auditó *sobre el artefacto
escrito, sin ejecutar el sistema*. Ya ejecutado, aparecieron cuarenta hallazgos
propios, varios de ellos críticos
([`docs/endurecimiento-v6.md`](docs/endurecimiento-v6.md)). **Los cuarenta están
remediados y aplicados a producción**, cada uno con su prueba en rojo antes del
arreglo.

Compuertas, todas en CI (`.github/workflows/ci.yml`, un job por fila):

| Job | Qué comprueba |
|---|---|
| `base-de-datos` | pgTAP: RLS, funciones y límites del bucket, contra un esquema reconstruido desde las migraciones |
| `frontend` | tipos, lint, la puerta de `npm audit` con excepciones, contraste, objetivos táctiles y jest con umbral de cobertura que solo sube |
| `servicio-ia` | pytest del microservicio |
| `imagen` | build de la imagen, escaneo de vulnerabilidades (Trivy) e inventario de componentes (SBOM) |
| `edge-functions` | `deno check` y `deno lint` de las funciones |
| `secretos` | reparto de variables entre archivos y gitleaks sobre el historial |

Aparte, contra **producción** y a mano: el aislamiento entre cuentas
(`prueba-rls.mjs`) y que Storage aplique sus límites (`npm run verificar:bucket`).

Cuántas pruebas hay no se escribe aquí: lo dice cada herramienta, y
`test-utils/__tests__/readme-al-dia.test.ts` rompe el build si este archivo copia
una cifra que envejece.

```bash
npx supabase test db                                   # el archivo dice cuántas
npm test -- --coverage                                 # y los umbrales
node --env-file=.env --env-file=.env.server scripts/prueba-rls.mjs   # todas las barreras o sale con 1
node --env-file=.env --env-file=.env.server scripts/verificar.mjs    # antes de exponer
```

**Lo que sigue abierto está enumerado, no disimulado**, en
[`docs/bitacora-semanal.md`](docs/bitacora-semanal.md) §«Pendientes abiertos», y
lo que el sistema visual todavía no resuelve, en [`DESIGN.md`](DESIGN.md) §«Lo
que este sistema NO resuelve todavía». Lo más importante de esas dos listas: el
escalado de fuente al 200 % está **implementado y sin verificar en dispositivo**,
y ninguna de las pruebas automáticas dice si algo se VE bien.

## Capturas de pantalla

**Pendiente.** Lo que conviene capturar, en claro y en oscuro, con el catálogo de
demo cargado (todas las publicaciones con foto y con vector):

| Pantalla | Qué demuestra |
|---|---|
| Inicio | Cuatro renglones por pantalla, el sello de tipo sobre la foto, y el membrete diciendo «NIVEL 2 · N DE M CON AFINIDAD SEMÁNTICA» |
| Inicio, con «Renta» activo | Que el control de orden cambia el CONTENIDO y no solo el orden |
| Ficha de publicación | La calificación en su casilla y la línea del porqué |
| Desglose de calificación, abierto | La fórmula real con los números que devolvió Postgres |
| Chat | Envío optimista: la burbuja aparece antes de la confirmación |
| Cuestionario | La casilla de consentimiento de IA, sin premarcar |

Las imágenes van en `docs/capturas/`.

## Equipo

**Pendiente de llenar antes de la entrega.** Va aquí: nombre completo de cada
integrante y de qué respondió. Es lo primero que busca quien evalúa y ahora mismo
este archivo no lo dice.
