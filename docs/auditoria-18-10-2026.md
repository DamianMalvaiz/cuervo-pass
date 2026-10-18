# Auditoría del 18/10/2026

Alcance: lo que se pudo **comprobar con comandos** contra la base de producción (solo lectura), una base local con las mismas migraciones, el
repositorio público, las Edge Functions, Storage, el ciclo de vida de la cuenta y las dependencias.
**No cubre:** una prueba de intrusión, la revisión pantalla por pantalla del código de la app, ni nada que exija verla en un teléfono.
Cada hallazgo dice con qué se comprobó; lo que no se comprobó se marca «sin verificar».

## Resumen

| # | Gravedad | Hallazgo | Estado |
|---|---|---|---|
| C1 | **CRÍTICO** | Las vistas «públicas» se podían escribir: cualquier cuenta editaba y borraba publicaciones y anuncios de roomie ajenos | Corregido en la 0061, **sin aplicar** |
| A1 | Alto | Eliminar la cuenta no borra las fotos de negocios ni la evidencia de verificación (salvo la INE, que el barrido recoge en ≤ 1 día) | Abierto |
| A2 | Alto | `exportar_mis_datos` no incluye lo nuevo (funciones, verificación, negocios, reseñas, favoritos, suscripciones) | Abierto |
| A3 | Alto | Cualquier cuenta puede subir archivos sin tope al bucket `verificacion`; solo los de nombre `ine-…` se barren | Abierto |
| M1 | Medio | Quien vende no recibe aviso al ser aprobado o rechazado | Abierto |
| M2 | Medio | El límite de 1 anuncio del arrendador gratis no se impone | Abierto (decisión) |
| M3 | Medio | Sin monitoreo de errores en producción | Abierto |
| M4 | Medio | La IA depende de una laptop y un túnel temporal | Abierto (riesgo de demo) |
| M5 | Medio | Verificaciones pendientes sin plazo (INE sin borrar) | Abierto (decisión) |
| M6 | Medio | `vector` y `pg_net` instaladas en `public` | Abierto |
| B1 | Bajo | 48 avisos altos de `npm audit`, todos en herramientas de desarrollo | Informativo |
| B2 | Bajo | Panel de admin: listas de 100 sin paginar ni buscar | Abierto |

## C1 · Las vistas públicas eran escribibles (CRÍTICO)

**Qué pasaba.** `publicaciones_publicas` y `roomies_publicos` son vistas de una sola tabla, así que PostgreSQL las hace actualizables. Se crearon
con `security_invoker = false` (para poder leer lo que RLS ocultaría), y entonces **una escritura a través de ellas corre con los permisos del
dueño de la vista y se salta RLS**. Las migraciones 0014 y 0024 hicieron `revoke … from public/anon` y `grant select … to authenticated`, pero
Supabase concede todos los privilegios a `authenticated` en cada objeto nuevo y `grant select` no quita el resto.

**Cómo se comprobó.**
- Producción (solo lectura): `information_schema.role_table_grants` muestra `DELETE, INSERT, UPDATE…` para `authenticated` sobre
  `publicaciones_publicas` y `roomies_publicos`; `information_schema.views` las marca `is_updatable = YES`.
- Base local con las mismas migraciones: la cuenta B ejecutó `update` y `delete` sobre las vistas contra filas de la cuenta A → **1 fila afectada
  en las cuatro pruebas**. No se repitió en producción a propósito (habría sido escribir datos reales).
- Las pruebas de RLS no lo vieron porque ejercitaban las tablas, no las vistas.

**Arreglo.** `supabase/migrations/0061_cerrar_privilegios_de_vistas_y_anon.sql`: vistas solo `SELECT` para `authenticated`; `anon` sin
privilegios sobre tablas y secuencias de `public`; sin `TRUNCATE/REFERENCES/TRIGGER` para `authenticated`; `alter default privileges` para que lo
nuevo no nazca abierto. Misma prueba de ataque tras el arreglo: `42501` en las cuatro. 12 aserciones nuevas en `rls.test.sql` (408 en total).

**Pendiente.** Aplicarla en producción y correr `scripts/prueba-rls.mjs` y `scripts/verificar.mjs` después.
**Lección.** Una prueba de RLS que solo mira tablas no protege a las vistas: ahora hay una que recorre todos los privilegios de todas las vistas.

## A1 · Eliminar la cuenta es incompleto

`supabase/functions/eliminar-cuenta/index.ts` borra del bucket `fotos` solo `perfiles/<id>.jpg` y las fotos de `publicaciones`. No toca:
- `negocios/<id>/…` (fotos de negocios, mismo bucket) — las filas se borran en cascada, los archivos **quedan para siempre**;
- el bucket `verificacion` (INE, reverso, fotos del lugar). La INE la recoge el barrido de huérfanas (0058) porque su fila desaparece; las **fotos
  del lugar y cualquier otro nombre no**.
El aviso v3 promete «todo lo anterior se borra en cascada, incluidas tus fotos del almacenamiento». Hoy no es del todo cierto.
**Arreglo propuesto:** listar y borrar por carpeta (`negocios/<ids de sus negocios>/`, `verificacion/<id>/`) en esa misma función, con prueba.

## A2 · El acceso a tus datos no incluye lo nuevo

`exportar_mis_datos` (0017) devuelve perfil, publicaciones, roomie, mensajes enviados y contactos. Faltan: funciones, verificación (nombre legal,
dirección, versión del aviso), negocios y su menú, favoritos, reseñas, suscripciones y pagos. El aviso v3 describe lo que la descarga trae
(perfil, publicaciones, mensajes, contactos), así que **no miente, pero el derecho de Acceso queda corto** respecto de los datos que ahora se tratan.
**Arreglo propuesto:** nueva migración con la función ampliada (+ actualizar el aviso).

## A3 · Subidas sin tope al bucket `verificacion`

La política `verificacion: subir lo propio` deja a **cualquier cuenta autenticada** subir imágenes a su carpeta, sin exigir tener la función de
vendedor ni limitar cuántas (solo 6 MB por archivo y jpeg/png). Los archivos que no se llaman `ine-frente|ine-reverso-…` no los barre nadie.
Es un abuso de almacenamiento posible, no una fuga. **Arreglo propuesto:** exigir una función de vendedor y ampliar el barrido a toda la carpeta
con edad > 1 día sin referencia.

## M1 · Sin aviso al aprobar o rechazar
Solo los mensajes disparan notificaciones push. Quien vende tiene que abrir la app para enterarse. Es lo más natural de añadir tras el panel.

## M2 · Arrendador gratis
`planes` dice `arrendador_gratis` con `limite_principal = 1`, pero ninguna restricción lo aplica a publicaciones de vivienda (decisión pendiente desde la Fase 3).

## M3 · Sin monitoreo
No hay Sentry ni equivalente (`grep` en `package.json`/`app.json`). Los fallos que `lib/registro.ts` anota van a la consola del teléfono: en
producción nadie los ve. Para un proyecto graduado en vivo, al menos un resumen de errores sería útil.

## M4 · La IA vive en una laptop
El servicio de IA corre en tu laptop detrás de un túnel de Cloudflare cuyo dominio cambia en cada arranque (`scripts/tunel.sh`). Si la laptop se
apaga, la afinidad semántica cae a Nivel 1 (lo previsto, y dicho en pantalla), pero conviene saberlo antes de la demo.

## M5 · Verificaciones pendientes sin plazo
Una verificación que nadie revisa conserva su INE sin límite. Es un problema de operación: el panel de admin la hace visible, pero no hay recordatorio.

## M6 · Extensiones en `public`
`vector` y `pg_net` están en el esquema `public` (el resto en `extensions`). Es la advertencia estándar de Supabase; moverlas es una migración con riesgo
de romper las funciones que usan los tipos, así que se deja para después de la prueba en vivo.

## B1 · `npm audit`
48 avisos altos, **todos en cadenas de desarrollo** (`jest`, `metro`, `@expo/cli`, `node-forge`, `braces`, `micromatch`): ReDoS y similares en
herramientas que no van en la app. No se arreglan sin saltos mayores de versión. Informativo.

## B2 · Panel de admin
Listas limitadas a 100 filas sin paginar ni buscar. Suficiente para la demo.

## Lo que se revisó y salió bien

- **Secretos:** ni el árbol ni todo el historial público contienen claves de servicio, tokens, llaves privadas ni JWT (patrones `sk-ant-`, `sb_secret_`,
  `BEGIN PRIVATE KEY`, `eyJ…`). `.env`, `.env.server`, `respaldos/`, `experimentos/`, `demo-material/` no están versionados.
- **Repositorio público:** 519 archivos versionados, ninguno con datos personales reales (solo el correo del responsable, que el aviso exige, y correos de
  ejemplo en pruebas). Sin binarios sensibles. Las dos ramas remotas extra no difieren de `main`.
- **EAS:** un paquete de 494 MB subió `experimentos/` (fotos personales) porque EAS no lee `.git/info/exclude`; se canceló antes de compilar y `.easignore` lo impide
  (`fb757e2`). El archivo de esa construcción puede seguir en tu cuenta de EAS.
- **RLS:** 0 tablas de `public` sin RLS. Las 7 con RLS y sin ninguna policy son de servicio por diseño (`acciones_admin`, `verificaciones_biometria`,
  `resenas_reportes`, `cuotas_uso`, `fotos_huerfanas`, `configuracion_app`, `geocodificaciones_ritmo`). 0 policies para `anon` o `public`, en tablas ni en Storage.
- **Funciones:** 0 funciones `security definer` sin `search_path` fijo; `anon` solo ejecuta las de la extensión `vector`.
- **Storage:** los dos buckets son privados, con tipo y tamaño acotados; las policies de lectura y escritura están acotadas por dueño o por visibilidad.
- **Edge Functions:** `verify_jwt` activo en las de usuario y apagado solo en los barridos de cron (que exigen su secreto).
- **Código:** 0 `as any`, 0 `@ts-ignore`, 0 pruebas saltadas, 2 `eslint-disable` (en pruebas), 0 `TODO/FIXME`, `console.*` solo dentro de `lib/registro.ts`.

## Acciones tuyas (no puedo hacerlas yo)
- Aplicar la 0061 (ver C1) con el flujo de siempre.
- Activar «Confirm email» en el panel de Supabase, fijar el Site URL real y valorar SMTP propio.
- `rm -rf respaldos/*` cuando ya no se necesiten (los dumps llevan datos personales).
- Revisar en el panel de EAS si puedes borrar la construcción cancelada.
- La revisión legal del aviso de privacidad v3.
