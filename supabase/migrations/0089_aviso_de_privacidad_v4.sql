-- 0089 · Aviso de privacidad, versión 4.
--
-- Una versión nueva del aviso se REGISTRA con una migración, en el mismo paso que la publica (0075): `aceptar_aviso` y el alta solo guardan una versión que
-- exista en `avisos_privacidad`. Sin esta fila, la app que ya pida aceptar la v4 recibiría un rechazo (22023).
--
-- ── ORDEN DE APLICACIÓN ─────────────────────────────────────────────────────
-- ESTA migración se aplica ANTES de que el código con `VERSION_AVISO = 'v4'` llegue a cualquier teléfono. Al revés, la app pediría aceptar una versión que la base
-- todavía no reconoce y nadie podría entrar.
--
-- ── Qué cambia la v4 (el texto vive en src/lib/avisoPrivacidad.ts y docs/aviso-privacidad.md) ──
-- Los pagos con Mercado Pago, las notificaciones, los productos de la tienda y el favorito de negocios; las rutas de la app para ejercer los derechos ARCO
-- (ya no hay «Descargar mis datos») y el retiro de «los cobros son simulados».
--
-- Reversión (no se usa, pero se escribe):
--   delete from avisos_privacidad where version = 'v4';   -- solo si nadie ha aceptado la v4 todavía

insert into avisos_privacidad (version) values ('v4') on conflict (version) do nothing;
