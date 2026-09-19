-- Documento maestro v5 · §12 · ORDEN A.7 — la señal de confianza que faltaba.
--
-- Contexto. PRODUCT.md dice que el usuario primario decide «sight-unseen»:
-- desde otra ciudad, sin poder visitar el lugar antes de mudarse. Toda la
-- confianza del producto descansa en tres cosas —foto, biografía y reportes— y
-- las tres las escribe la misma persona de la que hay que fiarse.
--
-- La señal más barata y más fuerte que existe para ese usuario, «esta persona
-- tiene un correo de una universidad», estaba sin usar. Y del otro lado, el
-- registro abierto sin verificación hacía que una cuenta no costara nada, lo
-- que abarataba el brigading: tres desechables tumban cualquier publicación
-- (0013) o suspenden a cualquiera (0023).
--
-- Las dos mitades: `enable_confirmations = true` en config.toml y el filtro de
-- dominio en src/lib/correoUniversitario.ts. Esta migración solo hace VISIBLE
-- el resultado.
--
-- ═══ Por qué no hay columna nueva ═══
--
-- Lo evidente sería `usuarios.correo_verificado_en` y un trigger que la
-- sincronice desde auth.users. Sería un segundo lugar donde vive el mismo
-- hecho, con su ventana de desincronización: `email_confirmed_at` se llena en
-- auth y la copia se queda atrás si el trigger falla o si alguien confirma por
-- un camino que no lo dispare. Y una insignia de confianza que miente es peor
-- que no tenerla.
--
-- La vista es `security_invoker = false` y su dueño es `postgres`, así que
-- puede leer `auth.users`. El dato se deriva en la consulta y no puede
-- desincronizarse porque no se copia.
--
-- ═══ Qué NO prueba esta insignia ═══
--
-- Que el correo existe y que la persona lo controla. No que sea estudiante
-- vigente, ni que sea quien dice, ni que el departamento que publica sea suyo.
-- §28 y docs/modelo-amenazas.md siguen aplicando enteros. La insignia dice
-- «verificamos su correo», y eso es literalmente lo que debe leerse en la
-- interfaz — no «usuario verificado».
--
-- ═══ Por qué `create or replace` y no `drop` + `create` ═══
--
-- Desde la 0022, la policy `leer foto de perfil visible` sobre storage.objects
-- consulta esta vista, asi que Postgres se niega a soltarla:
--
--   cannot drop view perfiles_publicos because other objects depend on it
--
-- Es una dependencia buena —la visibilidad de las fotos se DERIVA de la
-- visibilidad del perfil, en un solo sitio— pero tiene un precio que hay que
-- conocer: `create or replace view` solo permite AÑADIR columnas al final y
-- exige conservar nombre, tipo y orden de las existentes. Cualquier cambio que
-- no sea aditivo obliga a soltar antes las policies que dependen de ella y
-- recrearlas después, en la misma migración.
--
-- Reversión:
--   create or replace view perfiles_publicos with (security_invoker = false) as
--     -- la definicion de la 0014, sin la ultima columna
--   -- ...pero `create or replace` tampoco deja QUITAR columnas, asi que hay
--   -- que soltar primero las dos policies de la 0022 y recrearlas.

create or replace view perfiles_publicos with (security_invoker = false) as
  select u.id, u.nombre_usuario, u.nombre_completo, u.foto_url, u.biografia,
         u.mascotas, u.fuma, u.nivel_ruido, u.horario_predominante, u.creado_en,
         -- Derivado, no copiado. Un booleano y no la fecha: cuándo confirmó su
         -- correo no le importa a nadie más que a él, y §29 pide minimizar.
         (au.email_confirmed_at is not null) as correo_verificado
    from usuarios u
    join auth.users au on au.id = u.id
   where u.activo = true;

revoke all on perfiles_publicos from public;
revoke all on perfiles_publicos from anon;
grant select on perfiles_publicos to authenticated;

comment on view perfiles_publicos is
  'AUD-14: security_invoker=false a proposito — evade el RLS de usuarios para exponer '
  'SOLO las columnas de esta lista blanca. Al agregar una columna sensible a usuarios, '
  'NO se toca esta vista. `correo_verificado` se DERIVA de auth.users en la consulta: '
  'no se copia, asi que no puede desincronizarse. Verificado por supabase/tests/rls.test.sql.';
