-- 0091 · Aviso de privacidad, versión 5.
--
-- Una versión nueva del aviso se REGISTRA con una migración, en el mismo paso que la publica (0075): `aceptar_aviso` y el alta solo guardan una versión que
-- exista en `avisos_privacidad`. Sin esta fila, la app que ya pida aceptar la v5 recibiría un rechazo (22023).
--
-- ── ORDEN DE APLICACIÓN ─────────────────────────────────────────────────────
-- ESTA migración se aplica ANTES de que el código con `VERSION_AVISO = 'v5'` llegue a cualquier teléfono. Al revés, la app pediría aceptar una versión que la base
-- todavía no reconoce y nadie podría entrar. Se aplica junto con la 0090, que es la que abre la exploración sin cuenta.
--
-- ── Qué cambia la v5 (el texto vive en src/lib/avisoPrivacidad.ts y docs/aviso-privacidad.md) ──
-- La web se puede explorar SIN cuenta. Quien no la tiene ve, de una vivienda: título, tipo, precio, recámaras, condiciones, zona (sin calle ni número), ubicación
-- aproximada (~1 km), calificación y fotos; de un negocio: nombre, descripción, zona, horario, productos con precio, calificación y fotos. NO ve la dirección exacta,
-- el teléfono, quién publica ni la descripción de una vivienda. Como cambia QUIÉN ve lo que alguien publicó, todas las cuentas aceptan la versión nueva.
--
-- Reversión (no se usa, pero se escribe):
--   delete from avisos_privacidad where version = 'v5';   -- solo si nadie ha aceptado la v5 todavía

insert into avisos_privacidad (version) values ('v5') on conflict (version) do nothing;
