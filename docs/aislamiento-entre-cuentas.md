# Prueba de aislamiento entre cuentas

```bash
node --env-file=.env scripts/prueba-rls.mjs
```

Crea dos cuentas temporales, comprueba que la primera no puede tocar nada de la
segunda, y las borra. Sale con código 1 si alguna barrera cede.

**Resultado del 19/09/2026: 15 de 15 barreras aguantaron.**

## Qué comprueba

| # | Barrera | Cómo se verifica |
|---|---|---|
| 1 | `usuarios` solo devuelve la fila propia | A consulta la tabla entera: 1 fila |
| 2 | Ni pidiendo la fila de B por su id | 0 filas |
| 3 | `perfiles_publicos` no expone presupuesto ni `perfil_texto` | lista de columnas |
| 4 | El teléfono no sale de la tabla `publicaciones` | 0 filas |
| 5 | La vista pública sí muestra la publicación, sin `whatsapp` | 1 fila, columna ausente |
| 6 | A no modifica la publicación de B | 0 filas afectadas |
| 7 | A no borra la publicación de B | 0 filas afectadas |
| 8 | A no publica suplantando a B | la policy rechaza el INSERT |
| 9 | A no modifica el perfil de B | 0 filas afectadas |
| 10 | `cuotas_uso` no es legible desde el cliente, ni la propia | 0 filas |
| 11 | A no altera un mensaje de B | 0 filas afectadas |
| 12 | Una tercera cuenta no lee una conversación ajena | 0 filas |
| 13 | Sin sesión no se lee `usuarios` | 0 filas |
| 14 | A no sube a la carpeta de publicaciones de B | Storage rechaza |
| 15 | A no sobrescribe la foto de perfil de B | Storage rechaza |

## Por qué existe, si ya está pgTAP

`supabase/tests/rls.test.sql` tiene 21 aserciones y corre en CI. Esta prueba no
lo reemplaza: responde dos preguntas que aquél no puede.

**Corre contra producción.** El esquema local no es idéntico al real: producción
tiene un event trigger `ensure_rls` que instala Supabase y el local no. Es decir,
**CI valida un esquema más laxo que el que va a estar el día de la demo.**

**Pregunta por HTTP, a través de PostgREST**, que es el camino que recorre la
app. pgTAP habla con Postgres directamente. Si una policy fuera correcta pero
una vista o un `grant` expusieran de más por la API, pgTAP no lo vería.

## Cómo leer los resultados

RLS casi nunca da error. En un `SELECT` devuelve **cero filas**; en un `UPDATE`
o `DELETE` afecta **cero filas**. Las dos cosas, en silencio.

Por eso cada comprobación afirma sobre el *número de filas* y no sobre la
presencia de una excepción. Una prueba que solo mirara `error !== null` pasaría
en verde con la tabla completamente abierta. Las únicas cuatro que sí esperan
error son las de INSERT y Storage, donde la policy tiene un `with check` que
rechaza la escritura en vez de filtrarla.

## Si alguna barrera cede

No es un aviso: es una fuga de datos. Parar, mirar qué policy cambió con
`select * from pg_policies where tablename = '<tabla>'`, y corregirla con una
migración nueva — nunca editando una ya aplicada.
