# Cuervo Pass

App móvil para que estudiantes universitarios encuentren departamento y roomies
compatibles. Expo / React Native + Supabase (Postgres, pgvector, RLS, Edge
Functions) + microservicio FastAPI para embeddings y parseo con Claude Haiku.

Todo en español: código, comentarios, commits, UI, nombres de tablas y columnas.

---

## Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before
writing any code. No asumas APIs de SDK anteriores ni de memoria.

---

## Cómo trabajar aquí

**Un paso a la vez.** Haz un cambio, verifícalo, repórtalo, espera. No encadenes
cinco correcciones en un turno. Si el plan tiene cinco pasos, di cuáles son y
ejecuta el primero.

**No inventes datos.** Ni valores de prueba que parezcan reales, ni resultados de
comandos que no corriste, ni el contenido de un archivo que no leíste. Si no lo
sabes, léelo o dilo.

**Toda afirmación debe ser verificable.** Si escribes en un comentario o en un
`.md` que algo está resuelto, di con qué comando o con qué prueba se comprueba.
Si no hay forma de comprobarlo, escribe "sin verificar". Este repositorio ya
tuvo varias veces documentación que describía un sistema distinto al construido;
es el defecto más caro que hemos tenido.

**Ningún arreglo de bug sin una prueba que falle primero.** Escribe la prueba,
confirma el rojo, luego arregla, luego confirma el verde. Si no puedes escribir
la prueba que falla, todavía no entiendes el bug.

---

## Invariantes — no negociables

1. **Fallar cerrado, nunca abierto.** Si falta una credencial, una variable de
   entorno o una policy, el sistema se detiene. Prohibido el patrón
   `if (TOKEN && !esValido(...)) rechazar` — con el token ausente eso no
   autentica a nadie.

2. **"Falló la red" y "no hay dato" son estados distintos y se pintan distinto.**
   Prohibido `catch { setEstado(null) }`. Un fallo de lectura jamás debe
   presentarse como contenido borrado o preferencias vacías.

3. **RLS filtra FILAS, no COLUMNAS.** Leer datos ajenos se hace con una vista de
   lista blanca (`perfiles_publicos`, `publicaciones_publicas`) o con una función
   `security definer` con columnas explícitas. Nunca `select *` sobre una tabla
   con policy permisiva.

4. **Cuidado con `security invoker` sobre tablas cerradas.** Devuelve cero filas,
   sin error y sin log. Es el fallo AUD-01 y ya nos costó días. Al tocar
   cualquier función de sugerencias, pregunta siempre: *¿con qué identidad se
   evalúa esta línea?*

5. **Un filtro que el usuario toca se aplica en el SERVIDOR**, nunca sobre una
   página ya truncada en el cliente. Filtrar en el teléfono los primeros 30
   resultados hace que la app afirme "no hay nada" cuando sí hay.

6. **Migraciones: hacia adelante, idempotentes, con reversión escrita.**
   - Nunca editar una migración ya aplicada. Su hash vive en
     `supabase_migrations.schema_migrations` y editarla hace que el historial
     deje de describir lo que realmente corrió. Se corrige con una migración
     nueva. La siguiente es la **0022**.
   - Nombra explícitamente todo índice. Un `drop index if exists` sobre un nombre
     autogenerado que adivinaste falla en silencio.
   - Antes de cualquier `db push`: `npx supabase db dump --data-only -f respaldos/$(date +%F).sql`.
   - Si amplías una policy de RLS o de Storage, añade su prueba en
     `supabase/tests/rls.test.sql` **en el mismo commit**.

7. **Tokens de diseño o nada.** Prohibido `fontSize:`, `fontFamily:`, literales
   `#hex` o espaciados sueltos dentro de `src/components/**` y `src/app/**`. Todo
   sale de `src/constants/theme.ts`. Si falta un token, se añade al tema; no se
   escribe el valor a mano.

   Dos excepciones, y solo dos:
   - `src/components/themed-text.tsx` (24 apariciones), donde la escala
     tipográfica se **define**. Tiene que escribir los valores: es su fuente.
   - `src/app/_layout.tsx` (5) y `src/app/(tabs)/_layout.tsx` (3), porque el tema
     de React Navigation exige valores crudos y no acepta tokens.

   **Deuda declarada (19/09/2026):** otros 19 archivos incumplen esto con **29**
   apariciones, para un total de **61**. Se corrigen al tocarlos, no en una
   pasada aparte. Cero literales `#hex`: eso sí está limpio. Para medirlo:

   ```bash
   grep -rn 'fontSize:\|fontFamily:' src/components src/app --include=*.tsx \
     | grep -v __tests__ | wc -l
   ```

   Ese número solo puede bajar. Si sube, el commit que lo subió está mal.

8. **Objetivo táctil mínimo 44×44 pt**, contando `hitSlop`. Sin excepciones.

9. **Contraste medido, no supuesto** — y eso incluye superficie contra
   superficie, no solo texto sobre fondo.

---

## Secretos

Tres archivos, con destinos distintos. Los dos primeros **están diseñados,
documentados e implementados**; el tercero está pendiente de crearse.

- **`.env` (raíz) = CLIENTE.** Todo lo que lleva `EXPO_PUBLIC_` se compila dentro
  del bundle, donde cualquiera con el APK lo lee. Aquí solo van valores públicos
  por diseño: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
  `EXPO_PUBLIC_MAPBOX_TOKEN` (el `pk.`, con restricción de URL).
- **`ai-service/.env` = MICROSERVICIO.** `ANTHROPIC_API_KEY`, `AI_SHARED_TOKEN`,
  `AI_SHARED_TOKEN_SIGUIENTE`, `MODELO_EMBEDDINGS`, `MODELO_LLM`, `TIMEOUT_LLM`.
  Es el que lee `ai-service/config.py` con `os.getenv` y el que
  `docker-compose.yml` declara en `env_file`. Plantilla en
  `ai-service/.env.example`.
- **`.env.server` = HERRAMIENTAS Y SCRIPTS.** `SUPABASE_SERVICE_ROLE_KEY` (ocho
  scripts y dos Edge Functions) y `SUPABASE_DB_PASSWORD` (lo consume el CLI de
  Supabase, no código nuestro).

> **Estado actual, verificado el 19/09/2026:**
> - `ai-service/.env` **no existe en esta máquina**. Falta correr el paso que el
>   README ya documenta: `cd ai-service && cp .env.example .env`. No es una
>   discrepancia de arquitectura, es un paso de instalación pendiente.
> - `.env.server` no existe; `SUPABASE_SERVICE_ROLE_KEY` y
>   `SUPABASE_DB_PASSWORD` siguen en el `.env` de la raíz, que es el del
>   cliente. Al tocar cualquier script que las lea, sepáralas en vez de
>   perpetuarlo.

> **Dos variables del `.env` de la raíz están MUERTAS. Bórralas, no las muevas.**
> Verificado con grep sobre `src/`, `scripts/`, `ai-service/` y
> `supabase/functions/`:
> - **`PERFIL_ENCRYPTION_KEY`** — cero lectores. Las migraciones 0005 y 0009 usan
>   `current_setting('app.perfil_encryption_key')`, que es un **GUC de Postgres**:
>   otra cosa, con nombre parecido. El cifrado que la justificaba lo retiró §30.
> - **`MAPBOX_ACCESS_TOKEN`** — cero lectores. El único Mapbox vivo es
>   `EXPO_PUBLIC_MAPBOX_TOKEN` en `src/lib/mapboxAutocomplete.ts`. El nombre
>   sugiere que es su par privado; no lo es, y no lo usa nadie.
>
> Una credencial que nadie usa sigue siendo una credencial que se puede filtrar.
> **Antes de declarar que una variable es "de servidor", corre el grep.** Deducir
> del nombre ya metió una credencial fantasma en este archivo una vez.

Nunca añadas `EXPO_PUBLIC_` a algo que no sea público por diseño. Ninguno de los
tres archivos se versiona.

---

## Terminado significa esto

Antes de decir que algo está listo, en verde:

```bash
npx tsc --noEmit
npm run lint
npm test
```

Si tocaste SQL, además:

```bash
npx supabase test db
```

No hay script `typecheck`; se corre `npx tsc --noEmit` a mano.

Cambios de UI: además **probado en dispositivo real**, no solo en el simulador.
Modo claro y modo oscuro.

---

## Antes de exponer la app a alguien

```bash
node scripts/verificar.mjs          # túnel, secrets, vectores, RPCs
node --env-file=.env scripts/prueba-rls.mjs   # 15 barreras contra PRODUCCIÓN
```

Ver [docs/verificacion-pre-demo.md](docs/verificacion-pre-demo.md). El túnel de
Cloudflare cambia de dominio en cada arranque y hay que volver a fijar
`AI_SERVICE_URL`; usa `./scripts/tunel.sh`, nunca `cloudflared tunnel --url` a
secas.

Las cuentas y publicaciones de demo son **fabricadas a propósito** y se precargan
antes. Nunca registres una cuenta real delante del evaluador.

---

## Prohibido

- Editar una migración ya aplicada.
- Ampliar una policy sin su prueba en el mismo commit.
- Poner secretos de servidor en el `.env` de la raíz.
- Adelantar trabajo de semanas posteriores del plan de 12 semanas porque "se ve
  más impresionante". La secuencia existe para no quedarse sin tiempo.
- Declarar algo hecho sin su comando de verificación en verde.
- Marcar una casilla de un plan o una bitácora por una intención en vez de por un
  resultado comprobado.

---

## Documentos de referencia

| Archivo | Qué es |
|---|---|
| [PRODUCT.md](PRODUCT.md) | Usuarios, alcance, principios de producto |
| [DESIGN.md](DESIGN.md) | Sistema visual "La Ficha": color, tipografía, componentes |
| [docs/bitacora-semanal.md](docs/bitacora-semanal.md) | Qué se hizo cada semana y qué se rompió |
| [docs/modelo-amenazas.md](docs/modelo-amenazas.md) | Qué protege el diseño y qué no |
| [docs/aplicar-migraciones.md](docs/aplicar-migraciones.md) | Leer antes del primer `db push` en una máquina nueva |
| [docs/verificacion-pre-demo.md](docs/verificacion-pre-demo.md) | Checklist previo a exponer |
