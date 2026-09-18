# Cuervo Pass

App móvil para que alumnos universitarios encuentren departamento y compañeros de vivienda compatibles, usando un motor de sugerencias que combina filtros duros con matching semántico por embeddings.

Construida contra el **documento maestro v5**, que audita el diseño anterior y corrige veintiocho hallazgos. Los comentarios del código citan las secciones (`§17`) y los hallazgos (`AUD-01`) de ese documento.

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

`usuarios`, `publicaciones`, `roomies`, `conversaciones`, `mensajes`, `contactos`, `cuotas_uso`, `notificaciones`, `reportes`, `geocodificaciones`.

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
# Si es la primera vez en esta máquina, lee antes docs/aplicar-migraciones.md:
# este repositorio venía aplicando las migraciones a mano en el SQL Editor, así
# que `db push` necesita un `migration repair` previo para no reaplicar 0001.
npm install -D supabase
npx supabase init
npx supabase link --project-ref TU_PROJECT_REF
npx supabase db dump --data-only -f respaldos/$(date +%F).sql   # antes de tocar nada
npx supabase db push          # aplica supabase/migrations/
npx supabase test db          # pruebas de RLS con pgTAP (necesita Docker)

npx supabase functions deploy ai-proxy
npx supabase functions deploy geocodificar
npx supabase functions deploy eliminar-cuenta
npx supabase secrets set AI_SERVICE_URL=... AI_SHARED_TOKEN=$(openssl rand -hex 32)

# ── Microservicio de IA ────────────────────────────────
cd ai-service
cp .env.example .env          # claves del servidor: NUNCA con prefijo EXPO_PUBLIC_
python3 -m venv venv && source venv/bin/activate
pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt
uvicorn main:app --reload     # desde ai-service/, no desde la raíz
# o con Docker:  docker compose up

# ── Túnel, para que Supabase alcance tu laptop ─────────
cloudflared tunnel --url http://localhost:8000
```

Los dos `.env` son **dos archivos separados a propósito**: el de la raíz es del cliente y todo lo que lleva `EXPO_PUBLIC_` se compila dentro del bundle; el de `ai-service/` nunca se lee desde la app. Ninguno de los dos se versiona.

## Decisiones de ingeniería

- **El motor de sugerencias consulta vistas, no tablas.** Una función `security invoker` corre con los permisos de quien la llama, así que RLS se aplica dentro de ella: sobre las tablas cerradas devolvería cero filas, sin error y sin log. Las vistas evaden RLS a propósito y exponen solo columnas seguras (`0015_v5_motor_sugerencias.sql`).
- **Retrieval + ranking, en ese orden.** El filtro duro —presupuesto, distancia, mascotas— descarta primero lo inviable; el embedding solo reordena lo que ya se puede pagar y alcanzar. Un departamento carísimo puede tener un vector muy parecido a tu perfil sin que puedas pagarlo.
- **El teléfono no se lee, se pide.** `publicaciones_publicas` no trae la columna. El número sale de `revelar_contacto()`, que aplica una cuota de 25 revelaciones diarias y deja registro sin duplicar.
- **Control de acceso en vez de cifrado de campos.** Se cifra en tránsito (HTTPS) y en reposo (disco de Supabase). Cifrar columnas con `pgp_sym_encrypt` no protegía contra la amenaza real —un usuario legítimo leyendo datos de otro— y mandaba la clave dentro de la consulta, donde acaba en los logs.
- **Las pruebas de RLS son código.** Doce aserciones de pgTAP que corren en CI y rompen el build (`supabase/tests/rls.test.sql`). Una captura de pantalla no se vuelve a ejecutar.
- **Sin índice vectorial.** Con unos cientos de filas, un recorrido secuencial sobre `vector(384)` es instantáneo y **exacto**; un índice aproximado solo puede empeorar el resultado. Cuando haga falta será HNSW, no IVFFlat.
- **Degradación visible.** Si el microservicio se cae, la app pasa a Nivel 1 y lo dice en pantalla. Se puede demostrar en vivo apagando el contenedor.

## Alcance fuera del proyecto

- **No se verifican identidades.** Alguien puede publicar un departamento que no es suyo.
- **Solo México**: `^[0-9]{10}$` y `wa.me/52`. Es una decisión declarada, no un descuido.
- Bloqueo entre usuarios, notificaciones push y despliegue en Kubernetes están en el roadmap posterior a la entrega.

## Privacidad

- Aviso de privacidad: [`docs/aviso-privacidad.md`](docs/aviso-privacidad.md)
- Modelo de amenazas: [`docs/modelo-amenazas.md`](docs/modelo-amenazas.md)
- El análisis del texto libre con IA es **opcional** y su casilla no viene premarcada. Sin él, la app funciona en Nivel 1.
- Derechos ARCO implementados en la app: *Mi perfil → Descargar mis datos* y *Eliminar mi cuenta*.

## Atribuciones

Datos de geocodificación © OpenStreetMap contributors, bajo licencia ODbL.

## Estado del proyecto

Bitácora semanal: [`docs/bitacora-semanal.md`](docs/bitacora-semanal.md).

## Capturas de pantalla

[agrega aquí conforme haya UI que mostrar]

## Equipo

[nombres y responsabilidades]
