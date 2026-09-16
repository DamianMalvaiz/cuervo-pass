# Cuervo de Paz

App móvil para que alumnos universitarios encuentren departamento y compañeros de vivienda compatibles, usando un motor de sugerencias que combina filtros ponderados con matching semántico por embeddings.

## Problema que resuelve

Un alumno de nuevo ingreso no conoce la zona ni sabe dónde vivir, y buscar por grupos de Facebook desorganizados es lento y poco confiable.

## Arquitectura

```
┌─────────────────────────────┐
│  App móvil (React Native /  │
│  Expo)                      │
└──────────────┬───────────────┘
               │ HTTPS
               ▼
┌─────────────────────────────────────────┐
│  Supabase                                │
│  ├─ Auth (email/contraseña)              │
│  ├─ Postgres (+ pgvector, + RLS)         │
│  ├─ Storage (fotos)                      │
│  └─ Realtime (chat vía websockets)       │
└──────────────┬────────────────────────────┘
               │ REST interno (AI_SERVICE_URL)
               ▼
┌─────────────────────────────────────────┐
│  Microservicio de IA (Docker)            │
│  ├─ Embeddings: sentence-transformers    │
│  │   (all-MiniLM-L6-v2, 80MB, CPU)       │
│  └─ LLM de parseo: Claude Haiku API      │
│      (Anthropic, desde el día 1)         │
└──────────────┬────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Mapbox API — geocoding y distancia      │
└─────────────────────────────────────────┘
```

La app nunca sabe dónde corre la IA, solo conoce una URL (`AI_SERVICE_URL`). Ver el documento maestro del proyecto para el detalle completo de cada decisión de arquitectura.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React Native + Expo (Expo Router, TypeScript) |
| Backend/DB | Supabase (Postgres + pgvector + RLS) |
| Microservicio IA | FastAPI (Python) |
| LLM de parseo de perfiles | Claude Haiku (API de Anthropic) |
| Embeddings | sentence-transformers (all-MiniLM-L6-v2, 384 dim) |
| Mapas | Mapbox Geocoding API |
| Gestión de estado | Zustand |
| Validación de formularios | Zod + React Hook Form |
| Testing | Jest + React Native Testing Library (frontend), Pytest (microservicio) |

## Cómo correr el proyecto

```bash
# Frontend
npm install
npx expo start

# Supabase (CLI local, recomendable para migraciones versionadas)
npm install -g supabase
supabase init
supabase link --project-ref TU_PROJECT_REF
supabase db push   # aplica supabase/migrations/0001_esquema_inicial.sql

# Microservicio de IA (a partir de la Semana 7)
cd ai-service
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
# o, con Docker:
docker compose up
```

Copia `.env.example` a `.env` y completa `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` con los datos de tu proyecto de Supabase (Project Settings → API). Nunca subas `.env` a Git.

## Decisiones de ingeniería destacadas

- Arquitectura dual local/nube para la IA: desarrollo sin costo, migración a Fly.io/Railway sin rehacer código.
- Motor de sugerencias en dos niveles (retrieval + ranking): filtro duro en SQL primero, similitud de coseno con pgvector después — igual que sistemas de recomendación reales.
- Row Level Security en todas las tablas, pensado para probarse activamente con múltiples cuentas (ver `supabase/migrations/0001_esquema_inicial.sql`).
- Cifrado de datos sensibles del perfil de usuario con `pgcrypto`.

## Estado del proyecto

Ver el documento maestro para el plan de 12 semanas completo. Estado actual: **Semana 1** — scaffolding de Expo, estructura de carpetas, y modelo de datos listo para correr en Supabase.

## Capturas de pantalla

[agrega aquí conforme haya UI que mostrar]

## Equipo

[nombres]
