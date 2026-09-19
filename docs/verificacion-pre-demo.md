# Verificación pre-demo

```bash
node scripts/verificar.mjs
```

Diez segundos. Sale con código 1 si algo está roto.

## Por qué existe

El 18 de septiembre de 2026 aparecieron tres fallos el mismo día:

1. `revelar_contacto` moría con **42P10** — un `on conflict` contra un índice
   único *parcial* sin repetir el predicado. "Ver contacto" no funcionó nunca.
2. Un fallo transitorio del microservicio **borraba el `perfil_vector`** del
   usuario, porque el código no distinguía "retiré el consentimiento" de "el
   servicio falló". Nivel 2 muerto, permanentemente, en silencio.
3. El secret `AI_SERVICE_URL` apuntó durante horas a un túnel muerto, mientras
   el microservicio respondía perfectamente en `localhost`.

Lo que tienen en común no es la causa: es que **ninguno se anunció**. Los tres
se encontraron por casualidad, y los tres habrían aparecido en vivo. Este script
convierte esa casualidad en una pregunta que se hace a propósito.

## Qué revisa

| Comprobación | Qué detecta |
|---|---|
| Secrets de Edge Functions | `AI_SERVICE_URL` o `AI_SHARED_TOKEN` ausentes |
| Análisis con LLM | sin `ANTHROPIC_API_KEY`, `/parsear-perfil` devuelve constantes |
| Túnel | el dominio público no responde — se pregunta **por fuera**, no en localhost |
| Vectores de perfil | cuentas con consentimiento puesto y vector nulo |
| Vectores de publicaciones | activas sin vector: invisibles para el Nivel 2 |
| Cola de fotos huérfanas | archivos que alguien creyó borrados y siguen ocupando espacio |
| Geocodificación | activas sin coordenadas o fuera del centro de México |
| Cadena de IA | app → `ai-proxy` → túnel → microservicio, con sesión real |
| `revelar_contacto` | que corra **y** que repetirla no duplique el registro |
| `abrir_conversacion` | que corra y sea idempotente (AUD-07) |

Las tres últimas necesitan una sesión de verdad, así que el script crea una
cuenta temporal y la borra en un `finally`. Las claves foráneas de
`conversaciones`, `mensajes` y `contactos` son `on delete cascade`, así que no
queda rastro. Si alguna vez ves cuentas `verif-…@ejemplo.mx` en la base, el
`finally` no corrió y hay que borrarlas a mano.

## Añadir la clave de Anthropic después

Se puede en cualquier momento, sin tocar código ni redesplegar nada:

1. Poner `ANTHROPIC_API_KEY=` donde la lea el microservicio. **No** va en los
   secrets de Supabase: quien llama al modelo es el servicio de Python, no una
   Edge Function.

   Su destino, según AGENTS.md, es **`.env.server`**. Ese archivo todavía no
   existe y el microservicio arranca con `. ../.env`, así que hoy la lee del
   `.env` de la raíz. Al separar los secretos habrá que mover también el
   arranque; mientras tanto, va en el de la raíz.
2. Reiniciar el microservicio. `config.py` lee la variable con `os.getenv` en
   tiempo de import, así que un proceso ya arrancado no la ve.
3. `node scripts/verificar.mjs` debe pasar de aviso a OK.

Sin ella, lo único que se pierde es `horario_predominante`, un campo del perfil
público que ya degrada a "Variable". **No toca el ranking ni el embedding:** el
Nivel 2 corre en un modelo local y no depende de ninguna API de pago.

## Qué hacer con cada fallo

- **Túnel caído** → `./scripts/tunel.sh`. Fija el secret antes de esperar al DNS,
  que una noche tardó más de media hora en publicarse.
- **Cuenta con consentimiento y sin vector** → esa persona entra a
  Perfil → Preferencias y guarda otra vez. Con el servicio arriba se regenera.
- **Cola de fotos huérfanas con filas** → `node --env-file=.env scripts/limpiar-fotos-huerfanas.mjs`.
  No es un fallo: el borrado de la cuenta sí funcionó. Es deuda visible, que es
  justo lo que la migración 0021 buscaba en vez de un trigger que reventaba.
- **Publicaciones sin vector** → `node --env-file=.env scripts/backfill-embeddings.mjs`
  (con `--todos` si hay que regenerarlos todos, no solo los que faltan).
- **Geocodificación rara** → suelen ser datos de prueba viejos, anteriores al
  formulario de dirección estructurado. Si vienen del sembrado,
  `node --env-file=.env scripts/fix-demo-coordinates.mjs` las corrige; si son
  altas de prueba sueltas, se borran a mano. No es un bug de código: el
  formulario actual exige calle, número, CP, colonia, municipio y estado, así
  que ya no puede producir una dirección tan incompleta.
- **`revelar_contacto` o `abrir_conversacion` fallan** → es la base, no la app.
  Revisa que las migraciones estén aplicadas (`npx supabase db push`).

## Qué NO revisa

Deliberadamente, para no dar una falsa sensación de cobertura:

- **Las policies de RLS.** Eso es `supabase test db` — 21 aserciones en
  `supabase/tests/rls.test.sql`, y corre en CI.
- **Que la app compile.** Eso es `npx tsc --noEmit` y `npx expo lint`.
- **Que la interfaz se vea bien.** Eso solo se ve en un dispositivo.

Antes de exponer conviene correr los tres: este script, `supabase test db`, y
`npx tsc --noEmit && npx expo lint && npx jest`.
