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

8. **Objetivo táctil mínimo 44×44 pt**, contando `hitSlop`. Sin excepciones.

9. **Contraste medido, no supuesto** — y eso incluye superficie contra
   superficie, no solo texto sobre fondo.

---

## Secretos

Dos archivos, con destinos distintos:

- **`.env` (raíz) = CLIENTE.** Todo lo que lleva `EXPO_PUBLIC_` se compila dentro
  del bundle, donde cualquiera con el APK lo lee. Aquí solo van valores públicos
  por diseño: URL de Supabase, anon key, token `pk.` de Mapbox.
- **`.env.server` = SERVIDOR.** `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `SUPABASE_DB_PASSWORD`, `AI_SHARED_TOKEN`, `PERFIL_ENCRYPTION_KEY`. Nunca se
  lee desde la app.

> **Estado actual (por corregir):** `.env.server` todavía NO existe y las claves
> de servidor están mezcladas en el `.env` de la raíz. Es el mismo defecto que
> `.env.example` documenta como el peor de v3. Al tocar cualquier script que lea
> credenciales de servidor, sepáralas en vez de perpetuarlo.

Nunca añadas `EXPO_PUBLIC_` a algo que no sea público por diseño. Ninguno de los
dos archivos se versiona.

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
