# Security Advisor de Supabase · hallazgos y decisión

Captura del 20/10/2026 (panel: 8 errores, 24 advertencias, 9 sugerencias). Se revisó lo que el panel muestra y la exportación CSV de la pestaña *Info*. **La pestaña
*Warnings* (24) no se ha revisado todavía**: este documento no la cubre y no afirma nada sobre ella.

## Errores · `security_definer_view` (8)
`resenas_publicas`, `calificacion_publicaciones`, `negocios_publicos`, `perfiles_publicos`, `publicaciones_publicas`, `roomies_publicos` y `negocio_horarios_publicos`
(el octavo no salía en la captura; probablemente `negocio_items_publicos`, sin confirmar).

**Decisión: se mantienen, a propósito.** Es el patrón de la invariante 3 de `AGENTS.md`: las tablas están cerradas y la lectura de lo ajeno va por vistas de lista
blanca con los permisos de su dueño. Convertirlas en `security invoker` obligaría a abrir policies de lectura sobre tablas que hoy están cerradas, que es el riesgo real.
Lo que las contiene:
- Solo conceden `SELECT` (aserción de pgTAP de la 0061, más las de 0070 para `negocio_horarios_publicos`).
- Ninguna trae datos privados (dueño de un negocio, correos, vectores).
- `scripts/prueba-rls.mjs` contra producción: 22 de 22 barreras, incluidas escrituras contra las vistas (20/10/2026).
La vista nueva respecto a la auditoría anterior es `negocio_horarios_publicos` (0070).

## Sugerencias · `rls_enabled_no_policy` (9)
`acciones_admin`, `codigos_postales`, `configuracion_app`, `cuotas_uso`, `errores_app`, `fotos_huerfanas`, `geocodificaciones_ritmo`, `resenas_reportes`,
`verificaciones_biometria`. Son **tablas de servicio**: RLS activo y sin policy significa «nadie del cliente entra», y es lo que se quiere. Verificado el 20/10/2026 contra
producción: `anon` recibe 42501 en las nueve, y el rol de servicio las lee.

**Un matiz que sí se corrigió (0074):** tres de ellas (`cuotas_uso`, `fotos_huerfanas`, `geocodificaciones_ritmo`) conservaban el INSERT/SELECT/UPDATE/DELETE por
defecto para `authenticated`. No había fuga (RLS sin policy lo impedía), pero era una sola barrera. La 0074 quita esos privilegios; una aserción de pgTAP comprueba que
las nueve no concedan nada a `anon` ni a `authenticated`.

## Pendiente
- Revisar la pestaña **Warnings** (24) con su exportación y anotarla aquí. Lo esperado, por la auditoría del 18/10: funciones `security definer` en la lista blanca de la
  aserción 75, `vector` y `pg_net` en el esquema `public`, y la protección contra contraseñas filtradas (se activa en el panel, *Authentication*).
- Aplicar la 0074 en producción (`db dump` + `db push`).
