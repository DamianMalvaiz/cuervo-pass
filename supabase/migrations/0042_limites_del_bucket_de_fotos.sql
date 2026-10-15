-- Límites propios del bucket `fotos`: 5 MiB por archivo y solo image/jpeg.
--
-- ── El hallazgo ─────────────────────────────────────────────────────────────
-- Se buscaba un tope a las filas INACTIVAS de `publicaciones`, por el riesgo de
-- almacenamiento («cada una con hasta ocho fotos»). Al medirlo resultó que las filas
-- no son el vector: la policy de subida (0002) solo comprueba la CARPETA de la
-- cuenta, no que exista una fila, y el bucket no tenía límite de tamaño ni de tipo.
-- Cualquier sesión podía subir archivos de hasta 50 MiB (el tope global del servicio)
-- y de cualquier tipo a `publicaciones/<su-id>/...` sin crear una sola fila. Un tope
-- a las filas habría dado una falsa sensación de seguridad. Comprobado contra
-- Storage antes de esta migración (scripts/verificar-bucket-fotos.mjs): se aceptaban
-- un archivo de 6 MiB, un text/plain y un image/png.
--
-- ── Por qué estos valores ───────────────────────────────────────────────────
-- Son lo que la app YA envía, así que no atrapan a nadie:
--   · TIPO: toda subida —`src/lib/storage.ts`, los scripts de siembra y las pruebas—
--     declara `image/jpeg`, y `comprimirImagen` convierte a JPEG antes de subir (un
--     HEIC de iPhone sale como JPEG).
--   · TAMAÑO: la foto de publicación se redimensiona a 1024 px de ancho y la de perfil
--     a 512, con compresión 0.7. Se estima por debajo de 500 KB; NO SE MIDIÓ en un
--     teléfono. 5 MiB deja un margen de diez veces. Si una foto legítima alguna vez lo
--     superara, la subida fallaría con un error de Storage: ese es el costo del límite
--     y es lo que hay que vigilar en el primer uso real.
--
-- ── Lo que NO resuelve ──────────────────────────────────────────────────────
-- La CANTIDAD de archivos por cuenta sigue sin tope: un cliente malicioso puede subir
-- muchos archivos pequeños a su carpeta. Acotarla exige tocar la policy de Storage y
-- cuidar el `upsert` —un reemplazo en el tope no debe fallar—, y queda como decisión
-- aparte. Los archivos ya subidos no se tocan: el límite aplica a las subidas nuevas.
--
-- Idempotente: se puede repetir sin efecto.
--
-- Verificación:
--   · aserciones 97 y 98 de supabase/tests/rls.test.sql (la configuración);
--   · node --env-file=.env --env-file=.env.server scripts/verificar-bucket-fotos.mjs
--     (que Storage la APLICA: sube sondas de verdad).
--
-- Reversión:
--   update storage.buckets set file_size_limit = null, allowed_mime_types = null
--    where id = 'fotos';

update storage.buckets
   set file_size_limit    = 5242880,
       allowed_mime_types = array['image/jpeg']
 where id = 'fotos';
