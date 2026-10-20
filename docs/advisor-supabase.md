# Security Advisor de Supabase · hallazgos y decisión

Captura del 20/10/2026 (panel: 8 errores, 24 advertencias, 9 sugerencias). Se revisó lo que el panel muestra y las exportaciones CSV de las pestañas *Info* y *Warnings*.

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

## Advertencias (24)
**21 × `authenticated_security_definer_function_executable`.** `abrir_conversacion`, `aceptar_aviso`, `afinidad_de`, `afinidad_roomie_de`, `agregar_funcion`,
`buscar_codigo_postal`, `consumir_cuota`, `contactos_de_mis_publicaciones`, `enviar_verificacion`, `favoritos_por_publicacion`, `mi_suscripcion`, `negocio_abierto_en`,
`negocios_ordenados`, `puede_subir_evidencia`, `registrar_error_app`, `reportar_resena`, `responder_resena`, `revelar_contacto`, `simular_pago`, `sugerencias_roomies` y
`tiene_rol_aprobado`. **Comprobado (20/10/2026): las 21 están en la lista blanca de la aserción 75** de `supabase/tests/rls.test.sql` (0 fuera de ella); esa aserción se rompe sola
si aparece una más. Cada una fija `auth.uid()` dentro y no acepta el id de «yo» (invariante 9). Son RPC que la app llama a propósito; que corran con permisos de su dueño
es lo que les permite leer tablas cerradas con columnas explícitas (invariante 3). Casos que se miraron con cuidado:
- `consumir_cuota(recurso, límite)`: el cliente puede llamarla directo, pero solo gasta SU cuota (no hay forma de reiniciarla: `devolver_cuota` es de servicio), el
  `recurso` está limitado por un CHECK y los límites reales los fija cada Edge Function al llamarla.
- `simular_pago`: solo actúa con `demo_mode` encendido; apagado, responde CP010.

**2 × `extension_in_public`** (`vector`, `pg_net`). **Decisión: se dejan.** Mover `vector` fuera de `public` exigiría reescribir el `search_path` de todas las funciones que usan
sus operadores (`<=>`) y recrear columnas `vector(384)`; el riesgo de romper las sugerencias es mayor que el beneficio (el aviso es de limpieza, no de explotación).

**1 × `auth_leaked_password_protection`.** Se activa en el panel (*Authentication*), no por migración. Pendiente de la persona responsable; puede estar limitada por el plan.

## Pendiente
- Activar la protección contra contraseñas filtradas en el panel.
- Aplicar la 0074 en producción (`db dump` + `db push`).
