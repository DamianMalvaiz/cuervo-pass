-- Documento maestro v5 · §33.1 — las pruebas de acceso son código · AUD-13
--
-- v3 y v4 pedían guardar capturas de pantalla de la tabla de pruebas de acceso.
-- Una captura no se vuelve a ejecutar: no rompe el build cuando alguien relaja
-- una policy, no detecta que una columna nueva se coló en la vista pública, y se
-- ve idéntica el día que ya es mentira.
--
-- Se ejecuta con `supabase test db` y corre en CI en cada push (.github/workflows/ci.yml).
--
-- La aserción 4 es la que habría atrapado AUD-01 en la semana 5, y por eso vale
-- más que las otras once juntas.

begin;
create extension if not exists pgtap;
select plan(788);

-- ════════════════ utilidades ════════════════
create or replace function actuar_como(p_uid uuid) returns void
language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true),
         set_config('role', 'authenticated', true);
$$;

-- Volver a privilegios de servicio para preparar datos entre aserciones. Sin
-- esto, un `update` de preparación corre bajo RLS y afecta CERO filas en
-- silencio, y la aserción siguiente pasa por la razón equivocada.
create or replace function actuar_como_servicio() returns void
language sql as $$
  select set_config('request.jwt.claims', '', true),
         set_config('role', 'postgres', true);
$$;

-- Las cuentas de esta prueba usan correos `@test.mx` (no universitarios). Desde la 0082 el alta marca `cuenta_restringida` según el
-- correo; para que las 700 aserciones anteriores sigan probando lo que probaban, este trigger SOLO de la prueba (se deshace con el
-- rollback) las deja sin restricción. Las aserciones nuevas de la 0082 lo desactivan para crear cuentas por el camino real.
create or replace function t_sin_restriccion() returns trigger language plpgsql set search_path = public as $$
begin
  new.cuenta_restringida := false;
  return new;
end;
$$;
revoke execute on function t_sin_restriccion() from public, anon, authenticated;
create trigger zz_t_sin_restriccion before insert on usuarios for each row execute function t_sin_restriccion();

-- ════════════════ datos ════════════════
-- Las filas de `usuarios` las crea el trigger handle_new_user (migración 0009).
-- Que esta prueba no las inserte a mano es, de paso, la verificación de §12.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        created_at, updated_at, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a1',
   'authenticated', 'authenticated', 'a@test.mx', '', now(), now(),
   '{"nombre_usuario":"usuario_a","nombre_completo":"Ana Prueba"}'),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000b2',
   'authenticated', 'authenticated', 'b@test.mx', '', now(), now(),
   '{"nombre_usuario":"usuario_b","nombre_completo":"Beto Prueba"}');

update usuarios set presupuesto_min = 2000, presupuesto_max = 3500,
       distancia_max_km = 10, nivel_ruido = 'bajo', mascotas = false,
       latitud_universidad = 19.28, longitud_universidad = -99.55,
       cuestionario_completo = true
 where id = '00000000-0000-0000-0000-0000000000a1';

update usuarios set nivel_ruido = 'bajo'
 where id = '00000000-0000-0000-0000-0000000000b2';

insert into publicaciones (id, usuario_id, titulo, tipo, direccion, precio_renta,
                           whatsapp, latitud, longitud, permite_mascotas)
values ('00000000-0000-0000-0000-00000000dea1',
        '00000000-0000-0000-0000-0000000000b2', 'Depa B', 'depa',
        'Calle Falsa 123', 2800, '5512345678', 19.29, -99.56, false);

-- ════════════════ 1 · la tabla usuarios solo devuelve la fila propia ════════════════
select actuar_como('00000000-0000-0000-0000-0000000000a1');
select is( (select count(*)::int from usuarios), 1,
           'usuarios: RLS limita a la fila propia' );

-- ════════════════ 2 y 3 · las vistas públicas no exponen columnas sensibles ════════════════
-- Esta es la prueba que hace segura la decisión de AUD-14: la lista blanca de
-- columnas se escribe a mano, y aquí se verifica que siga siendo blanca.
select actuar_como_servicio();
select hasnt_column( 'public', 'perfiles_publicos', 'presupuesto_max',
           'perfiles_publicos no expone el presupuesto' );
select hasnt_column( 'public', 'publicaciones_publicas', 'whatsapp',
           'publicaciones_publicas no expone el teléfono' );

-- ════════════════ 4 · AUD-01: el motor devuelve filas AJENAS ════════════════
select actuar_como('00000000-0000-0000-0000-0000000000a1');
select cmp_ok( (select count(*)::int from sugerencias_publicaciones(30)), '>', 0,
           'sugerencias_publicaciones devuelve publicaciones de OTROS usuarios' );

-- ════════════════ 5 · el filtro duro descarta lo que no cabe en presupuesto ════════════════
select actuar_como_servicio();
update publicaciones set precio_renta = 9000
 where id = '00000000-0000-0000-0000-00000000dea1';
select actuar_como('00000000-0000-0000-0000-0000000000a1');
select is( (select count(*)::int from sugerencias_publicaciones(30)), 0,
           'el filtro duro descarta lo que está fuera de presupuesto' );

select actuar_como_servicio();
update publicaciones set precio_renta = 2800
 where id = '00000000-0000-0000-0000-00000000dea1';

-- ════════════════ 6 · abrir_conversacion es idempotente · AUD-07 ════════════════
select actuar_como('00000000-0000-0000-0000-0000000000a1');
select is( (select abrir_conversacion('00000000-0000-0000-0000-0000000000b2')),
           (select abrir_conversacion('00000000-0000-0000-0000-0000000000b2')),
           'abrir_conversacion devuelve el mismo id en dos llamadas' );

insert into mensajes (conversacion_id, remitente_id, contenido)
values ((select abrir_conversacion('00000000-0000-0000-0000-0000000000b2')),
        '00000000-0000-0000-0000-0000000000a1', 'hola');

-- ════════════════ 7 y 8 · un mensaje enviado es inmutable, pero se marca leído ════════════════
select actuar_como('00000000-0000-0000-0000-0000000000b2');
select throws_ok(
  $$ update mensajes set contenido = 'otra cosa' $$, null,
  'el contenido de un mensaje enviado no se puede modificar' );
select lives_ok(
  $$ update mensajes set leido = true $$,
  'el destinatario sí puede marcar como leído' );

-- ════════════════ 9 y 10 · la cuota corta · AUD-04 ════════════════
select actuar_como('00000000-0000-0000-0000-0000000000a1');
select lives_ok( $$ select consumir_cuota('revelar_contacto', 1) $$,
           'la primera llamada dentro de la cuota pasa' );
select throws_ok( $$ select consumir_cuota('revelar_contacto', 1) $$, null,
           'la llamada que supera la cuota diaria falla' );

-- ════════════════ 11 · cuotas_uso es tabla de servicio: nadie la lee ════════════════
-- Desde la 0074 no basta con que RLS devuelva cero filas: el cliente ni siquiera tiene el privilegio (42501).
select throws_ok( $$select count(*) from cuotas_uso$$, '42501', null,
           'cuotas_uso no es legible desde el cliente, ni por su propio dueño' );

-- ════════════════ 12 · AUD-26: el límite de publicaciones activas ════════════════
select actuar_como_servicio();
insert into publicaciones (usuario_id, titulo, tipo, direccion, precio_renta, whatsapp)
select '00000000-0000-0000-0000-0000000000b2', 'Depa ' || n, 'depa', 'Calle ' || n,
       2500, '5512345678'
  from generate_series(2, 15) n;

select throws_ok(
  $$ insert into publicaciones (usuario_id, titulo, tipo, direccion, precio_renta, whatsapp)
     values ('00000000-0000-0000-0000-0000000000b2', 'Depa 16', 'depa', 'Calle 16', 2500, '5512345678') $$,
  null,
  'la publicación número 16 de una cuenta se rechaza' );

-- ════════════════ 13, 14 y 15 · las policies de Storage existen ════════════════
-- Estas tres comprueban EXISTENCIA, no comportamiento, y conviene ser honesto
-- sobre la diferencia: ejercitar storage.objects de verdad exige montar el
-- bucket y sus objetos, que es más de lo que esta suite hace.
--
-- Aun así valen. La 14 es la que habría atrapado el bug que corrige la 0019:
-- src/lib/storage.ts sube con `upsert: true` desde el principio, y durante todo
-- ese tiempo NO existió una policy de UPDATE para las fotos de publicaciones.
-- Reemplazar una foto ya subida fallaba con error de RLS, y nadie lo notó porque
-- subir una nueva —que es INSERT— sí funcionaba.
--
-- La 15 cubre el otro lado: una policy que permitiera ESCRIBIR sin sesión
-- volvería a abrir el bucket que la 0016 cerró.
select actuar_como_servicio();

select ok(
  exists (select 1 from pg_policies
           where schemaname = 'storage' and tablename = 'objects'
             and cmd = 'UPDATE' and policyname = 'el dueno reemplaza su propia foto de perfil'),
  'existe la policy de UPDATE para la foto de perfil propia' );

select ok(
  exists (select 1 from pg_policies
           where schemaname = 'storage' and tablename = 'objects'
             and cmd = 'UPDATE' and policyname = 'el dueno reemplaza fotos de sus publicaciones'),
  'existe la policy de UPDATE para las fotos de publicaciones propias (0019)' );

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
      and ('anon' = any(roles) or 'public' = any(roles))),
  0,
  'ninguna policy de Storage permite escribir sin sesión' );

-- ════════════════ 16 y 17 · revelar_contacto DEVUELVE el teléfono ════════════════
-- Las aserciones 9 y 10 probaban `consumir_cuota` por separado y pasaban, pero
-- nadie llamaba a `revelar_contacto` de punta a punta. Así se coló el fallo que
-- corrige la 0020: su `on conflict` apuntaba a un índice PARCIAL sin repetir el
-- predicado, y Postgres abortaba la función entera con 42P10. En la app eso se
-- veía como "No pudimos obtener el contacto" — y ninguna prueba lo detectó.
--
-- La lección que estas dos fijan: probar las piezas por separado no prueba que
-- la función que las usa corra.
-- Ana (a1) pide el contacto de la publicación de Beto (b2). Se usa el id
-- explícito y no `limit 1`: la aserción 12 insertó catorce publicaciones más
-- para b2, y una prueba que dependa de cuál devuelva el planificador es una
-- prueba que falla el día que cambie el orden.
select actuar_como('00000000-0000-0000-0000-0000000000a1');

select is(
  (select revelar_contacto('00000000-0000-0000-0000-00000000dea1'::uuid)),
  '5512345678',
  'revelar_contacto devuelve el telefono de una publicacion activa' );

-- Repetirlo no debe fallar NI duplicar: el `do nothing` es lo que impide que la
-- metrica "personas que pidieron tu contacto" se infle con cada toque (AUD-11).
select lives_ok(
  $$ select revelar_contacto('00000000-0000-0000-0000-00000000dea1'::uuid) $$,
  'pedir el mismo contacto dos veces no falla ni duplica el registro' );

-- ════════════════ 18 a 21 · borrar una publicacion con fotos NO puede fallar ════════════════
-- La 0016 puso un trigger que hacia `delete from storage.objects`, y Supabase
-- anadio despues una barrera que lo prohibe. El trigger reventaba, la
-- transaccion entera se caia, y con ella el borrado en cascada desde
-- auth.users: "Eliminar mi cuenta" devolvia error para cualquiera que hubiera
-- subido una foto. El aviso de privacidad promete esa pantalla en la tabla de
-- derechos ARCO, asi que era un incumplimiento, no un detalle.
--
-- Ninguna prueba lo cubria porque ninguna borraba una publicacion CON fotos.
-- Estas cuatro lo fijan.
--
-- La publicacion se cuelga de a1 y no de b2: la asercion 12 dejo a b2 con las
-- quince que permite AUD-26, y una decimosexta la rechaza el trigger del limite,
-- abortando el script entero antes de llegar aqui.
select actuar_como_servicio();

insert into publicaciones (id, usuario_id, titulo, tipo, direccion, precio_renta, whatsapp, fotos)
values ('00000000-0000-0000-0000-00000000f070',
        '00000000-0000-0000-0000-0000000000a1', 'Con fotos', 'depa',
        'Calle Foto 1', 2600, '5512345678',
        array['publicaciones/a1/f070/0.jpg',
              'publicaciones/a1/f070/1.jpg',
              'https://images.unsplash.com/sembrada.jpg']);

select lives_ok(
  $$ delete from publicaciones where id = '00000000-0000-0000-0000-00000000f070' $$,
  'borrar una publicacion CON fotos no falla' );

select is(
  (select count(*)::int from fotos_huerfanas
    where publicacion_id = '00000000-0000-0000-0000-00000000f070'),
  2,
  'las rutas del bucket quedan encoladas para el barredor' );

-- Una URL de Unsplash no es un objeto del bucket: encolarla haria que el
-- barredor pidiera borrar algo que nunca estuvo ahi.
select is(
  (select count(*)::int from fotos_huerfanas where ruta like 'http%'),
  0,
  'las URLs externas de las publicaciones sembradas no se encolan' );

-- La cola guarda rutas de almacenamiento de OTRAS personas: es tabla de
-- servicio, como cuotas_uso, y no debe leerse desde el cliente.
select actuar_como('00000000-0000-0000-0000-0000000000a1');
select throws_ok( $$select count(*) from fotos_huerfanas$$, '42501', null,
           'fotos_huerfanas no es legible desde el cliente' );

-- ════════════════ 22 a 25 · Storage: la lectura del bucket ════════════════
--
-- La migración 0016 se titula "storage privado" y su encabezado dice que v3 era
-- vulnerable porque «cualquiera en internet que adivinara el patrón
-- perfiles/<uuid>.jpg leía las fotos sin sesión». Lo que dejó escrito fue:
--
--   create policy "leer fotos con sesion" on storage.objects
--     for select to authenticated using (bucket_id = 'fotos');
--
-- Sin restricción de ruta. Eso cambia «cualquiera en internet» por «cualquiera
-- con una cuenta», y como el registro es abierto y sin verificación de correo,
-- esas dos poblaciones se separan por treinta segundos. Las URLs firmadas no
-- protegen nada: quien tiene sesión pide la firma él mismo.
--
-- Estas cuatro aserciones fijan lo que debe valer: se lee la foto de quien está
-- visible, y solo esa.
select actuar_como_servicio();

-- Un tercer usuario, desactivado: no aparece en perfiles_publicos.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        created_at, updated_at, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000c3',
        'authenticated', 'authenticated', 'c@test.mx', '', now(), now(),
        '{"nombre_usuario":"usuario_c","nombre_completo":"Caro Prueba"}');
update usuarios set activo = false where id = '00000000-0000-0000-0000-0000000000c3';

-- Una publicación de B, oculta por reportes: tampoco aparece en la vista.
update publicaciones set oculta_por_reportes = true
 where id = '00000000-0000-0000-0000-00000000dea1';

-- Y una propia de A, para comprobar que el dueño nunca pierde acceso.
insert into publicaciones (id, usuario_id, titulo, tipo, direccion, precio_renta, whatsapp)
values ('00000000-0000-0000-0000-00000000aa01',
        '00000000-0000-0000-0000-0000000000a1', 'Mia', 'depa', 'Calle Mia 1', 2600, '5512345678');

insert into storage.objects (bucket_id, name) values
  ('fotos', 'perfiles/00000000-0000-0000-0000-0000000000b2.jpg'),
  ('fotos', 'perfiles/00000000-0000-0000-0000-0000000000c3.jpg'),
  ('fotos', 'publicaciones/00000000-0000-0000-0000-0000000000b2/00000000-0000-0000-0000-00000000dea1/0.jpg'),
  ('fotos', 'publicaciones/00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-00000000aa01/0.jpg');

select actuar_como('00000000-0000-0000-0000-0000000000a1');

select is(
  (select count(*)::int from storage.objects
    where name = 'perfiles/00000000-0000-0000-0000-0000000000c3.jpg'),
  0,
  'storage: no se lee la foto de perfil de un usuario desactivado' );

select is(
  (select count(*)::int from storage.objects
    where name = 'publicaciones/00000000-0000-0000-0000-0000000000b2/00000000-0000-0000-0000-00000000dea1/0.jpg'),
  0,
  'storage: no se lee la foto de una publicacion oculta por reportes' );

-- Las dos de abajo son el contrapeso: una policy que cierra de mas rompe la app
-- en silencio, que es el mismo tipo de fallo que AUD-01.
select is(
  (select count(*)::int from storage.objects
    where name = 'perfiles/00000000-0000-0000-0000-0000000000b2.jpg'),
  1,
  'storage: la foto de perfil de un usuario activo SI se lee' );

select is(
  (select count(*)::int from storage.objects
    where name = 'publicaciones/00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-00000000aa01/0.jpg'),
  1,
  'storage: el dueno lee la foto de su propia publicacion aunque no sea visible' );

-- ════════════════ 26 a 29 · Reportar a una PERSONA hace algo ════════════════
--
-- El defecto: `reportarUsuario()` existe en src/services/usuarios.service.ts,
-- la pantalla de perfil ajeno lo llama, inserta la fila y muestra un
-- agradecimiento. Y `al_reportar` empezaba con:
--
--   if new.publicacion_id is null then return new; end if;
--
-- Reportar a una persona no hacía absolutamente nada. Nunca. Para nadie.
--
-- Es el mismo hallazgo AUD-16 que la propia 0013 documenta —«un valor muerto,
-- que es la clase de detalle que delata que el esquema y la lógica se
-- escribieron por separado»— reproducido en la ruta de seguridad personal, en
-- un producto donde alguien de dieciocho años queda con un desconocido para ver
-- un departamento. Un botón de seguridad que miente es peor que no tenerlo:
-- produce la sensación de protección sin la protección.
select actuar_como_servicio();

insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        created_at, updated_at, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000d4',
   'authenticated','authenticated','d@test.mx','',now(),now(),
   '{"nombre_usuario":"usuario_d","nombre_completo":"Dani Prueba"}'),
  ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000e5',
   'authenticated','authenticated','e@test.mx','',now(),now(),
   '{"nombre_usuario":"usuario_e","nombre_completo":"Eli Prueba"}'),
  ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000f6',
   'authenticated','authenticated','f@test.mx','',now(),now(),
   '{"nombre_usuario":"usuario_f","nombre_completo":"Fer Prueba"}');

-- B tiene un roomie activo: al suspenderse su cuenta tiene que dejar de
-- ofrecerse, o seguiría apareciendo en sugerencias_roomies.
insert into roomies (usuario_id, descripcion_busqueda, estado)
values ('00000000-0000-0000-0000-0000000000b2', 'Busco roomie tranquilo', 'activo')
on conflict (usuario_id) do update set estado = 'activo';

-- Tres cuentas distintas reportan a B, cada una con SU sesión: el índice
-- reportes_unico_usuario impide que una sola lo haga tres veces.
select actuar_como('00000000-0000-0000-0000-0000000000d4');
insert into reportes (reportado_por, usuario_reportado_id, motivo)
values ('00000000-0000-0000-0000-0000000000d4','00000000-0000-0000-0000-0000000000b2','acoso');
select actuar_como('00000000-0000-0000-0000-0000000000e5');
insert into reportes (reportado_por, usuario_reportado_id, motivo)
values ('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-0000000000b2','acoso');
select actuar_como('00000000-0000-0000-0000-0000000000f6');
insert into reportes (reportado_por, usuario_reportado_id, motivo)
values ('00000000-0000-0000-0000-0000000000f6','00000000-0000-0000-0000-0000000000b2','acoso');

select actuar_como_servicio();

select is(
  (select suspendido from usuarios where id = '00000000-0000-0000-0000-0000000000b2'),
  true,
  'tres reportes suspenden la cuenta' );

select is(
  (select count(*)::int from notificaciones
    where usuario_id = '00000000-0000-0000-0000-0000000000b2' and tipo = 'cuenta_suspendida'),
  1,
  'al suspender se avisa a la persona, una sola vez' );

select is(
  (select estado from roomies where usuario_id = '00000000-0000-0000-0000-0000000000b2'),
  'pausado',
  'el roomie de una cuenta suspendida deja de ofrecerse' );

-- La consecuencia que de verdad protege: desaparece de la vista pública, y con
-- ella de perfiles ajenos, de sugerencias_roomies y —por la 0022— de sus fotos.
select actuar_como('00000000-0000-0000-0000-0000000000a1');
select is(
  (select count(*)::int from perfiles_publicos where id = '00000000-0000-0000-0000-0000000000b2'),
  0,
  'una cuenta suspendida desaparece de perfiles_publicos' );

-- ════════════════ 30 y 31 · la suspensión no se la quita el suspendido ═══════
-- `usuarios_update_propio` (0014) deja a cualquiera actualizar su propia fila.
-- Una policy de UPDATE limita FILAS, no COLUMNAS —mismo motivo por el que la
-- 0012 usa un trigger para la inmutabilidad de los mensajes— así que sin
-- `trg_suspension_inmutable` un suspendido escribe `suspendido = false` y
-- vuelve. El control de moderación no puede vivir en manos del moderado.
select actuar_como('00000000-0000-0000-0000-0000000000b2');

select throws_ok(
  $$ update usuarios set suspendido = false where id = '00000000-0000-0000-0000-0000000000b2' $$,
  null,
  'un suspendido no puede quitarse la suspension' );

select throws_ok(
  $$ update usuarios set activo = true where id = '00000000-0000-0000-0000-0000000000b2' $$,
  null,
  'un suspendido no puede reactivarse cambiando solo activo' );

-- ════════════════ 32 a 34 · roomies deja de estar abierta ════════════════
--
-- El README afirma: «Las tablas están CERRADAS: cada usuario solo ve sus
-- propias filas. Lo que otros pueden ver sale de dos vistas con lista blanca».
-- No era cierto para `roomies`. La 0014 dejó:
--
--   create policy roomies_select_activos on roomies
--     for select to authenticated using (estado = 'activo' or auth.uid() = usuario_id);
--
-- `select * from roomies` bajaba TODAS las columnas de toda fila activa,
-- incluido `vector_busqueda` — 384 flotantes derivados del texto libre de esa
-- persona, del que se puede reconstruir buena parte del original. Se le hizo
-- cirugía de vistas a `usuarios` y a `publicaciones`, y se saltó la tercera.
--
-- La 34 es la que importa: cerrar la tabla sin tocar la función de sugerencias
-- la dejaría devolviendo CERO filas, sin error y sin log. AUD-01 otra vez.
select actuar_como_servicio();

-- Un roomie activo de alguien que no es A. (El de B quedó en 'pausado' al
-- suspenderse su cuenta en la prueba anterior.)
insert into roomies (usuario_id, descripcion_busqueda, estado, presupuesto_aportacion)
values ('00000000-0000-0000-0000-0000000000d4', 'Busco depa cerca del campus', 'activo', 2500)
on conflict (usuario_id) do update set estado = 'activo';

-- `has_view` primero, y no es ceremonia: `hasnt_column` sobre una relacion que
-- NO existe devuelve verdadero. Sin esta linea la asercion de abajo pasaba en
-- vacio y habria certificado una vista inexistente.
select has_view( 'public', 'roomies_publicos',
           'roomies_publicos existe' );
select hasnt_column( 'public', 'roomies_publicos', 'vector_busqueda',
           'roomies_publicos no expone el vector de busqueda' );

select actuar_como('00000000-0000-0000-0000-0000000000a1');

select is(
  (select count(*)::int from roomies),
  0,
  'la TABLA roomies solo devuelve las filas propias (A no tiene)' );

-- El contrapeso. Sin esto, cerrar la tabla pasa la prueba anterior y rompe la
-- pantalla de roomies en silencio, que es exactamente el fallo que se corrige.
select cmp_ok(
  (select count(*)::int from sugerencias_roomies(30)), '>', 0,
  'sugerencias_roomies sigue devolviendo roomies AJENOS' );

-- El vector entra en el calculo y NO sale. La lista blanca de una funcion
-- `security definer` es su firma de retorno, asi que se afirma sobre ella.
select throws_ok(
  $$ select vector_busqueda from sugerencias_roomies(1) $$,
  null,
  'sugerencias_roomies no devuelve vector_busqueda' );

-- ════════════════ 37 · el barrido de fotos está programado ════════════════
-- La 0021 dejó una cola que vaciaba un script manual, o sea que el derecho de
-- cancelación dependía de que alguien se acordara. La 0025 lo programa. Esta
-- asercion existe para que "esta programado" deje de ser una creencia: si
-- alguien retira la tarea, el build se rompe.
select actuar_como_servicio();
select is(
  (select count(*)::int from cron.job where jobname = 'barrer-fotos' and active),
  1,
  'la tarea barrer-fotos esta programada y activa' );

-- ════════════════ 38 a 40 · la insignia de correo verificado ════════════════
-- Se DERIVA de auth.users en la consulta, no se copia a una columna: una
-- insignia de confianza desincronizada es peor que no tenerla. Y se expone
-- como booleano, no como fecha — cuando alguien confirmo su correo no le
-- importa a nadie mas que a el (§29, minimizacion).
select actuar_como_servicio();
select has_column( 'public', 'perfiles_publicos', 'correo_verificado',
           'perfiles_publicos expone correo_verificado' );
select hasnt_column( 'public', 'perfiles_publicos', 'email',
           'perfiles_publicos NO expone el correo' );
select hasnt_column( 'public', 'perfiles_publicos', 'email_confirmed_at',
           'perfiles_publicos NO expone la fecha de confirmacion' );

-- ════════════════ 41 a 44 · END-08: el Nivel 2 escondia publicaciones ════════════════
-- `sugerencias_con_ranking` descartaba toda publicacion sin embedding:
--
--   where yo.perfil_vector is not null and c.vector_embedding is not null
--
-- Y el servicio devolvia Nivel 2 con que hubiera UNA sola fila. De veinte
-- publicaciones viables con tres vectorizadas, el usuario veia TRES y creia que
-- ese era el catalogo. Las otras diecisiete pasaban el filtro duro perfectamente.
--
-- Es AUD-01 una capa mas arriba: lista incompleta, sin error, sin log, sin
-- pista. La degradacion era todo-o-nada en la granularidad equivocada: lo que
-- degrada es el ORDEN de cada fila, no la existencia de la lista.
select actuar_como_servicio();

-- Aislamiento: las publicaciones sembradas por aserciones anteriores tambien
-- pasarian el filtro de a1 y el conteo dejaria de ser comprobable.
update publicaciones set activa = false;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        created_at, updated_at, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a7',
        'authenticated', 'authenticated', 'a7@test.mx', '', now(), now(),
        '{"nombre_usuario":"usuario_a7","nombre_completo":"Aurora Prueba"}');

-- Cinco publicaciones que pasan los filtros duros de a1 (2000-3500, 10 km,
-- sin exigencia de mascotas). Solo DOS llevan vector.
insert into publicaciones (id, usuario_id, titulo, tipo, direccion, precio_renta,
                           whatsapp, latitud, longitud, vector_embedding)
select ('00000000-0000-0000-0000-00000000e8' || lpad(n::text, 2, '0'))::uuid,
       '00000000-0000-0000-0000-0000000000a7',
       'Viable ' || n, 'depa', 'Calle E8 ' || n, 2800, '5512345678', 19.29, -99.56,
       case when n <= 2
            then ('[' || array_to_string(array_fill(0.05::float8, array[384]), ',') || ']')::vector
            else null end
  from generate_series(1, 5) n;

update usuarios
   set perfil_vector = ('[' || array_to_string(array_fill(0.05::float8, array[384]), ',') || ']')::vector
 where id = '00000000-0000-0000-0000-0000000000a1';

select actuar_como('00000000-0000-0000-0000-0000000000a1');

-- LA asercion. Antes de la correccion devuelve 2.
select is(
  (select count(*)::int from sugerencias_con_ranking(30)),
  5,
  'el Nivel 2 devuelve TODAS las viables, no solo las vectorizadas' );

-- Las que no tienen vector no pueden inventarse una similitud.
select is(
  (select count(*)::int from sugerencias_con_ranking(30) where similitud is null),
  3,
  'las publicaciones sin vector traen similitud nula, no cero' );

-- Y su orden cae al score de filtros, sin castigo adicional.
select is(
  (select count(*)::int from sugerencias_con_ranking(30)
    where similitud is null and score_final = score),
  3,
  'sin similitud, el orden es el score de filtros' );

-- El nivel deja de ser una bandera global y pasa a ser columna POR FILA. Se
-- comprueba sobre la firma declarada y no seleccionando la columna: si no
-- existiera, un select la haria abortar el script entero en vez de fallar.
select ok(
  pg_get_function_result('sugerencias_con_ranking(int,text,text)'::regprocedure) like '%nivel%',
  'sugerencias_con_ranking declara `nivel` por fila' );

-- ════════════════ 45 y 46 · END-09: el score de mascotas al reves ════════════════
-- El termino suave era:
--
--   case when p.permite_mascotas = yo.mascotas then 0.5 else 0 end
--
-- Sin mascota + departamento que SI las acepta -> true <> false -> 0 puntos.
-- Penalizaba los alojamientos pet friendly a quien no tiene mascota, con un
-- peso de 0.25 * 0.5 = 0.125 sobre un score que va de 0 a 1.
--
-- Y el comentario del propio archivo afirmaba lo contrario treinta lineas mas
-- abajo: «si no tienes, uno que las permite no te estorba. Asimetria
-- deliberada.» Ese comentario describe el FILTRO DURO, que si era correcto. El
-- score suave hacia lo opuesto. Dos piezas correctas por separado que se
-- contradicen al correr juntas.
select actuar_como_servicio();

-- Se apagan las cinco de la asercion 41 para que el conteo no dependa de ellas.
update publicaciones set activa = false;

-- Dos publicaciones GEMELAS: mismo dueno, mismo precio, mismas coordenadas y
-- el mismo creado_en —la frescura pesa 0.15 y una diferencia de milisegundos
-- ensuciaria la comparacion—. Solo se diferencian en si aceptan mascotas.
insert into publicaciones (id, usuario_id, titulo, tipo, direccion, precio_renta,
                           whatsapp, latitud, longitud, permite_mascotas, creado_en)
values
  ('00000000-0000-0000-0000-00000000e901', '00000000-0000-0000-0000-0000000000a7',
   'Gemela sin mascotas', 'depa', 'Calle E9 1', 2800, '5512345678', 19.29, -99.56,
   false, '2026-09-01 12:00:00+00'),
  ('00000000-0000-0000-0000-00000000e902', '00000000-0000-0000-0000-0000000000a7',
   'Gemela con mascotas', 'depa', 'Calle E9 2', 2800, '5512345678', 19.29, -99.56,
   true,  '2026-09-01 12:00:00+00');

-- a1 NO tiene mascota.
update usuarios set mascotas = false where id = '00000000-0000-0000-0000-0000000000a1';
select actuar_como('00000000-0000-0000-0000-0000000000a1');

-- LA asercion. Antes de la correccion difieren en 0.125.
select is(
  (select count(distinct score)::int from sugerencias_publicaciones(30)
    where id in ('00000000-0000-0000-0000-00000000e901',
                 '00000000-0000-0000-0000-00000000e902')),
  1,
  'sin mascota, aceptarlas o no NO cambia el score' );

-- Y el filtro duro sigue siendo eliminatorio en el otro sentido: con mascota,
-- el que no las permite desaparece. Corregir el score no debe ablandarlo.
select actuar_como_servicio();
update usuarios set mascotas = true where id = '00000000-0000-0000-0000-0000000000a1';
select actuar_como('00000000-0000-0000-0000-0000000000a1');
select is(
  (select count(*)::int from sugerencias_publicaciones(30)
    where id in ('00000000-0000-0000-0000-00000000e901',
                 '00000000-0000-0000-0000-00000000e902')),
  1,
  'con mascota, el que no las permite queda fuera del filtro duro' );

-- ════════════════ 47 a 51 · END-13: la cuota se cobraba sin entregar ════════════════
-- `revelar_contacto` llama a `consumir_cuota` ANTES del `on conflict do
-- nothing`. Volver a abrir una publicacion que ya revelaste cobra otra vez,
-- aunque no haya nada nuevo que entregar: el telefono ya lo tenias. Reabrir
-- cinco publicaciones cinco veces agota las 25 diarias USANDO LA APP CON
-- NORMALIDAD, y en una demo se toca mucho.
--
-- La cuota existe para acotar el coste de revelar contactos NUEVOS (AUD-04),
-- no para cobrar por mirar dos veces lo mismo.
select actuar_como_servicio();

insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        created_at, updated_at, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a8',
        'authenticated', 'authenticated', 'a8@test.mx', '', now(), now(),
        '{"nombre_usuario":"usuario_a8","nombre_completo":"Ocho Prueba"}');

select actuar_como('00000000-0000-0000-0000-0000000000a8');

-- Tres veces el MISMO contacto.
select lives_ok(
  $$ select revelar_contacto('00000000-0000-0000-0000-00000000e901'::uuid) $$,
  'revelar un contacto funciona' );
select revelar_contacto('00000000-0000-0000-0000-00000000e901'::uuid);
select revelar_contacto('00000000-0000-0000-0000-00000000e901'::uuid);

select actuar_como_servicio();

-- LA asercion. Antes de la correccion vale 3.
select is(
  (select consumo from cuotas_uso
    where usuario_id = '00000000-0000-0000-0000-0000000000a8'
      and recurso = 'revelar_contacto' and dia = current_date),
  1,
  'tres revelaciones del MISMO contacto consumen una sola cuota' );

-- Y un contacto distinto si cobra: el arreglo no puede volver la cuota inutil.
select actuar_como('00000000-0000-0000-0000-0000000000a8');
select revelar_contacto('00000000-0000-0000-0000-00000000e902'::uuid);
select actuar_como_servicio();
select is(
  (select consumo from cuotas_uso
    where usuario_id = '00000000-0000-0000-0000-0000000000a8'
      and recurso = 'revelar_contacto' and dia = current_date),
  2,
  'un contacto NUEVO si consume cuota' );

-- END-14 · devolver_cuota, para que ai-proxy no cobre lo que no entrego. Con
-- el tunel muerto, treinta reintentos agotaban el dia sin una sola llamada al
-- modelo.
-- Se llama como SERVICIO y con el usuario por parametro. Antes se llamaba como
-- el usuario y sin parametro, que es justo lo que la hacia explotable: veinte
-- llamadas y la cuota diaria volvia a cero (migracion 0036).
select actuar_como_servicio();
select devolver_cuota('00000000-0000-0000-0000-0000000000a8', 'revelar_contacto');
select is(
  (select consumo from cuotas_uso
    where usuario_id = '00000000-0000-0000-0000-0000000000a8'
      and recurso = 'revelar_contacto' and dia = current_date),
  1,
  'devolver_cuota descuenta lo cobrado de mas' );

-- Sin piso, un `catch` que se dispare de mas dejaria el consumo en negativo y
-- regalaria cuota del dia siguiente.
select actuar_como_servicio();
select devolver_cuota('00000000-0000-0000-0000-0000000000a8', 'revelar_contacto');
select devolver_cuota('00000000-0000-0000-0000-0000000000a8', 'revelar_contacto');
select devolver_cuota('00000000-0000-0000-0000-0000000000a8', 'revelar_contacto');
select is(
  (select consumo from cuotas_uso
    where usuario_id = '00000000-0000-0000-0000-0000000000a8'
      and recurso = 'revelar_contacto' and dia = current_date),
  0,
  'devolver_cuota nunca baja de cero' );

-- ════════════════ 52 a 55 · END-16: 1200 mensajes para resolver 30 hilos ════════════════
-- `listarConversaciones` traia `limite * PAGINA_MENSAJES` = 1200 mensajes y los
-- plegaba en JavaScript. El encabezado del propio archivo acusa a v3 de
-- «traerse TODOS los mensajes y agruparlos en JavaScript».
--
-- Y tenia dos defectos VISIBLES, no solo de coste: el orden es `creado_en desc`
-- GLOBAL, asi que un chat activo se come la ventana y un hilo tranquilo aparece
-- SIN ultimo mensaje; y el contador de no leidos se trunca en silencio.
--
-- El bloque usa TRES cuentas propias. Reutilizar b2 fallaba con «usuario no
-- disponible»: las aserciones 26 a 31 lo suspenden al tercer reporte, y
-- abrir_conversacion lo respeta. Ese fallo es, de paso, la 0023 funcionando.
select actuar_como_servicio();

insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        created_at, updated_at, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000c1',
   'authenticated', 'authenticated', 'c1@test.mx', '', now(), now(),
   '{"nombre_usuario":"usuario_c1","nombre_completo":"Cuenta Uno"}'),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000c2',
   'authenticated', 'authenticated', 'c2@test.mx', '', now(), now(),
   '{"nombre_usuario":"usuario_c2","nombre_completo":"Cuenta Dos"}'),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000c4',
   'authenticated', 'authenticated', 'c4@test.mx', '', now(), now(),
   '{"nombre_usuario":"usuario_c4","nombre_completo":"Cuenta Cuatro"}');

select actuar_como('00000000-0000-0000-0000-0000000000c1');
select abrir_conversacion('00000000-0000-0000-0000-0000000000c2');
select abrir_conversacion('00000000-0000-0000-0000-0000000000c4');
select actuar_como_servicio();

-- Hilo RUIDOSO con c2: cincuenta mensajes recientes, todos sin leer.
insert into mensajes (conversacion_id, remitente_id, contenido, creado_en, leido)
select (select id from conversaciones
         where (usuario_a = '00000000-0000-0000-0000-0000000000c1' and usuario_b = '00000000-0000-0000-0000-0000000000c2')
            or (usuario_b = '00000000-0000-0000-0000-0000000000c1' and usuario_a = '00000000-0000-0000-0000-0000000000c2')),
       '00000000-0000-0000-0000-0000000000c2', 'ruido ' || n,
       now() - (n || ' seconds')::interval, false
  from generate_series(1, 50) n;

-- Hilo TRANQUILO con c4: un solo mensaje, y MAS VIEJO que todos los anteriores.
insert into mensajes (conversacion_id, remitente_id, contenido, creado_en, leido)
values ((select id from conversaciones
          where (usuario_a = '00000000-0000-0000-0000-0000000000c1' and usuario_b = '00000000-0000-0000-0000-0000000000c4')
             or (usuario_b = '00000000-0000-0000-0000-0000000000c1' and usuario_a = '00000000-0000-0000-0000-0000000000c4')),
        '00000000-0000-0000-0000-0000000000c4', 'el tranquilo',
        now() - interval '10 days', false);

select actuar_como('00000000-0000-0000-0000-0000000000c1');

-- LA asercion. Con una ventana global de mensajes, este hilo aparece SIN ultimo
-- mensaje porque los cincuenta del otro se comen el cupo.
select is(
  (select ultimo_contenido from resumen_conversaciones(30)
    where otro_usuario_id = '00000000-0000-0000-0000-0000000000c4'),
  'el tranquilo',
  'un hilo tranquilo conserva su ultimo mensaje aunque otro este activo' );

select is(
  (select no_leidos from resumen_conversaciones(30)
    where otro_usuario_id = '00000000-0000-0000-0000-0000000000c2'),
  50,
  'el contador de no leidos no se trunca' );

-- Los propios no cuentan como no leidos: nadie se manda mensajes sin leer.
--
-- Primero se marca como leido el de c4, que SI es ajeno y sin leer — la version
-- anterior de esta asercion esperaba 0 sin hacerlo y fallaba con have: 1. El
-- fallo era de la prueba: ese 1 era correcto.
select actuar_como_servicio();
update mensajes set leido = true
 where remitente_id = '00000000-0000-0000-0000-0000000000c4';
insert into mensajes (conversacion_id, remitente_id, contenido, leido)
values ((select id from conversaciones
          where (usuario_a = '00000000-0000-0000-0000-0000000000c1' and usuario_b = '00000000-0000-0000-0000-0000000000c4')
             or (usuario_b = '00000000-0000-0000-0000-0000000000c1' and usuario_a = '00000000-0000-0000-0000-0000000000c4')),
        '00000000-0000-0000-0000-0000000000c1', 'mio y sin leer', false);
select actuar_como('00000000-0000-0000-0000-0000000000c1');
select is(
  (select no_leidos from resumen_conversaciones(30)
    where otro_usuario_id = '00000000-0000-0000-0000-0000000000c4'),
  0,
  'los mensajes propios no cuentan como no leidos' );

-- Y RLS sigue aplicando: c4 no ve la conversacion de c1 con c2.
select actuar_como('00000000-0000-0000-0000-0000000000c4');
select is(
  (select count(*)::int from resumen_conversaciones(30)
    where otro_usuario_id = '00000000-0000-0000-0000-0000000000c2'),
  0,
  'resumen_conversaciones solo devuelve las conversaciones propias' );

-- ════════════════ 56 a 59 · END-21: la calificacion viajaba por la URL ════════════════
-- `inicio.tsx` pasaba `score`, `base` y `sim` como PARAMETROS DE RUTA al abrir
-- una ficha. Dos consecuencias:
--
--   · Un deep link a una publicacion no trae esos parametros, asi que el
--     desglose —la tesis del producto— desaparecia segun por donde entraras.
--   · Peor: ese valor se escribia en `contactos.score_mostrado`. La metrica
--     que el producto presenta era un dato SUMINISTRADO POR EL CLIENTE, o sea
--     que cualquiera con la anon key podia escribir el numero que quisiera.
select actuar_como_servicio();
update publicaciones set activa = false;

insert into publicaciones (id, usuario_id, titulo, tipo, direccion, precio_renta,
                           whatsapp, latitud, longitud, permite_mascotas, creado_en)
values ('00000000-0000-0000-0000-00000000c501',
        '00000000-0000-0000-0000-0000000000a7', 'Para afinidad', 'depa',
        'Calle C5 1', 2800, '5512345678', 19.29, -99.56, false,
        '2026-09-01 12:00:00+00');

update usuarios set mascotas = false, presupuesto_min = 2000, presupuesto_max = 3500,
                    distancia_max_km = 10, nivel_ruido = 'bajo'
 where id = '00000000-0000-0000-0000-0000000000a1';

select actuar_como('00000000-0000-0000-0000-0000000000a1');

-- LA asercion contra la duplicacion: el numero del detalle y el de la lista
-- tienen que ser EL MISMO. Si la formula se copiara en dos sitios, algun dia se
-- cambiaria en uno solo y la misma publicacion mostraria dos calificaciones
-- distintas segun donde se mire.
select is(
  (select score_final from afinidad_de('00000000-0000-0000-0000-00000000c501'::uuid)),
  (select score_final from sugerencias_con_ranking(30)
    where id = '00000000-0000-0000-0000-00000000c501'),
  'afinidad_de devuelve el MISMO score que la lista' );

-- Un deep link a algo fuera de tus filtros tambien tiene que decir cuanto
-- encaja: el numero es lo que explica por que NO encaja.
select actuar_como_servicio();
insert into publicaciones (id, usuario_id, titulo, tipo, direccion, precio_renta,
                           whatsapp, latitud, longitud, creado_en)
values ('00000000-0000-0000-0000-00000000c502',
        '00000000-0000-0000-0000-0000000000a7', 'Carisima', 'depa',
        'Calle C5 2', 99000, '5512345678', 19.29, -99.56, '2026-09-01 12:00:00+00');
select actuar_como('00000000-0000-0000-0000-0000000000a1');

select isnt(
  (select score_final from afinidad_de('00000000-0000-0000-0000-00000000c502'::uuid)),
  null,
  'afinidad_de responde aunque la publicacion quede fuera del filtro duro' );

-- Y el cliente deja de poder dictar la metrica.
select actuar_como_servicio();
select is(
  (select count(*)::int from pg_proc
    where proname = 'revelar_contacto'
      and pg_get_function_identity_arguments(oid) like '%numeric%'),
  0,
  'revelar_contacto ya no acepta un score del cliente' );

-- El valor que queda registrado lo calcula el servidor, no quien llama.
select actuar_como('00000000-0000-0000-0000-0000000000a1');
select revelar_contacto('00000000-0000-0000-0000-00000000c501'::uuid);
select actuar_como_servicio();
select is(
  (select score_mostrado from contactos
    where usuario_id = '00000000-0000-0000-0000-0000000000a1'
      and publicacion_id = '00000000-0000-0000-0000-00000000c501'),
  (select score_final from afinidad_de_para('00000000-0000-0000-0000-0000000000a1',
                                            '00000000-0000-0000-0000-00000000c501'::uuid)),
  'score_mostrado lo calcula el servidor' );

-- ════════════════ 60 a 62 · END-27: errores por SUBCADENA ════════════════
-- La app distinguia sus errores asi:
--
--   mensaje.includes('duplicate') || mensaje.includes('unique')
--   e.message.includes('límite')
--   mensaje.includes('cuota')
--
-- Eso depende del TEXTO del error de Postgres, que cambia por version y por
-- locale. En un servidor con locale en espanol, «duplicate key value» ya no
-- dice «duplicate», y la app mostraria «intenta de nuevo en un momento» ante
-- algo que no va a funcionar nunca.
--
-- Y las dos excepciones propias usaban el MISMO codigo —check_violation—, asi
-- que el codigo tampoco las distinguia. De ahi la subcadena: no habia otra cosa
-- a la que agarrarse. La correccion no es leer el codigo, es DARLES uno.
select actuar_como_servicio();
update publicaciones set activa = false;
update usuarios set presupuesto_max = 99999, distancia_max_km = 999
 where id = '00000000-0000-0000-0000-0000000000a1';

-- Cuota agotada: codigo propio, no `check_violation` compartido.
select actuar_como('00000000-0000-0000-0000-0000000000a1');
select throws_ok(
  $$ select consumir_cuota('parseo_llm', 0) $$,
  'CP001',
  null,
  'la cuota agotada tiene su propio SQLSTATE' );

-- Limite de publicaciones activas: otro codigo, distinguible del anterior.
select actuar_como_servicio();
insert into publicaciones (usuario_id, titulo, tipo, direccion, precio_renta, whatsapp)
select '00000000-0000-0000-0000-0000000000c2', 'Tope ' || n, 'depa', 'Calle T ' || n,
       2500, '5512345678'
  from generate_series(1, 15) n;

select throws_ok(
  $$ insert into publicaciones (usuario_id, titulo, tipo, direccion, precio_renta, whatsapp)
     values ('00000000-0000-0000-0000-0000000000c2', 'Tope 16', 'depa', 'Calle T 16', 2500, '5512345678') $$,
  'CP002',
  null,
  'el limite de publicaciones tiene su propio SQLSTATE' );

-- Y lo que Postgres YA distingue bien no se reetiqueta: una violacion de
-- unicidad es 23505 en todas partes, y darle un codigo propio seria inventar un
-- dialecto donde ya hay un estandar. Esta asercion lo fija, para que la
-- convencion CP no se extienda a donde no hace falta.
select actuar_como_servicio();
insert into reportes (reportado_por, publicacion_id, motivo)
values ('00000000-0000-0000-0000-0000000000c1',
        '00000000-0000-0000-0000-00000000c501', 'contenido sospechoso');
select throws_ok(
  $$ insert into reportes (reportado_por, publicacion_id, motivo)
     values ('00000000-0000-0000-0000-0000000000c1',
             '00000000-0000-0000-0000-00000000c501', 'contenido sospechoso') $$,
  '23505',
  null,
  'un reporte duplicado sigue siendo 23505, el codigo estandar' );

-- ════════════════ 63 y 64 · END-28: 384 flotantes al telefono ════════════════
-- `sugerencias_publicaciones` devolvia `vector_embedding vector(384)` en su
-- tabla de retorno. Medido contra produccion el 19/09/2026: **el 85 % del
-- payload**, 4.7 KB por fila, de un valor que el cliente NUNCA lee — toda la
-- similitud de coseno se calcula en Postgres (§18).
--
-- Con treinta filas son ~140 KB por refresco, en red movil, para nada.
select actuar_como_servicio();

select ok(
  pg_get_function_result('sugerencias_publicaciones(int,text,text)'::regprocedure) not like '%vector_embedding%',
  'sugerencias_publicaciones ya no devuelve el vector al cliente' );

-- Y el Nivel 2 sigue funcionando: el ranking se une por id para conseguirlo, en
-- vez de recibirlo de vuelta. Sin esta asercion, quitar la columna podria
-- romper la similitud sin que nada se quejara.
select is(
  (select count(*)::int from sugerencias_con_ranking(30) where similitud is not null),
  (select count(*)::int from sugerencias_con_ranking(30)
    where id in (select id from publicaciones where vector_embedding is not null)),
  'el ranking sigue calculando similitud sin recibir el vector' );

-- ════════════ 65 a 68 · END-17: el filtro de tipo vivia en el telefono ════════════
-- `inicio.tsx` filtraba por tipo EN EL CLIENTE sobre el top-30 del servidor. Si
-- en esos 30 no habia cuartos, la app decia «SIN REGISTROS DE ESE TIPO» con
-- cincuenta cuartos disponibles. Es el invariante 5 al reves: el ultimo filtro
-- que el usuario toca era el unico que no se aplicaba en Postgres.
select actuar_como_servicio();
insert into publicaciones (id, usuario_id, titulo, tipo, direccion, precio_renta,
                           whatsapp, latitud, longitud, permite_mascotas)
values ('00000000-0000-0000-0000-00000000c0a1',
        '00000000-0000-0000-0000-0000000000b2', 'Cuarto B', 'cuarto',
        'Calle Falsa 125', 2800, '5512345678', 19.29, -99.56, false);

select actuar_como('00000000-0000-0000-0000-0000000000a1');

-- Con `> 0` explicito: una asercion que solo compruebe «todas son cuarto» pasa
-- igual de bien con cero filas, y entonces no comprueba nada.
select is(
  (select count(*)::int from sugerencias_publicaciones(30, 'cuarto')),
  (select count(*)::int from sugerencias_publicaciones(30, 'cuarto') where tipo = 'cuarto'),
  'sugerencias_publicaciones con p_tipo devuelve SOLO ese tipo' );

select cmp_ok(
  (select count(*)::int from sugerencias_publicaciones(30, null)), '>',
  (select count(*)::int from sugerencias_publicaciones(30, 'cuarto')),
  'p_tipo null significa TODO, no nada' );

-- La que de verdad importa. `sugerencias_con_ranking` llama a la otra por
-- dentro: si la envoltura se olvida de propagar el parametro, devuelve el
-- catalogo entero sin error y sin log, y la pantalla sigue mintiendo igual que
-- antes — solo que ahora con una firma que promete lo contrario.
select is(
  (select count(*)::int from sugerencias_con_ranking(30, 'cuarto') where tipo <> 'cuarto'),
  0,
  'sugerencias_con_ranking PROPAGA p_tipo a la funcion que envuelve' );

-- Fallar cerrado, invariante 1. Un tipo que no existe devuelve vacio, no todo.
-- Importa porque el valor llega del cliente: el dia que un chip mande una
-- cadena equivocada —y este repositorio ya tiene una, `casa` por
-- `casa_compartida`— la app debe mostrar «no hay», no el catalogo completo.
select is(
  (select count(*)::int from sugerencias_publicaciones(30, 'mansion')),
  0,
  'un tipo desconocido devuelve cero filas, no el catalogo entero' );

-- ════════════ 69 · los tres tipos validos viven en DOS sitios ════════════
-- `TipoPublicacion` en database.types.ts esta escrito A MANO y espeja este
-- CHECK. TypeScript comprueba que los chips de `inicio.tsx` usen valores de ese
-- tipo —y con eso atrapo el `casa` que llevaba aqui desde siempre—, pero no
-- puede saber si el tipo sigue describiendo la base.
--
-- El dia que alguien anada un cuarto valor, esta asercion falla y obliga a
-- tocar el otro extremo. Sin ella, el tipo nuevo seria invisible para la app:
-- se podria publicar y no se podria filtrar, sin un solo error en ninguna capa.
select is(
  (select pg_get_constraintdef(oid) from pg_constraint
    where conrelid = 'publicaciones'::regclass and conname = 'publicaciones_tipo_valido'),
  'CHECK ((tipo = ANY (ARRAY[''depa''::text, ''cuarto''::text, ''casa_compartida''::text])))',
  'los tipos validos siguen siendo tres, los mismos que conoce el cliente' );

-- ══════════ 70 a 74 · END-15: la cola de geocodificacion no existia ══════════
-- El encabezado de la Edge Function afirmaba que se geocodifica «desde el
-- SERVIDOR, en cola», como una de las tres obligaciones de la ODbL. No habia
-- cola ni limite de ritmo: solo cache. La serializacion vivia en un `for` del
-- cliente (publicaciones.service.ts) SIN espera alguna, y dos telefonos a la vez
-- duplicaban el ritmo de todas formas. Una obligacion de licencia que depende de
-- que el cliente se porte bien no es una obligacion cumplida.
select actuar_como_servicio();

-- La geocodificacion era la unica Edge Function sin cuota.
select lives_ok(
  $$ insert into cuotas_uso (usuario_id, recurso, dia, consumo)
     values ('00000000-0000-0000-0000-0000000000a1', 'geocodificacion', current_date, 1) $$,
  'cuotas_uso acepta el recurso geocodificacion' );

-- Y el CHECK no se convirtio en tierra de nadie al ampliarlo.
select throws_ok(
  $$ insert into cuotas_uso (usuario_id, recurso, dia, consumo)
     values ('00000000-0000-0000-0000-0000000000a1', 'lo_que_sea', current_date, 1) $$,
  '23514',
  null,
  'cuotas_uso sigue rechazando un recurso inventado' );

-- El turno lo pide el SERVIDOR, no el telefono. Si `authenticated` pudiera
-- llamarla, cualquiera quemaria los turnos de todos en un bucle y dejaria la
-- geocodificacion inservible para los demas sin tocar una sola publicacion.
select ok(
  not has_function_privilege('authenticated', 'reservar_turno_geocodificacion()', 'execute'),
  'reservar_turno_geocodificacion no es ejecutable por authenticated' );

-- El nucleo: turnos separados un segundo, contados por la BASE y no por el
-- cliente. Se parte de un turno ya vencido para que la primera no espere.
update geocodificaciones_ritmo set proximo_turno = now() - interval '1 second';

select is(
  reservar_turno_geocodificacion(), 0,
  'con el turno vencido, la primera reserva no espera' );

-- La segunda reserva del MISMO instante recibe el turno siguiente, no el mismo.
-- Es lo que convierte «una peticion por segundo» en algo que se cumple aunque
-- lleguen diez a la vez.
select cmp_ok(
  reservar_turno_geocodificacion(), '>=', 900,
  'la segunda reserva inmediata espera un segundo' );

-- ═══════ 75 a 78 · el `revoke from public` no revocaba nada ═══════
-- Supabase trae `alter default privileges ... grant execute on functions to
-- anon, authenticated, service_role`. Cada funcion nueva nace con esas tres
-- concesiones ESCRITAS en su ACL, asi que `revoke ... from public` no las quita:
-- no vienen de PUBLIC. Doce funciones del proyecto llevaban un `revoke` encima
-- que no hacia nada, y dos de ellas eran explotables:
--
--   devolver_cuota('revelar_contacto') decrementaba la cuota del PROPIO
--   llamante. Veinticinco llamadas la devolvian a cero y permitian revelar
--   veinticinco telefonos mas, en bucle. El scraping que AUD-04 existe para
--   impedir, con una RPC de una linea.
--
--   afinidad_de_para(usuario, publicacion) acepta el uuid de CUALQUIERA. La
--   0031 la separo de su envoltura `afinidad_de` precisamente para que nadie
--   pudiera pedir la afinidad de otra persona, y la separacion no existia.
--
-- Estas dos aserciones son LISTAS BLANCAS y no comprobaciones una a una: asi una
-- funcion futura que nazca abierta rompe la prueba sin que nadie se acuerde de
-- anadir su caso.
select actuar_como_servicio();

create or replace function ejecutables_por(p_rol text) returns text[]
language sql stable as $$
  select coalesce(array_agg(p.proname order by p.proname), '{}')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
     -- Los auxiliares de este archivo, explicados abajo.
     and p.proname not in ('actuar_como', 'actuar_como_servicio', 'ejecutables_por')
     and has_function_privilege(p_rol, p.oid, 'execute');
$$;

-- Los tres auxiliares de ESTE archivo quedan FUERA del recuento, y conviene
-- decir por que en vez de dejarlo como una excepcion silenciosa.
--
-- Se intento cerrarlos como cualquier otra funcion. No se puede: el arnes
-- alterna entre `actuar_como(usuario)` y `actuar_como_servicio()`, asi que la
-- segunda tiene que ser ejecutable POR EL ROL DESDE EL QUE SE VUELVE — es decir,
-- por `authenticated`. Revocarla deja la prueba sin forma de regresar a
-- privilegios de servicio, y el archivo entero aborta con «permission denied»
-- en el primer bloque que venga despues.
--
-- Viven solo dentro de esta transaccion, que termina en `rollback`: no existen
-- en la base real ni un instante. Excluirlas por nombre aqui es mas honesto que
-- dejarlas en la lista blanca de produccion, donde nadie sabria por que estan.


select is(
  ejecutables_por('authenticated'),
  array[
    'abrir_conversacion',
    'aceptar_aviso',
    'afinidad_de',
    'afinidad_roomie_de',
    'agregar_funcion',
    'buscar_codigo_postal',
    'cambiar_perfil_activo',
    'consumir_cuota',
    'contactos_de_mis_publicaciones',
    'destacadas_publicaciones',
    'distancia_km',
    'enviar_verificacion',
    'exportar_mis_datos',
    'favoritos_por_negocio',
    'favoritos_por_publicacion',
    'guardar_horario',
    'guardar_menu',
    'iniciar_prueba',
    'mi_suscripcion',
    'negocio_abierto_en',
    'negocios_ordenados',
    'nuevas_esta_semana',
    'publicaciones_parecidas',
    'puede_subir_evidencia',
    'registrar_error_app',
    'reportar_resena',
    'responder_resena',
    'resumen_conversaciones',
    'revelar_contacto',
    'score_ajuste',
    'simular_pago',
    'sugerencias_con_ranking',
    'sugerencias_publicaciones',
    'sugerencias_roomies',
    'tiene_rol_aprobado'
  ],
  'solo la lista blanca es ejecutable por authenticated' );

-- `anon` es el rol de antes de iniciar sesion. Ninguna funcion del proyecto
-- tiene nada que hacer ahi: todas dependen de auth.uid().
select is(
  ejecutables_por('anon'),
  '{}'::text[],
  'anon no puede ejecutar ninguna funcion del proyecto' );

-- La firma vieja de devolver_cuota desaparece. Dejarla en su sitio y solo
-- revocarla bastaria hoy, pero un `grant` posterior escrito sin pensar la
-- reabriria; sin la firma no hay nada que reabrir.
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'devolver_cuota'
      and pg_get_function_identity_arguments(p.oid) = 'p_recurso text'),
  0,
  'devolver_cuota(text), la que el cliente podia llamar, ya no existe' );

-- Y lo que no puede romperse al cerrar la interna: la envoltura sigue
-- respondiendo. `afinidad_de` era `security invoker`, asi que llamaba a
-- `afinidad_de_para` CON LA IDENTIDAD DEL CLIENTE — por eso el cliente
-- necesitaba poder ejecutarla y por eso la separacion no servia de nada.
-- Se reactiva a proposito: aserciones anteriores de este archivo la desactivan
-- para probar la vista publica, y `afinidad_de_para` lee de esa misma vista. Sin
-- esto la asercion daria cero por el motivo equivocado y pareceria que cerrar la
-- interna rompio la envoltura.
select actuar_como_servicio();
update publicaciones set activa = true, oculta_por_reportes = false
 where id = '00000000-0000-0000-0000-00000000dea1';
-- Y el DUENO reactivado: `afinidad_de_para` une contra `perfiles_publicos`, que
-- exige `activo = true`, y una asercion anterior de este archivo suspende a b2.
-- Sin esta linea el `cross join` se queda vacio y la asercion da cero por un
-- motivo que no tiene nada que ver con lo que mide.
update usuarios set activo = true
 where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2');

select actuar_como('00000000-0000-0000-0000-0000000000a1');
select is(
  (select count(*)::int from afinidad_de('00000000-0000-0000-0000-00000000dea1')),
  1,
  'afinidad_de sigue respondiendo con la interna cerrada' );

-- ══════════ 79 a 82 · END-32: cuatro veces el mismo contenido ══════════
-- `inicio.tsx` pintaba TRES carruseles y una lista con el mismo conjunto. El
-- primero, «Mejor afinidad», era `filtradas.slice(0, 8)`: un prefijo LITERAL de
-- la lista que empezaba 24 fichas mas abajo. Los otros dos eran reordenamientos.
--
-- Y «Las de menor renta» ordenaba por precio el top-30 YA TRUNCADO por score:
-- eran las mas baratas de las treinta que mejor encajan, no las mas baratas. Es
-- END-17 con otro disfraz, y por eso el control de orden va al SERVIDOR y no al
-- cliente, aunque la orden D.5 dijera «en el sitio».
select actuar_como_servicio();

update usuarios set activo = true
 where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2');

-- Dos publicaciones construidas para que precio y ajuste discrepen: la barata
-- esta lejos y es vieja; la cara esta al lado y es de hoy.
insert into publicaciones (id, usuario_id, titulo, tipo, direccion, precio_renta,
                           whatsapp, latitud, longitud, permite_mascotas, creado_en)
values
  ('00000000-0000-0000-0000-00000000d501', '00000000-0000-0000-0000-0000000000b2',
   'Barata y lejos', 'depa', 'Calle D 1', 2000, '5512345678', 19.36, -99.55, false,
   now() - interval '200 days'),
  ('00000000-0000-0000-0000-00000000d502', '00000000-0000-0000-0000-0000000000b2',
   'Cara y al lado', 'depa', 'Calle D 2', 3400, '5512345678', 19.281, -99.551, false,
   now()),
  ('00000000-0000-0000-0000-00000000d503', '00000000-0000-0000-0000-0000000000b2',
   'Vieja de verdad', 'cuarto', 'Calle D 3', 2500, '5512345678', 19.282, -99.552, false,
   now() - interval '30 days');

select actuar_como('00000000-0000-0000-0000-0000000000a1');

-- LA asercion de esta orden. Con limite 1 y orden por precio, tiene que salir la
-- BARATA. Si el orden se aplicara despues de truncar —que es lo que hacia el
-- carrusel en el cliente— saldria la que mejor puntua, y el control mentiria
-- exactamente igual que los chips de tipo antes de B.3.
select is(
  (select id from sugerencias_publicaciones(1, null, 'precio')),
  '00000000-0000-0000-0000-00000000d501'::uuid,
  'ordenar por precio se aplica ANTES de truncar, no despues' );

-- Y el orden por defecto no cambia: sigue siendo el ajuste. Se afirma sobre el
-- SCORE y no sobre un id concreto: la primera version de esta asercion nombraba
-- una publicacion que yo daba por ganadora y gano otra del fixture. Afirmar
-- «sale esta fila» cuando lo que se quiere decir es «sale la de mayor score» es
-- atar la prueba a datos que no controla.
select is(
  (select score from sugerencias_publicaciones(1, null, 'ajuste')),
  (select max(score) from sugerencias_publicaciones(30, null, 'ajuste')),
  'el orden por defecto sigue siendo el ajuste' );

-- El carrusel que sustituye a los tres trae algo que la lista NO tiene: lo
-- reciente. Una publicacion de hace treinta dias no es novedad.
select is(
  (select count(*)::int from nuevas_esta_semana(20)
    where id = '00000000-0000-0000-0000-00000000d503'),
  0,
  'nuevas_esta_semana excluye lo que ya no es de esta semana' );

-- Y respeta el chip activo. Un carrusel de novedades que ignore el filtro de
-- tipo contradice a la pantalla en la que vive: con «Cuarto» seleccionado
-- ofreceria departamentos.
select is(
  (select count(*)::int from nuevas_esta_semana(20, 'cuarto') where tipo <> 'cuarto'),
  0,
  'nuevas_esta_semana respeta el filtro de tipo' );

-- ══════════ 83 · ninguna policy reevalua auth.uid() por fila ══════════
-- El linter de Supabase lo llama «Auth RLS Initialization Plan». Con
-- `auth.uid()` suelto en el USING, Postgres lo evalua UNA VEZ POR FILA; envuelto
-- en `(select auth.uid())` se convierte en un InitPlan que corre una sola vez.
--
-- Medido aqui mismo, 50 000 filas, misma policy y mismo dato:
--   auth.uid() suelto ......... 94.16 ms
--   (select auth.uid()) ....... 12.32 ms
-- 7.6x. A los volumenes de hoy —114 publicaciones— la diferencia es de decimas
-- de milisegundo; lo que importa es que crece LINEAL con las filas, y `mensajes`
-- es la tabla que mas va a crecer.
--
-- Esta asercion es una LISTA NEGRA y no una comprobacion por policy: cualquier
-- policy futura escrita con la forma lenta la rompe, sin que nadie tenga que
-- acordarse de anadir su caso. Es la misma forma que la 75.
select actuar_como_servicio();

select is(
  (select coalesce(array_agg(tablename || '.' || policyname order by tablename, policyname), '{}')
     from pg_policies
    where schemaname = 'public'
      -- `!~*`, insensible a mayusculas. Postgres ALMACENA la expresion
      -- normalizada —`( SELECT auth.uid() AS uid)`, con SELECT en mayuscula y
      -- un alias que nadie escribio—, asi que un patron en minuscula con `!~`
      -- no casa nunca y la asercion daria roja con las policies ya corregidas.
      -- Paso de verdad al escribir esto: la migracion habia aplicado bien y la
      -- prueba seguia en rojo por la forma del patron, no por el estado.
      and ( (qual ~* 'auth\.uid\(\)' and qual !~* '\(\s*select\s+auth\.uid\(\)')
         or (with_check ~* 'auth\.uid\(\)' and with_check !~* '\(\s*select\s+auth\.uid\(\)') )),
  '{}'::text[],
  'ninguna policy reevalua auth.uid() por fila' );

-- ══════════ 84 a 86 · la afinidad de una PERSONA ══════════
-- `sugerencias_roomies` ordena la lista por afinidad semantica y la tarjeta la
-- enseña. Al abrir el perfil de esa misma persona, el numero DESAPARECIA: la
-- pantalla donde de verdad se decide si contactar a alguien era la unica sin el
-- dato por el que esa persona salio en la lista.
--
-- Es el mismo defecto que END-21 cerro para publicaciones —el desglose se
-- esfumaba segun por donde entraras— y seguia vivo para personas.
select actuar_como_servicio();

update usuarios set perfil_vector = array_fill(0.1, array[384])::vector
 where id = '00000000-0000-0000-0000-0000000000a1';

insert into roomies (usuario_id, descripcion_busqueda, estado, vector_busqueda)
values ('00000000-0000-0000-0000-0000000000b2', 'busco lugar tranquilo para estudiar',
        'activo', array_fill(0.1, array[384])::vector)
on conflict (usuario_id) do update
  set vector_busqueda = excluded.vector_busqueda, estado = 'activo';

select actuar_como('00000000-0000-0000-0000-0000000000a1');

select cmp_ok(
  (select similitud from afinidad_roomie_de('00000000-0000-0000-0000-0000000000b2')),
  '>', 0.9::numeric,
  'con los dos vectores, la afinidad de una persona sale un numero' );

-- LA asercion. Si el perfil mostrara un numero DISTINTO del que ordeno la lista,
-- seria peor que no mostrar ninguno: tocar una tarjeta cambiaria el dato por el
-- que la tocaste. Son dos decisiones correctas por separado que se contradicen
-- al correr juntas, que es el patron que este proyecto lleva toda la auditoria
-- encontrando.
select is(
  (select similitud from afinidad_roomie_de('00000000-0000-0000-0000-0000000000b2')),
  (select similitud from sugerencias_roomies(30)
    where usuario_id = '00000000-0000-0000-0000-0000000000b2'),
  'el perfil muestra EL MISMO numero que ordeno la lista' );

-- Sin ficha de roomie no hay con que comparar. Null y no cero: cero seria una
-- afinidad medida, y esto es su ausencia (la misma regla de END-08).
select actuar_como_servicio();
update roomies set vector_busqueda = null
 where usuario_id = '00000000-0000-0000-0000-0000000000b2';
select actuar_como('00000000-0000-0000-0000-0000000000a1');

select is(
  (select similitud from afinidad_roomie_de('00000000-0000-0000-0000-0000000000b2')),
  null::numeric,
  'sin vector de busqueda, la afinidad es null y no cero' );

-- ════════════════ push_tokens · borrar el propio al cerrar sesión ════════════════
-- Hallazgo 3 (15/10/2026). La tabla tenía policies de select, insert y update y
-- NINGUNA de delete, y `authenticated` sí tiene el privilegio DELETE a nivel de
-- tabla: así que borrar afectaba CERO filas, en silencio. Al cerrar sesión el
-- token del teléfono se quedaba ligado a la cuenta anterior, y los mensajes de
-- esa cuenta seguían llegando a un teléfono que ya usaba otra persona.
--
-- Como siempre con RLS, se afirma sobre el NÚMERO DE FILAS, no sobre un error:
-- un delete bloqueado no lanza nada.
select actuar_como_servicio();
insert into push_tokens (usuario_id, token) values
  ('00000000-0000-0000-0000-0000000000a1', 'ExponentPushToken[token-de-a]'),
  ('00000000-0000-0000-0000-0000000000b2', 'ExponentPushToken[token-de-b]');
select actuar_como('00000000-0000-0000-0000-0000000000a1');

-- A intenta borrar la fila de B por su id. RLS no lanza error: la filtra.
delete from push_tokens where usuario_id = '00000000-0000-0000-0000-0000000000b2';
select actuar_como_servicio();
select is(
  (select count(*)::int from push_tokens
    where usuario_id = '00000000-0000-0000-0000-0000000000b2'),
  1,
  'A no puede borrar el token push de B' );

-- A borra el suyo: es lo que hace la app al cerrar sesion.
select actuar_como('00000000-0000-0000-0000-0000000000a1');
delete from push_tokens where usuario_id = '00000000-0000-0000-0000-0000000000a1';
select actuar_como_servicio();
select is(
  (select count(*)::int from push_tokens
    where usuario_id = '00000000-0000-0000-0000-0000000000a1'),
  0,
  'A si borra su propio token push' );

-- Un delete SIN where es el descuido clasico: debe llevarse solo lo que A ve.
select actuar_como('00000000-0000-0000-0000-0000000000a1');
delete from push_tokens;
select actuar_como_servicio();
select is(
  (select count(*)::int from push_tokens
    where usuario_id = '00000000-0000-0000-0000-0000000000b2'),
  1,
  'un delete sin where de A tampoco toca el token de B' );
select actuar_como('00000000-0000-0000-0000-0000000000a1');

-- ════════════ 90 a 96 · el tope de 15 se aplica también al ACTIVAR ════════════
-- Hallazgo de la revisión del 15/10/2026. `trg_limitar_publicaciones` era BEFORE
-- INSERT: un `update ... set activa = true` no pasaba por él. Dos consecuencias:
--
--   · Se saltaba con la API: insertar filas INACTIVAS (que el tope no cuenta) y
--     activarlas después. Con 14 activas, tres inactivas y tres updates, quedaban 17.
--   · REACTIVAR no estaba limitado, aunque `publicaciones.tsx` (AUD-26) lo afirma:
--     con 15 activas y una inactiva vieja, reactivarla daba 16.
--
-- Los nombres de los casos van por el estado de la cuenta: d5 tiene 14 activas y 3
-- inactivas. Las filas se crean como servicio; los cambios, como la dueña.
select actuar_como_servicio();
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        created_at, updated_at, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000d5',
   'authenticated', 'authenticated', 'd5@test.mx', '', now(), now(),
   '{"nombre_usuario":"usuario_d5","nombre_completo":"Cuenta Cinco"}');
insert into publicaciones (usuario_id, titulo, tipo, direccion, precio_renta, whatsapp, activa)
select '00000000-0000-0000-0000-0000000000d5', 'D5 activa ' || n, 'depa', 'Calle D ' || n,
       2500, '5512345678', true
  from generate_series(1, 14) n;
insert into publicaciones (usuario_id, titulo, tipo, direccion, precio_renta, whatsapp, activa)
select '00000000-0000-0000-0000-0000000000d5', 'D5 inactiva ' || n, 'depa', 'Calle I ' || n,
       2500, '5512345678', false
  from generate_series(1, 3) n;

-- Una inactiva ajena, para comprobar que el tope es por cuenta.
insert into publicaciones (usuario_id, titulo, tipo, direccion, precio_renta, whatsapp, activa)
values ('00000000-0000-0000-0000-0000000000b2', 'B2 inactiva', 'depa', 'Calle B', 2500, '5512345678', false);

select actuar_como('00000000-0000-0000-0000-0000000000d5');

select lives_ok(
  $$ update publicaciones set activa = true
      where usuario_id = '00000000-0000-0000-0000-0000000000d5' and titulo = 'D5 inactiva 1' $$,
  'con 14 activas, activar una mas (la 15) se permite' );

select throws_ok(
  $$ update publicaciones set activa = true
      where usuario_id = '00000000-0000-0000-0000-0000000000d5' and titulo = 'D5 inactiva 2' $$,
  'CP002',
  null,
  'con 15 activas, activar la 16 se rechaza con el mismo codigo que al crear' );

select actuar_como_servicio();
select is(
  (select count(*)::int from publicaciones
    where usuario_id = '00000000-0000-0000-0000-0000000000d5' and activa),
  15,
  'el tope se sostiene: nunca hay mas de 15 activas por la via de los updates' );

-- Quitar una al limite NO es activar: tiene que poder hacerse siempre.
select actuar_como('00000000-0000-0000-0000-0000000000d5');
select lives_ok(
  $$ update publicaciones set activa = false
      where usuario_id = '00000000-0000-0000-0000-0000000000d5' and titulo = 'D5 activa 1' $$,
  'desactivar con el tope lleno se permite' );

-- Reactivar la que se acaba de quitar vuelve a dejar 15, y eso es legitimo. Con el
-- tope lleno, un update que SOLO cambia el titulo de una activa no debe contar como
-- una activacion: la fila ya estaba activa.
select lives_ok(
  $$ update publicaciones set activa = true
      where usuario_id = '00000000-0000-0000-0000-0000000000d5' and titulo = 'D5 activa 1' $$,
  'reactivar la que se acaba de quitar (de 14 a 15) se permite' );

select lives_ok(
  $$ update publicaciones set activa = true, titulo = 'D5 activa 2 editada'
      where usuario_id = '00000000-0000-0000-0000-0000000000d5' and titulo = 'D5 activa 2' $$,
  'volver a poner activa = true en una fila ya activa no cuenta como activar' );

-- El tope es por cuenta: que d5 este al limite no afecta a b2.
select actuar_como('00000000-0000-0000-0000-0000000000b2');
select lives_ok(
  $$ update publicaciones set activa = true
      where usuario_id = '00000000-0000-0000-0000-0000000000b2' and titulo = 'B2 inactiva' $$,
  'el tope es por cuenta: la activacion de b2 no depende de d5' );

-- ════════════ 97 y 98 · el bucket de fotos tiene límites propios ════════════
-- Hallazgo de la revisión del 15/10/2026. El bucket `fotos` no tenía límite de
-- tamaño ni de tipo, y la policy de subida solo comprueba la CARPETA de la cuenta:
-- cualquier sesión podía subir archivos de hasta 50 MiB (el tope global del
-- servicio) y de cualquier tipo a `publicaciones/<su-id>/...`, sin crear una sola
-- fila. Un tope a las filas inactivas no lo habría acotado.
--
-- Estas dos comprueban la CONFIGURACIÓN. Que Storage la APLIQUE se comprueba con
-- `scripts/verificar-bucket-fotos.mjs`, que sube de verdad un archivo excesivo y
-- uno de otro tipo: pgTAP no habla con la API de Storage.
select actuar_como_servicio();
select is(
  (select file_size_limit from storage.buckets where id = 'fotos'),
  5242880::bigint,
  'el bucket de fotos limita cada archivo a 5 MiB' );

select is(
  (select allowed_mime_types from storage.buckets where id = 'fotos'),
  array['image/jpeg']::text[],
  'el bucket de fotos solo admite image/jpeg, que es lo unico que sube la app' );


-- ═══════ 99 a 116 · roles de usuario (Cuervo 360) ═══════
-- Todo usuario es ESTUDIANTE por defecto y eso NO se guarda: «estudiante verificado» ya se
-- deriva del correo confirmado (0026), y un dato que se puede consultar no se copia. La tabla
-- guarda solo las funciones que se AGREGAN: comerciante, arrendador y admin.
--
-- Quien se beneficia de un rol no se lo escribe: el cliente solo LEE sus filas. Agregarse
-- una función pasa por `agregar_funcion`, que solo crea comerciante o arrendador en
-- `sin_verificar`; cambiar el estado o crear un admin es cosa del servidor.
select actuar_como_servicio();

select is(
  (select relrowsecurity from pg_class where oid = 'public.roles_usuario'::regclass),
  true,
  'roles_usuario tiene RLS activo' );

select is(
  has_table_privilege('anon', 'public.roles_usuario', 'select'),
  false,
  'anon no puede leer roles_usuario' );

select is(
  (select bool_or(has_table_privilege('authenticated', 'public.roles_usuario', p))
     from unnest(array['insert', 'update', 'delete', 'truncate']) p),
  false,
  'authenticated no puede escribir en roles_usuario: ni insertar, ni actualizar, ni borrar' );

select is(
  has_table_privilege('authenticated', 'public.roles_usuario', 'select'),
  true,
  'authenticated sí puede leer sus roles (la policy acota las filas)' );

-- Agregarse una función: nace sin verificar, por solicitud.
select actuar_como('00000000-0000-0000-0000-0000000000a1');
select agregar_funcion('arrendador');
select is(
  (select estado from roles_usuario
    where usuario_id = '00000000-0000-0000-0000-0000000000a1' and rol = 'arrendador'),
  'sin_verificar',
  'agregar_funcion deja la función en sin_verificar' );
select is(
  (select origen from roles_usuario
    where usuario_id = '00000000-0000-0000-0000-0000000000a1' and rol = 'arrendador'),
  'solicitud',
  'y con origen solicitud' );

-- Repetir NO duplica y NO degrada: si el servidor ya la aprobó, volver a pedirla no la
-- devuelve a sin_verificar (sería quitarle a alguien una aprobación pulsando un botón).
select actuar_como_servicio();
update roles_usuario set estado = 'aprobado'
 where usuario_id = '00000000-0000-0000-0000-0000000000a1' and rol = 'arrendador';
select actuar_como('00000000-0000-0000-0000-0000000000a1');
select agregar_funcion('arrendador');
select is(
  (select count(*)::int from roles_usuario
    where usuario_id = '00000000-0000-0000-0000-0000000000a1' and rol = 'arrendador'),
  1,
  'pedir la misma función dos veces no crea una segunda fila' );
select is(
  (select estado from roles_usuario
    where usuario_id = '00000000-0000-0000-0000-0000000000a1' and rol = 'arrendador'),
  'aprobado',
  'volver a pedirla no degrada una aprobación' );

-- Aislamiento entre cuentas: la ajena no ve nada de la dueña.
select actuar_como('00000000-0000-0000-0000-0000000000b2');
select is(
  (select count(*)::int from roles_usuario
    where usuario_id = '00000000-0000-0000-0000-0000000000a1'),
  0,
  'una cuenta ajena no ve los roles de otra' );
select is(
  (select count(*)::int from roles_usuario),
  0,
  'y sin haber pedido ninguno, no ve ninguna fila' );

-- Lo que no se puede pedir.
select throws_ok(
  $$select agregar_funcion('admin')$$, 'CP003', null,
  'nadie se agrega admin' );
select throws_ok(
  $$select agregar_funcion('estudiante')$$, 'CP003', null,
  'estudiante es implícito: no se agrega' );

select actuar_como_servicio();
select throws_ok(
  $$select agregar_funcion('comerciante')$$, '28000', null,
  'sin sesión no se agrega ninguna función' );

-- Y el cliente no escribe la tabla por la API aunque lo intente.
select actuar_como('00000000-0000-0000-0000-0000000000b2');
select throws_ok(
  $$insert into roles_usuario (usuario_id, rol, estado)
    values ('00000000-0000-0000-0000-0000000000b2', 'admin', 'aprobado')$$,
  '42501', null,
  'no se puede insertar un admin directamente' );
select throws_ok(
  $$update roles_usuario set estado = 'aprobado'
     where usuario_id = '00000000-0000-0000-0000-0000000000a1'$$,
  '42501', null,
  'no se puede cambiar el estado directamente' );
select throws_ok(
  $$delete from roles_usuario where usuario_id = '00000000-0000-0000-0000-0000000000a1'$$,
  '42501', null,
  'no se puede borrar un rol directamente' );

-- El criterio del backfill de la migración 0043: quien ya es dueño de una publicación se
-- migra como arrendador aprobado, con origen `migracion` para que no pase por solicitado.
select actuar_como_servicio();
insert into roles_usuario (usuario_id, rol, estado, origen)
select distinct usuario_id, 'arrendador', 'aprobado', 'migracion'
  from publicaciones
on conflict do nothing;
select is(
  (select origen from roles_usuario
    where usuario_id = '00000000-0000-0000-0000-0000000000b2' and rol = 'arrendador'),
  'migracion',
  'el dueño de una publicación queda como arrendador migrado' );

-- Borrar la cuenta borra sus roles (eliminar-cuenta borra auth.users y todo cae en cascada).
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        created_at, updated_at, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000c7',
        'authenticated', 'authenticated', 'c7@test.mx', '', now(), now(),
        '{"nombre_usuario":"usuario_c7","nombre_completo":"Cata Prueba"}');
select actuar_como('00000000-0000-0000-0000-0000000000c7');
select agregar_funcion('comerciante');
select actuar_como_servicio();
delete from auth.users where id = '00000000-0000-0000-0000-0000000000c7';
select is(
  (select count(*)::int from roles_usuario
    where usuario_id = '00000000-0000-0000-0000-0000000000c7'),
  0,
  'borrar la cuenta borra sus roles' );


-- ═══════ 117 a 133 · favoritos (Cuervo 360) ═══════
-- Un favorito es PRIVADO: solo su dueña lo lee, nadie ve cuántos tiene una publicación. Solo se
-- puede guardar una publicación VISIBLE (activa y sin ocultar); si no, la policy de insert la
-- rechaza con el mismo error que una que no existe, para que guardar no sirva de sonda que
-- revele qué publicaciones están ocultas. Tope de 200 por cuenta, aplicado en la base.
select actuar_como_servicio();
update publicaciones set activa = true, oculta_por_reportes = false
 where id = '00000000-0000-0000-0000-00000000dea1';
insert into publicaciones (id, usuario_id, titulo, tipo, direccion, precio_renta,
                           whatsapp, latitud, longitud, permite_mascotas)
values ('00000000-0000-0000-0000-00000000dea2', '00000000-0000-0000-0000-0000000000b2',
        'Depa B2', 'depa', 'Calle Falsa 456', 3000, '5512345678', 19.29, -99.56, false);

select is(
  (select relrowsecurity from pg_class where oid = 'public.favoritos'::regclass),
  true, 'favoritos tiene RLS activo' );

select is(
  has_table_privilege('anon', 'public.favoritos', 'select'),
  false, 'anon no puede leer favoritos' );

select is(
  (select bool_or(has_table_privilege('authenticated', 'public.favoritos', p))
     from unnest(array['update', 'truncate']) p),
  false, 'authenticated no puede actualizar ni truncar favoritos' );

select is(
  (select bool_and(has_table_privilege('authenticated', 'public.favoritos', p))
     from unnest(array['select', 'insert', 'delete']) p),
  true, 'authenticated puede leer, guardar y quitar sus favoritos' );

-- Guardar una publicación visible.
select actuar_como('00000000-0000-0000-0000-0000000000a1');
insert into favoritos (usuario_id, publicacion_id)
values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000dea1');
select is(
  (select count(*)::int from favoritos), 1,
  'una cuenta guarda una publicación visible y la ve' );

select throws_ok(
  $$insert into favoritos (usuario_id, publicacion_id)
    values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000dea1')$$,
  '23505', null, 'guardar dos veces la misma publicación se rechaza por clave única' );

-- Aislamiento: la ajena no ve nada, ni puede guardar a nombre de otra.
select actuar_como('00000000-0000-0000-0000-0000000000b2');
select is(
  (select count(*)::int from favoritos), 0,
  'una cuenta ajena no ve los favoritos de otra' );

select throws_ok(
  $$insert into favoritos (usuario_id, publicacion_id)
    values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000dea2')$$,
  '42501', null, 'no se puede guardar un favorito a nombre de otra cuenta' );

-- Solo lo visible: inactiva y también inexistente dan el MISMO error (no hay sonda).
select actuar_como_servicio();
update publicaciones set activa = false where id = '00000000-0000-0000-0000-00000000dea2';
select actuar_como('00000000-0000-0000-0000-0000000000a1');
select throws_ok(
  $$insert into favoritos (usuario_id, publicacion_id)
    values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000dea2')$$,
  '42501', null, 'no se puede guardar una publicación inactiva u oculta' );
select throws_ok(
  $$insert into favoritos (usuario_id, publicacion_id)
    values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000ffff')$$,
  '42501', null, 'una publicación inexistente da el mismo error que una oculta: no sirve de sonda' );

-- Quitar: la dueña sí, la ajena no.
select actuar_como('00000000-0000-0000-0000-0000000000b2');
delete from favoritos where usuario_id = '00000000-0000-0000-0000-0000000000a1';
select actuar_como_servicio();
select is(
  (select count(*)::int from favoritos where usuario_id = '00000000-0000-0000-0000-0000000000a1'), 1,
  'una cuenta ajena no puede quitar el favorito de otra' );

select actuar_como('00000000-0000-0000-0000-0000000000a1');
select throws_ok(
  $$update favoritos set creado_en = now()$$, '42501', null,
  'un favorito no se actualiza: se guarda o se quita' );
delete from favoritos where publicacion_id = '00000000-0000-0000-0000-00000000dea1';
select is(
  (select count(*)::int from favoritos), 0,
  'la dueña quita su favorito' );

-- El tope de 200, en la base. 199 ya guardados (de publicaciones inactivas, preparados con
-- privilegios de servicio) + la visible = 200 exactos: pasa. La 201 se rechaza.
select actuar_como_servicio();
update publicaciones set activa = true where id = '00000000-0000-0000-0000-00000000dea2';
insert into publicaciones (id, usuario_id, titulo, tipo, direccion, precio_renta,
                           whatsapp, latitud, longitud, permite_mascotas, activa)
select ('00000000-0000-0000-f000-' || lpad(i::text, 12, '0'))::uuid,
       '00000000-0000-0000-0000-0000000000b2', 'Relleno ' || i, 'depa', 'Calle ' || i, 2000,
       '5512345678', 19.29, -99.56, false, false
  from generate_series(1, 199) i;
insert into favoritos (usuario_id, publicacion_id)
select '00000000-0000-0000-0000-0000000000a1', id from publicaciones where titulo like 'Relleno %';
select actuar_como('00000000-0000-0000-0000-0000000000a1');
insert into favoritos (usuario_id, publicacion_id)
values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000dea1');
select is(
  (select count(*)::int from favoritos), 200,
  'la favorita número 200 todavía pasa' );
select throws_ok(
  $$insert into favoritos (usuario_id, publicacion_id)
    values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000dea2')$$,
  'CP004', null, 'la 201 se rechaza con CP004: tope de 200 por cuenta' );

-- Cascadas: borrar la publicación o la cuenta borra los favoritos que dependían de ellas.
select actuar_como_servicio();
delete from publicaciones where id = ('00000000-0000-0000-f000-' || lpad('1', 12, '0'))::uuid;
select is(
  (select count(*)::int from favoritos
    where publicacion_id = ('00000000-0000-0000-f000-' || lpad('1', 12, '0'))::uuid), 0,
  'borrar una publicación borra los favoritos que la guardaban' );

insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        created_at, updated_at, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000d8',
        'authenticated', 'authenticated', 'd8@test.mx', '', now(), now(),
        '{"nombre_usuario":"usuario_d8","nombre_completo":"Dani Prueba"}');
insert into favoritos (usuario_id, publicacion_id)
values ('00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-00000000dea1');
delete from auth.users where id = '00000000-0000-0000-0000-0000000000d8';
select is(
  (select count(*)::int from favoritos where usuario_id = '00000000-0000-0000-0000-0000000000d8'), 0,
  'borrar la cuenta borra sus favoritos' );


-- ═══════ 134 a 141 · cuántas personas guardaron una publicación (Cuervo 360) ═══════
-- Se ve el NÚMERO y nunca quién: la función devuelve solo el id y el total. No se guarda ningún
-- contador en `publicaciones` (sería copiar un dato que se puede calcular y se desincronizaría).
-- Cuenta lo visible, o lo propio. Una publicación ajena y oculta y una que no existe dan lo mismo
-- —ninguna fila—, así que preguntar el conteo no sirve de sonda.
select actuar_como_servicio();
delete from favoritos;
insert into publicaciones (id, usuario_id, titulo, tipo, direccion, precio_renta,
                           whatsapp, latitud, longitud, permite_mascotas)
values ('00000000-0000-0000-0000-00000000dea3', '00000000-0000-0000-0000-0000000000b2',
        'Depa B3', 'depa', 'Calle Falsa 789', 3200, '5512345678', 19.29, -99.56, false);
insert into favoritos (usuario_id, publicacion_id) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000dea1'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-00000000dea1');

select actuar_como('00000000-0000-0000-0000-0000000000a1');
select is(
  (select total from favoritos_por_publicacion(array['00000000-0000-0000-0000-00000000dea1']::uuid[])),
  2,
  'cuenta las personas que guardaron una publicación visible' );

select is(
  (select proargnames from pg_proc where proname = 'favoritos_por_publicacion'),
  array['p_ids', 'publicacion_id', 'total'],
  'la función solo devuelve el id y el total: ninguna columna sobre PERSONAS' );

select is(
  (select total from favoritos_por_publicacion(array['00000000-0000-0000-0000-00000000dea3']::uuid[])),
  0,
  'una publicación visible que nadie guardó devuelve 0, no «sin fila»' );

-- Ajena y oculta, e inexistente: lo mismo.
select actuar_como_servicio();
update publicaciones set activa = false where id = '00000000-0000-0000-0000-00000000dea2';
insert into favoritos (usuario_id, publicacion_id)
values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000dea2');
select actuar_como('00000000-0000-0000-0000-0000000000a1');
select is(
  (select count(*)::int from favoritos_por_publicacion(array[
     '00000000-0000-0000-0000-00000000dea2', '00000000-0000-0000-0000-00000000ffff']::uuid[])),
  0,
  'una publicación ajena oculta y una inexistente dan lo mismo: ninguna fila' );

-- La dueña sí ve el conteo de la suya, aunque esté inactiva.
select actuar_como('00000000-0000-0000-0000-0000000000b2');
select is(
  (select total from favoritos_por_publicacion(array['00000000-0000-0000-0000-00000000dea2']::uuid[])),
  1,
  'la dueña ve el conteo de su propia publicación aunque esté inactiva' );

-- Límites.
select actuar_como('00000000-0000-0000-0000-0000000000a1');
select throws_ok(
  $$select * from favoritos_por_publicacion((select array_agg(gen_random_uuid()) from generate_series(1, 51)))$$,
  '54000', null, 'más de 50 ids en una llamada se rechaza: no sirve para barrer la base' );

select actuar_como_servicio();
select throws_ok(
  $$select * from favoritos_por_publicacion(array['00000000-0000-0000-0000-00000000dea1']::uuid[])$$,
  '28000', null, 'sin sesión no se puede preguntar' );

select is(
  has_function_privilege('anon', 'public.favoritos_por_publicacion(uuid[])', 'execute'),
  false,
  'anon no puede ejecutar el conteo' );

-- ── Consentimiento en el alta (0046) ────────────────────────────────────────
select actuar_como_servicio();
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        created_at, updated_at, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000f7',
   'authenticated', 'authenticated', 'consiente@test.mx', '', now(), now(),
   '{"nombre_usuario":"usuario_f7","acepto_aviso":true,"aviso_version":"v3"}'),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000f8',
   'authenticated', 'authenticated', 'dudoso@test.mx', '', now(), now(),
   '{"nombre_usuario":"usuario_f8","acepto_aviso":"quizá"}');

select isnt(
  (select acepto_aviso_privacidad_en from usuarios where id = '00000000-0000-0000-0000-0000000000f7'),
  null,
  'el alta con acepto_aviso=true deja la marca de consentimiento escrita por el servidor' );
select is(
  (select acepto_aviso_privacidad_en from usuarios where id = '00000000-0000-0000-0000-0000000000a1'),
  null,
  'sin el metadato no hay marca: no se inventa un consentimiento' );
select is(
  (select acepto_aviso_privacidad_en from usuarios where id = '00000000-0000-0000-0000-0000000000f8'),
  null,
  'un valor que no es true no cuenta como consentimiento, y el alta no se tumba' );

-- ── Servicios (0047) ────────────────────────────────────────────────────────
select actuar_como_servicio();
insert into categorias_servicio (id, nombre, icono, orden, activa) values
  ('comida', 'Comida', 'restaurant-outline', 1, true),
  ('retirada', 'Retirada', 'close-outline', 2, false);
insert into negocios (id, categoria_id, nombre, direccion, origen, activo, oculto_por_reportes) values
  ('00000000-0000-0000-0000-00000000b001', 'comida', 'Visible', 'Calle 1', 'sembrado', true,  false),
  ('00000000-0000-0000-0000-00000000b002', 'comida', 'Inactivo', 'Calle 2', 'sembrado', false, false),
  ('00000000-0000-0000-0000-00000000b003', 'comida', 'Oculto',   'Calle 3', 'sembrado', true,  true);
insert into negocio_items (negocio_id, nombre, precio) values
  ('00000000-0000-0000-0000-00000000b001', 'Taco', 20),
  ('00000000-0000-0000-0000-00000000b002', 'Taco del inactivo', 20),
  ('00000000-0000-0000-0000-00000000b003', 'Taco del oculto', 20);

select actuar_como('00000000-0000-0000-0000-0000000000a1');
select is(
  (select array_agg(nombre order by nombre) from negocios_publicos),
  array['Visible'],
  'la vista pública solo trae negocios activos y sin ocultar por reportes' );
select is(
  (select array_agg(nombre order by nombre) from negocio_items_publicos),
  array['Taco'],
  'los productos de un negocio inactivo u oculto tampoco se ven' );
select is(
  (select count(*)::int from information_schema.columns
    where table_name = 'negocios_publicos' and column_name = 'usuario_id'),
  0,
  'la vista pública no expone quién es el dueño' );
select is(
  (select count(*)::int from negocios), 0,
  'la tabla de negocios solo deja leer los PROPIOS (los de ejemplo no tienen dueño: se leen por la vista)' );
select throws_ok(
  $$insert into negocios (categoria_id, nombre, direccion, origen) values ('comida', 'Mio', 'Calle 9', 'sembrado')$$,
  '42501', null, 'el cliente no puede crear negocios (todavía)' );
select is(
  (select count(*)::int from negocio_items), 0,
  'la tabla de productos solo deja leer los de los negocios propios' );
select is(
  (select array_agg(id order by id) from categorias_servicio),
  array['comida'],
  'las categorías retiradas no se ven' );

select actuar_como_servicio();
select throws_ok(
  $$insert into negocios (categoria_id, nombre, direccion, origen, usuario_id)
    values ('comida', 'Con dueño falso', 'Calle 4', 'sembrado', '00000000-0000-0000-0000-0000000000a1')$$,
  '23514', null, 'un negocio de ejemplo no puede tener dueño' );
select throws_ok(
  $$insert into negocios (categoria_id, nombre, direccion, origen) values ('comida', 'Sin dueño falso', 'Calle 5', 'solicitud')$$,
  '23514', null, 'un negocio de solicitud sí exige dueño' );
select is(
  has_table_privilege('anon', 'public.negocios_publicos', 'select'),
  false,
  'anon no puede leer negocios' );
select is(
  has_table_privilege('authenticated', 'public.negocios', 'insert'),
  false,
  'authenticated no tiene insert sobre negocios' );

-- ── Fotos de negocios (0048) ────────────────────────────────────────────────
select actuar_como_servicio();
insert into storage.objects (bucket_id, name) values
  ('fotos', 'negocios/00000000-0000-0000-0000-00000000b001/0.jpg'),
  ('fotos', 'negocios/00000000-0000-0000-0000-00000000b002/0.jpg'),
  ('fotos', 'negocios/00000000-0000-0000-0000-00000000b003/0.jpg');
select actuar_como('00000000-0000-0000-0000-0000000000a1');
select is(
  (select count(*)::int from storage.objects where name = 'negocios/00000000-0000-0000-0000-00000000b001/0.jpg'),
  1,
  'storage: la foto de un negocio visible SI se lee (si no, Servicios se ve sin fotos)' );
select is(
  (select count(*)::int from storage.objects where name = 'negocios/00000000-0000-0000-0000-00000000b002/0.jpg'),
  0,
  'storage: no se lee la foto de un negocio inactivo' );
select is(
  (select count(*)::int from storage.objects where name = 'negocios/00000000-0000-0000-0000-00000000b003/0.jpg'),
  0,
  'storage: no se lee la foto de un negocio oculto por reportes' );

-- ── Verificación de vendedor (0049) ─────────────────────────────────────────
-- Vendedora: f7. Ajena: b2. Admin responsable: a1.
select actuar_como_servicio();
insert into roles_usuario (usuario_id, rol) values ('00000000-0000-0000-0000-0000000000f7', 'comerciante'), ('00000000-0000-0000-0000-0000000000f7', 'arrendador');
insert into roles_usuario (usuario_id, rol, estado, origen) values ('00000000-0000-0000-0000-0000000000a1', 'admin', 'aprobado', 'sembrado')
  on conflict (usuario_id, rol) do update set estado = 'aprobado';

select actuar_como('00000000-0000-0000-0000-0000000000f7');
select lives_ok(
  $$select enviar_verificacion('comerciante', 'Ana Prueba Ruiz', 'Calle 1, Lerma',
      '00000000-0000-0000-0000-0000000000f7/ine-frente.jpg', '00000000-0000-0000-0000-0000000000f7/ine-reverso.jpg', array['00000000-0000-0000-0000-0000000000f7/local-1.jpg'], 'v3')$$,
  'enviar: la dueña envía su verificación' );
select is(
  (select estado from roles_usuario where usuario_id = '00000000-0000-0000-0000-0000000000f7' and rol = 'comerciante'),
  'pendiente', 'enviar: la función pasa a pendiente' );
select is((select count(*)::int from verificaciones_vendedor), 1, 'la dueña lee su propia verificación');

select actuar_como('00000000-0000-0000-0000-0000000000b2');
select is((select count(*)::int from verificaciones_vendedor), 0, 'otra cuenta NO lee la verificación ajena');
select throws_ok(
  $$select enviar_verificacion('comerciante', 'Beto Prueba', 'Calle 2, Lerma',
      '00000000-0000-0000-0000-0000000000b2/a.jpg', '00000000-0000-0000-0000-0000000000b2/b.jpg', array['00000000-0000-0000-0000-0000000000b2/c.jpg'], 'v3')$$,
  'CP005', null, 'enviar: sin tener la función no hay nada que enviar' );

select actuar_como('00000000-0000-0000-0000-0000000000f7');
select throws_ok(
  $$select enviar_verificacion('comerciante', 'Ana Prueba Ruiz', 'Calle 1, Lerma',
      '00000000-0000-0000-0000-0000000000f7/a.jpg', '00000000-0000-0000-0000-0000000000f7/b.jpg', array['00000000-0000-0000-0000-0000000000f7/c.jpg'], 'v3')$$,
  'CP005', null, 'enviar: con la verificación ya pendiente no se reenvía' );
select throws_ok(
  $$select enviar_verificacion('arrendador', 'Ana Prueba Ruiz', 'Calle 1, Lerma',
      '00000000-0000-0000-0000-0000000000b2/ine-frente.jpg', '00000000-0000-0000-0000-0000000000f7/b.jpg', array['00000000-0000-0000-0000-0000000000f7/c.jpg'], 'v3')$$,
  '23514', null, 'enviar: una ruta de la carpeta de OTRA cuenta se rechaza' );
select throws_ok(
  $$select resolver_verificacion('00000000-0000-0000-0000-0000000000f7', 'comerciante', true, null, '00000000-0000-0000-0000-0000000000a1')$$,
  '42501', null, 'resolver: el cliente autenticado no puede ejecutarla' );

select actuar_como_servicio();
select throws_ok(
  $$select resolver_verificacion('00000000-0000-0000-0000-0000000000f7', 'comerciante', true, null, '00000000-0000-0000-0000-0000000000f7')$$,
  'CP007', null, 'resolver: el responsable debe ser un admin aprobado' );
select throws_ok(
  $$select resolver_verificacion('00000000-0000-0000-0000-0000000000f7', 'comerciante', false, '  ', '00000000-0000-0000-0000-0000000000a1')$$,
  'CP006', null, 'resolver: un rechazo exige motivo' );
select lives_ok(
  $$select resolver_verificacion('00000000-0000-0000-0000-0000000000f7', 'comerciante', true, null, '00000000-0000-0000-0000-0000000000a1')$$,
  'resolver: un admin aprueba' );
select is(
  (select estado from roles_usuario where usuario_id = '00000000-0000-0000-0000-0000000000f7' and rol = 'comerciante'),
  'aprobado', 'resolver: la función queda aprobada' );
select ok(
  (select ine_borrar_en between now() + interval '29 days' and now() + interval '31 days'
     from verificaciones_vendedor where usuario_id = '00000000-0000-0000-0000-0000000000f7' and rol = 'comerciante'),
  'resolver: al aprobar, la INE queda programada para borrarse a los 30 días' );
select is(
  (select revisada_por from verificaciones_vendedor where usuario_id = '00000000-0000-0000-0000-0000000000f7' and rol = 'comerciante'),
  '00000000-0000-0000-0000-0000000000a1'::uuid, 'resolver: queda escrito quién aprobó' );

select actuar_como('00000000-0000-0000-0000-0000000000f7');
select is(tiene_rol_aprobado('comerciante'), true, 'tiene_rol_aprobado: sí, tras la aprobación');
select is(tiene_rol_aprobado('arrendador'), false, 'tiene_rol_aprobado: no, sin aprobar');

select actuar_como_servicio();
select throws_ok(
  $$select resolver_verificacion('00000000-0000-0000-0000-0000000000f7', 'comerciante', true, null, '00000000-0000-0000-0000-0000000000a1')$$,
  'CP005', null, 'resolver: lo ya aprobado no se vuelve a resolver' );

-- Rechazo, motivo y reenvío.
select actuar_como('00000000-0000-0000-0000-0000000000f7');
select enviar_verificacion('arrendador', 'Ana Prueba Ruiz', 'Calle 1, Lerma',
  '00000000-0000-0000-0000-0000000000f7/ine-frente.jpg', '00000000-0000-0000-0000-0000000000f7/ine-reverso.jpg', array['00000000-0000-0000-0000-0000000000f7/casa-1.jpg'], 'v3');
select actuar_como_servicio();
select lives_ok(
  $$select resolver_verificacion('00000000-0000-0000-0000-0000000000f7', 'arrendador', false, 'La INE no se lee', '00000000-0000-0000-0000-0000000000a1')$$,
  'resolver: un admin rechaza con motivo' );
select is(
  (select estado || ':' || coalesce(v.motivo_rechazo, '')
     from roles_usuario r join verificaciones_vendedor v using (usuario_id, rol)
    where r.usuario_id = '00000000-0000-0000-0000-0000000000f7' and r.rol = 'arrendador'),
  'rechazado:La INE no se lee', 'resolver: queda rechazada y con su motivo' );
select actuar_como('00000000-0000-0000-0000-0000000000f7');
select lives_ok(
  $$select enviar_verificacion('arrendador', 'Ana Prueba Ruiz', 'Calle 1, Lerma',
      '00000000-0000-0000-0000-0000000000f7/ine-frente-2.jpg', '00000000-0000-0000-0000-0000000000f7/ine-reverso-2.jpg', array['00000000-0000-0000-0000-0000000000f7/casa-2.jpg'], 'v3')$$,
  'enviar: tras un rechazo se puede volver a enviar' );
select is(
  (select r.estado || ':' || coalesce(v.motivo_rechazo, '-')
     from roles_usuario r join verificaciones_vendedor v using (usuario_id, rol)
    where r.usuario_id = '00000000-0000-0000-0000-0000000000f7' and r.rol = 'arrendador'),
  'pendiente:-', 'enviar: el reenvío vuelve a pendiente y borra el motivo anterior' );

-- Bucket privado de evidencia.
select actuar_como_servicio();
insert into storage.objects (bucket_id, name) values ('verificacion', '00000000-0000-0000-0000-0000000000f7/ine-frente.jpg');
select actuar_como('00000000-0000-0000-0000-0000000000f7');
select is(
  (select count(*)::int from storage.objects where bucket_id = 'verificacion' and name = '00000000-0000-0000-0000-0000000000f7/ine-frente.jpg'),
  1, 'storage: la dueña lee su propia INE' );
select actuar_como('00000000-0000-0000-0000-0000000000b2');
select is(
  (select count(*)::int from storage.objects where bucket_id = 'verificacion' and name = '00000000-0000-0000-0000-0000000000f7/ine-frente.jpg'),
  0, 'storage: nadie más lee la INE de otra cuenta' );
select actuar_como_servicio();
select is(
  has_table_privilege('anon', 'public.verificaciones_vendedor', 'select'),
  false, 'anon no puede leer verificaciones' );

-- ── Barrido de la INE (0050) ────────────────────────────────────────────────
select actuar_como_servicio();
select is(
  (select count(*)::int from cron.job where jobname = 'barrer-verificaciones'),
  1, 'el borrado de la INE está programado' );
select is(
  has_function_privilege('authenticated', 'public.barrer_verificaciones_programado()', 'execute'),
  false, 'authenticated no puede ejecutar el barrido de la INE' );
select is(
  has_function_privilege('anon', 'public.barrer_verificaciones_programado()', 'execute'),
  false, 'anon no puede ejecutar el barrido de la INE' );

-- ── Solo un arrendador aprobado publica (0051) ──────────────────────────────
-- f7 tiene `arrendador` PENDIENTE (reenvió tras un rechazo más arriba); e9 es una cuenta nueva, sin la función.
select actuar_como('00000000-0000-0000-0000-0000000000f7');
select throws_ok(
  $$insert into publicaciones (usuario_id, titulo, tipo, direccion, precio_renta, whatsapp)
    values ('00000000-0000-0000-0000-0000000000f7', 'Sin aprobar', 'depa', 'Calle R1', 2500, '5512345678')$$,
  '42501', null, 'publicar: con la función pendiente la base rechaza la publicación' );
select actuar_como_servicio();
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        created_at, updated_at, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000e9', 'authenticated', 'authenticated',
        'sinfuncion@test.mx', '', now(), now(), '{"nombre_usuario":"usuario_e9"}');
select actuar_como('00000000-0000-0000-0000-0000000000e9');
select throws_ok(
  $$insert into publicaciones (usuario_id, titulo, tipo, direccion, precio_renta, whatsapp)
    values ('00000000-0000-0000-0000-0000000000e9', 'Sin función', 'depa', 'Calle R2', 2500, '5512345678')$$,
  '42501', null, 'publicar: sin la función tampoco' );

select actuar_como_servicio();
select resolver_verificacion('00000000-0000-0000-0000-0000000000f7', 'arrendador', true, null, '00000000-0000-0000-0000-0000000000a1');
-- 0084 · aprobar NO inicia la prueba (antes la creaba); la inicia la persona. f7 la inicia aquí, una por función, y desde este punto rigen los límites
-- del plan de prueba (el plan gratuito no permite ni un negocio), como cuando la aprobación la creaba.
select is(
  (select count(*)::int from suscripciones where usuario_id = '00000000-0000-0000-0000-0000000000f7' and prueba_hasta is not null), 0,
  '0084 prueba: aprobar la verificación YA NO inicia la prueba: la inicia la persona' );
select actuar_como('00000000-0000-0000-0000-0000000000f7');
select lives_ok($$select iniciar_prueba('comerciante')$$, '0084 prueba: f7 inicia la prueba de comerciante');
select lives_ok($$select iniciar_prueba('arrendador')$$, '0084 prueba: y la de arrendador');
select actuar_como_servicio();
select actuar_como('00000000-0000-0000-0000-0000000000f7');
select lives_ok(
  $$insert into publicaciones (usuario_id, titulo, tipo, direccion, precio_renta, whatsapp)
    values ('00000000-0000-0000-0000-0000000000f7', 'Ya aprobada', 'depa', 'Calle R3', 2500, '5512345678')$$,
  'publicar: aprobada la función, la base deja publicar' );
select throws_ok(
  $$insert into publicaciones (usuario_id, titulo, tipo, direccion, precio_renta, whatsapp)
    values ('00000000-0000-0000-0000-0000000000b2', 'A nombre de otra', 'depa', 'Calle R4', 2500, '5512345678')$$,
  '42501', null, 'publicar: aprobada, solo a nombre propio' );
select lives_ok(
  $$update publicaciones set titulo = 'Ya aprobada (editada)' where usuario_id = '00000000-0000-0000-0000-0000000000f7'$$,
  'la dueña sigue pudiendo editar lo suyo' );

-- ── Publicar un negocio (0052) ──────────────────────────────────────────────
-- f7: comerciante APROBADO. e9: sin la función. b2: ajena.
select actuar_como('00000000-0000-0000-0000-0000000000f7');
select lives_ok(
  $$insert into negocios (usuario_id, categoria_id, nombre, direccion)
    values ('00000000-0000-0000-0000-0000000000f7', 'comida', 'Tienda F7', 'Calle 7, Lerma')$$,
  'negocio: un comerciante aprobado crea su negocio' );
select is(
  (select origen from negocios where nombre = 'Tienda F7'), 'solicitud',
  'negocio: nace con origen solicitud (no se puede fingir «sembrado»)' );
select is(
  (select destacado from negocios where nombre = 'Tienda F7'), false,
  'negocio: nace sin destacar' );
select is(
  (select count(*)::int from negocios), 1,
  'negocio: la dueña lee el suyo desde la tabla' );

select throws_ok(
  $$insert into negocios (usuario_id, categoria_id, nombre, direccion, destacado)
    values ('00000000-0000-0000-0000-0000000000f7', 'comida', 'Quiero destacar', 'Calle 8', true)$$,
  '42501', null, 'negocio: el cliente NO puede fijar «destacado»' );
select throws_ok(
  $$insert into negocios (usuario_id, categoria_id, nombre, direccion, origen)
    values ('00000000-0000-0000-0000-0000000000f7', 'comida', 'Finjo ejemplo', 'Calle 9', 'sembrado')$$,
  '42501', null, 'negocio: el cliente NO puede fijar «origen»' );
select throws_ok(
  $$update negocios set destacado = true where nombre = 'Tienda F7'$$,
  '42501', null, 'negocio: tampoco puede destacarse editando' );
select throws_ok(
  $$update negocios set oculto_por_reportes = false where nombre = 'Tienda F7'$$,
  '42501', null, 'negocio: ni quitarse la ocultación por reportes' );
select throws_ok(
  $$update negocios set usuario_id = '00000000-0000-0000-0000-0000000000b2' where nombre = 'Tienda F7'$$,
  '42501', null, 'negocio: ni regalarlo a otra cuenta' );
select lives_ok(
  $$update negocios set descripcion = 'Tacos y más', horario = 'Lun a vie · 9 a 6' where nombre = 'Tienda F7'$$,
  'negocio: la dueña edita lo suyo' );
select throws_ok(
  $$update negocios set fotos = array['negocios/00000000-0000-0000-0000-00000000b001/0.jpg'] where nombre = 'Tienda F7'$$,
  '23514', null, 'negocio: una ruta de foto de OTRO negocio se rechaza' );
select throws_ok(
  $$insert into negocios (usuario_id, categoria_id, nombre, direccion)
    values ('00000000-0000-0000-0000-0000000000f7', 'comida', 'Segundo activo', 'Calle 10')$$,
  'CP008', null, 'negocio: un segundo negocio ACTIVO supera el tope del plan Básico' );
select lives_ok(
  $$insert into negocios (usuario_id, categoria_id, nombre, direccion, activo)
    values ('00000000-0000-0000-0000-0000000000f7', 'comida', 'Segundo inactivo', 'Calle 10', false)$$,
  'negocio: uno INACTIVO sí cabe (desactivar no sube el número)' );
select throws_ok(
  $$update negocios set activo = true where nombre = 'Segundo inactivo'$$,
  'CP008', null, 'negocio: activarlo sí lo sube, y se rechaza' );

select actuar_como('00000000-0000-0000-0000-0000000000e9');
select throws_ok(
  $$insert into negocios (usuario_id, categoria_id, nombre, direccion)
    values ('00000000-0000-0000-0000-0000000000e9', 'comida', 'Sin función', 'Calle 11')$$,
  '42501', null, 'negocio: sin la función de comerciante aprobada, la base rechaza' );

select actuar_como('00000000-0000-0000-0000-0000000000b2');
select is(
  (select count(*)::int from negocios where nombre = 'Tienda F7'), 0,
  'negocio: otra cuenta no lee el negocio ajeno desde la tabla' );
-- Intentos ajenos de editar y borrar: no fallan (RLS filtra filas en silencio), así que se comprueba que NO surtieron efecto.
update negocios set nombre = 'Robado' where nombre = 'Tienda F7';
delete from negocios where nombre = 'Tienda F7';
select actuar_como_servicio();
select is(
  (select count(*)::int from negocios where nombre = 'Tienda F7'), 1,
  'negocio: otra cuenta no editó ni borró el negocio ajeno' );
select actuar_como('00000000-0000-0000-0000-0000000000b2');
select is(
  (select count(*)::int from negocios_publicos where nombre = 'Tienda F7'), 1,
  'negocio: el activo de f7 SÍ se ve para todos por la vista pública' );

-- Menú.
select actuar_como('00000000-0000-0000-0000-0000000000f7');
select lives_ok(
  $$insert into negocio_items (negocio_id, nombre, precio)
    select id, 'Taco', 20 from negocios where nombre = 'Tienda F7'$$,
  'menú: la dueña agrega un producto' );
select actuar_como('00000000-0000-0000-0000-0000000000b2');
select throws_ok(
  $$insert into negocio_items (negocio_id, nombre, precio)
    select id, 'Intruso', 1 from negocios_publicos where nombre = 'Tienda F7'$$,
  '42501', null, 'menú: otra cuenta no agrega productos al negocio ajeno' );
select actuar_como_servicio();
select throws_ok(
  $$insert into negocio_items (negocio_id, nombre, precio)
    select n.id, 'P' || g, 1 from negocios n, generate_series(1, 80) g where n.nombre = 'Tienda F7'$$,
  'CP009', null, 'menú: pasar de los 80 productos del plan Básico se rechaza' );

-- Storage.
select actuar_como('00000000-0000-0000-0000-0000000000f7');
select lives_ok(
  $$insert into storage.objects (bucket_id, name)
    select 'fotos', 'negocios/' || id || '/0.jpg' from negocios where nombre = 'Tienda F7'$$,
  'storage: la dueña sube la foto de su negocio' );
select is(
  (select count(*)::int from storage.objects where name like 'negocios/%' and name in
     (select 'negocios/' || id || '/0.jpg' from negocios where nombre = 'Tienda F7')),
  1, 'storage: la dueña lee su foto' );
select actuar_como('00000000-0000-0000-0000-0000000000b2');
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    select 'fotos', 'negocios/' || id || '/1.jpg' from negocios_publicos where nombre = 'Tienda F7'$$,
  '42501', null, 'storage: otra cuenta no sube fotos al negocio ajeno' );
select actuar_como('00000000-0000-0000-0000-0000000000e9');
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('fotos', 'negocios/00000000-0000-0000-0000-00000000b001/9.jpg')$$,
  '42501', null, 'storage: sin ser dueña de ese negocio no se sube nada' );

select actuar_como_servicio();
select is(
  has_column_privilege('authenticated', 'public.negocios', 'destacado', 'insert'), false,
  'authenticated no tiene insert sobre la columna destacado' );
select is(
  has_column_privilege('authenticated', 'public.negocios', 'nombre', 'update'), true,
  'authenticated sí edita el nombre de lo suyo (la política acota las filas)' );

-- ── Planes, prueba gratis y pagos simulados (0053) ──────────────────────────
-- f7: comerciante y arrendador aprobados (la aprobación creó su prueba gratis). e9: sin funciones.
select actuar_como_servicio();
select ok(
  (select prueba_hasta between now() + interval '14 days' and now() + interval '16 days'
     from suscripciones where usuario_id = '00000000-0000-0000-0000-0000000000f7' and rol = 'comerciante'),
  'prueba: iniciarla da 15 días de prueba gratis' );

select actuar_como('00000000-0000-0000-0000-0000000000f7');
select is(
  (select plan_id || ':' || estado from mi_suscripcion('comerciante')),
  'comerciante_basico:prueba', 'prueba: durante la prueba rigen los límites del plan Básico' );
select is(
  (select estado from mi_suscripcion('arrendador')), 'prueba', 'prueba: el arrendador también tiene la suya' );

select actuar_como('00000000-0000-0000-0000-0000000000e9');
select is(
  (select count(*)::int from mi_suscripcion('comerciante')), 0,
  'suscripción: quien no tiene la función no tiene plan que mostrar' );

-- Con el modo demostración APAGADO (valor por defecto) el pago simulado se rechaza.
select actuar_como('00000000-0000-0000-0000-0000000000f7');
select throws_ok(
  $$select simular_pago('comerciante_destacado')$$, 'CP010', null,
  'simular_pago: con demo_mode apagado RECHAZA' );

select actuar_como_servicio();
update configuracion_app set valor = 'cualquier cosa' where clave = 'demo_mode';
select actuar_como('00000000-0000-0000-0000-0000000000f7');
select throws_ok(
  $$select simular_pago('comerciante_destacado')$$, 'CP010', null,
  'simular_pago: un valor distinto de exactamente «true» también está apagado (falla cerrado)' );

select actuar_como_servicio();
update configuracion_app set valor = 'true' where clave = 'demo_mode';

select actuar_como('00000000-0000-0000-0000-0000000000e9');
select throws_ok(
  $$select simular_pago('comerciante_destacado')$$, 'CP011', null,
  'simular_pago: sin la función aprobada no se puede pagar su plan' );
select actuar_como('00000000-0000-0000-0000-0000000000f7');
select throws_ok($$select simular_pago('comerciante_gratis')$$, 'CP011', null, 'simular_pago: un plan gratuito no se paga');
select throws_ok($$select simular_pago('no_existe')$$, 'CP011', null, 'simular_pago: un plan inexistente tampoco');

select lives_ok($$select simular_pago('comerciante_destacado')$$, 'simular_pago: con demo_mode activo y la función aprobada, paga');
select is(
  (select plan_id || ':' || estado from mi_suscripcion('comerciante')),
  'comerciante_destacado:vigente', 'pago: el plan pagado pasa a vigente' );
select ok(
  (select hasta between now() + interval '29 days' and now() + interval '31 days' from mi_suscripcion('comerciante')),
  'pago: cada pago extiende 30 días' );
select is(
  (select count(*)::int from pagos where monto_centavos = 19900 and origen = 'simulado'), 1,
  'pago: queda registrado, con su monto y su origen «simulado»' );
select is(
  (select destacado from negocios_publicos where nombre = 'Tienda F7'), true,
  'destacado: sale del plan efectivo, no de una columna que alguien fije' );
select lives_ok(
  $$update negocios set activo = true where nombre = 'Segundo inactivo'$$,
  'límite: con el plan Destacado caben 3 negocios activos (con el Básico solo 1)' );

select lives_ok($$select simular_pago('comerciante_destacado')$$, 'pago: pagar antes de vencer también se permite');
select ok(
  (select hasta between now() + interval '59 days' and now() + interval '61 days' from mi_suscripcion('comerciante')),
  'pago: pagar antes de vencer SUMA el periodo, no lo reinicia' );
select ok(
  (select count(*) = 1 from pagos a join pagos b on b.usuario_id = a.usuario_id and b.periodo_inicio = a.periodo_fin where a.monto_centavos = 19900),
  'pago: los periodos de dos pagos seguidos quedan ENCADENADOS (el inicio del segundo es el fin del primero)' );

-- ── Galería y menú a escala real (0053) ─────────────────────────────────────
-- f7 está en el plan Destacado (60 fotos, 250 productos) y su negocio visible es «Tienda F7».
select actuar_como('00000000-0000-0000-0000-0000000000f7');
select lives_ok(
  $$select guardar_menu(
      (select id from negocios where nombre = 'Tienda F7'),
      jsonb_build_array(
        jsonb_build_object('id', (select id from negocio_items where nombre = 'Taco'), 'nombre', 'Taco al pastor', 'precio', 20, 'seccion', 'Tacos'),
        jsonb_build_object('nombre', 'Agua', 'precio', 15, 'seccion', 'Bebidas', 'descripcion', 'Fresca'),
        jsonb_build_object('nombre', 'Revisión', 'precio', null)))$$,
  'menú: se guarda ENTERO en una sola llamada' );
select is(
  (select array_agg(nombre order by orden) from negocio_items
    where negocio_id = (select id from negocios where nombre = 'Tienda F7')),
  array['Taco al pastor', 'Agua', 'Revisión'], 'menú: queda en el orden pedido (el existente se actualiza, los nuevos se insertan)' );
select is(
  (select seccion || '|' || coalesce(descripcion, '-') from negocio_items where nombre = 'Agua'),
  'Bebidas|Fresca', 'menú: cada producto guarda su sección y su descripción' );
select is(
  (select precio from negocio_items where nombre = 'Revisión'), null, 'menú: un producto sin precio queda en null (consultar precio)' );

select lives_ok(
  $$select guardar_menu(
      (select id from negocios where nombre = 'Tienda F7'),
      jsonb_build_array(jsonb_build_object('id', (select id from negocio_items where nombre = 'Taco al pastor'), 'nombre', 'Taco al pastor', 'precio', 22)))$$,
  'menú: lo que ya no viene en la lista se borra' );
select is(
  (select count(*)::int from negocio_items where negocio_id = (select id from negocios where nombre = 'Tienda F7')),
  1, 'menú: quedó solo el que seguía' );

select throws_ok(
  $$select guardar_menu((select id from negocios where nombre = 'Tienda F7'), '{"no": "es lista"}'::jsonb)$$,
  '22023', null, 'menú: algo que no es una lista se rechaza' );

select throws_ok(
  $$select guardar_menu(
      (select id from negocios where nombre = 'Tienda F7'),
      (select jsonb_agg(jsonb_build_object('nombre', 'P' || g, 'precio', 1)) from generate_series(1, 251) g))$$,
  'CP009', null, 'menú: 251 productos superan el tope del plan Destacado' );
select is(
  (select count(*)::int from negocio_items where negocio_id = (select id from negocios where nombre = 'Tienda F7')),
  1, 'menú: si falla, TODO se deshace (no queda a medias)' );

select throws_ok(
  $$select guardar_menu(
      (select id from negocios where nombre = 'Tienda F7'),
      jsonb_build_array(jsonb_build_object('nombre', 'Foto ajena', 'precio', 1,
        'foto', 'negocios/00000000-0000-0000-0000-00000000b001/x.jpg')))$$,
  '23514', null, 'menú: la foto de un producto debe vivir en la carpeta de SU negocio' );
select lives_ok(
  $$select guardar_menu(
      (select id from negocios where nombre = 'Tienda F7'),
      jsonb_build_array(jsonb_build_object('id', (select id from negocio_items where nombre = 'Taco al pastor'), 'nombre', 'Taco al pastor', 'precio', 22,
        'foto', 'negocios/' || (select id from negocios where nombre = 'Tienda F7') || '/p/taco.jpg')))$$,
  'menú: una foto propia sí' );

-- ════════════════ 0085 · varias fotos por producto ════════════════
-- Un producto lleva hasta 5 fotos (`fotos`); `foto` sigue existiendo como la PORTADA (la primera) para lo que ya la leía. Las dos columnas se mantienen
-- sincronizadas en la base, no en la app: quien escriba solo `foto` (una app vieja) también deja `fotos` coherente.
select lives_ok(
  $$select guardar_menu(
      (select id from negocios where nombre = 'Tienda F7'),
      jsonb_build_array(jsonb_build_object('id', (select id from negocio_items where nombre = 'Taco al pastor'), 'nombre', 'Taco al pastor', 'precio', 22,
        'fotos', jsonb_build_array(
          'negocios/' || (select id from negocios where nombre = 'Tienda F7') || '/p/a.jpg',
          'negocios/' || (select id from negocios where nombre = 'Tienda F7') || '/p/b.jpg'))))$$,
  '0085: un producto guarda varias fotos' );
select is(
  (select cardinality(fotos) from negocio_items where nombre = 'Taco al pastor'), 2, '0085: quedan las dos, en orden' );
select is(
  (select foto = fotos[1] from negocio_items where nombre = 'Taco al pastor'), true, '0085: la portada (`foto`) es siempre la primera de `fotos`' );
select is(
  (select cardinality(fotos) from negocio_items_publicos where nombre = 'Taco al pastor'), 2, '0085: la vista pública también las expone' );
select throws_ok(
  $$select guardar_menu(
      (select id from negocios where nombre = 'Tienda F7'),
      jsonb_build_array(jsonb_build_object('nombre', 'Con foto ajena', 'precio', 1,
        'fotos', jsonb_build_array('negocios/00000000-0000-0000-0000-00000000b001/x.jpg'))))$$,
  '23514', null, '0085: TODAS las fotos deben vivir en la carpeta del negocio, no solo la primera' );
select throws_ok(
  $$select guardar_menu(
      (select id from negocios where nombre = 'Tienda F7'),
      jsonb_build_array(jsonb_build_object('nombre', 'Con seis fotos', 'precio', 1,
        'fotos', (select jsonb_agg('negocios/' || (select id from negocios where nombre = 'Tienda F7') || '/p/' || g || '.jpg') from generate_series(1, 6) g))))$$,
  '23514', null, '0085: la sexta foto de un producto se rechaza (tope de 5)' );
select lives_ok(
  $$select guardar_menu(
      (select id from negocios where nombre = 'Tienda F7'),
      jsonb_build_array(jsonb_build_object('id', (select id from negocio_items where nombre = 'Taco al pastor'), 'nombre', 'Taco al pastor', 'precio', 22,
        'foto', 'negocios/' || (select id from negocios where nombre = 'Tienda F7') || '/p/vieja.jpg')))$$,
  '0085: quien manda solo `foto` (como la app anterior) sigue pudiendo guardar' );
select is(
  (select fotos from negocio_items where nombre = 'Taco al pastor'),
  array['negocios/' || (select id from negocios where nombre = 'Tienda F7') || '/p/vieja.jpg'], '0085: y `fotos` queda coherente con esa portada' );
select lives_ok(
  $$select guardar_menu(
      (select id from negocios where nombre = 'Tienda F7'),
      jsonb_build_array(jsonb_build_object('id', (select id from negocio_items where nombre = 'Taco al pastor'), 'nombre', 'Taco al pastor', 'precio', 22, 'fotos', '[]'::jsonb)))$$,
  '0085: quitar todas las fotos se puede' );
select is(
  (select foto is null and cardinality(fotos) = 0 from negocio_items where nombre = 'Taco al pastor'), true, '0085: sin fotos, tampoco hay portada' );

-- ════════════════ 0086 · producto estrella ════════════════
-- El vendedor marca hasta 6 productos como «estrella»: salen primero, en el carrusel de su tienda. Es una elección suya; NO viene del plan (el «Destacado» del
-- plan es otra cosa: pone el NEGOCIO primero en las listas) ni de ventas (la app no las mide).
select lives_ok(
  $$select guardar_menu(
      (select id from negocios where nombre = 'Tienda F7'),
      jsonb_build_array(
        jsonb_build_object('id', (select id from negocio_items where nombre = 'Taco al pastor'), 'nombre', 'Taco al pastor', 'precio', 22, 'estrella', true),
        jsonb_build_object('nombre', 'Agua fresca', 'precio', 15),
        jsonb_build_object('nombre', 'Gringa', 'precio', 40, 'estrella', true)))$$,
  '0086: el menú guarda qué productos son estrella' );
select is(
  (select array_agg(nombre order by orden) from negocio_items where estrella and negocio_id = (select id from negocios where nombre = 'Tienda F7')),
  array['Taco al pastor', 'Gringa'], '0086: quedan marcados los que se pidieron' );
select is(
  (select estrella from negocio_items where nombre = 'Agua fresca'), false, '0086: lo que no se marca NO es estrella (por omisión, no)' );
select is(
  (select count(*)::int from negocio_items_publicos where estrella), 2, '0086: la vista pública también dice cuáles son' );
select throws_ok(
  $$select guardar_menu(
      (select id from negocios where nombre = 'Tienda F7'),
      (select jsonb_agg(jsonb_build_object('nombre', 'P' || g, 'precio', 1, 'estrella', true)) from generate_series(1, 7) g))$$,
  '23514', null, '0086: más de 6 productos estrella se rechaza' );
select is(
  (select count(*)::int from negocio_items where estrella and negocio_id = (select id from negocios where nombre = 'Tienda F7')), 2,
  '0086: y si se rechaza, el menú queda como estaba' );


select lives_ok(
  $$update negocios set fotos = array(
      select 'negocios/' || id || '/' || g || '.jpg' from generate_series(1, 60) g) where nombre = 'Tienda F7'$$,
  'galería: con el plan Destacado caben 60 fotos' );
select throws_ok(
  $$update negocios set fotos = array(
      select 'negocios/' || id || '/' || g || '.jpg' from generate_series(1, 61) g) where nombre = 'Tienda F7'$$,
  'CP012', null, 'galería: la 61 se rechaza' );

select actuar_como('00000000-0000-0000-0000-0000000000b2');
select throws_ok(
  $$select guardar_menu(
      (select id from negocios_publicos where nombre = 'Tienda F7'),
      jsonb_build_array(jsonb_build_object('nombre', 'Intruso', 'precio', 1)))$$,
  '42501', null, 'menú: otra cuenta no puede escribir en el menú ajeno' );
select is(
  (select seccion from negocio_items_publicos where nombre = 'Taco al pastor'),
  null, 'vista pública: el producto trae sus columnas nuevas (sin sección en este caso)' );

select actuar_como('00000000-0000-0000-0000-0000000000b2');
select is((select count(*)::int from pagos), 0, 'pagos: otra cuenta no lee los pagos ajenos');
select throws_ok(
  $$insert into pagos (usuario_id, rol, plan_id, monto_centavos, origen, periodo_inicio, periodo_fin)
    values ('00000000-0000-0000-0000-0000000000b2', 'comerciante', 'comerciante_destacado', 0, 'simulado', now(), now() + interval '1 day')$$,
  '42501', null, 'pagos: el cliente no escribe pagos' );
select throws_ok(
  $$update suscripciones set plan_id = 'comerciante_destacado' where usuario_id = '00000000-0000-0000-0000-0000000000b2'$$,
  '42501', null, 'suscripciones: el cliente no se cambia el plan' );
select throws_ok($$select * from configuracion_app$$, '42501', null, 'configuración: el cliente no la lee');

-- Vencimiento: se baja al plan gratuito y lo que excede se OCULTA, no se borra.
select actuar_como_servicio();
update suscripciones set vigente_hasta = now() - interval '1 day', prueba_hasta = now() - interval '1 day'
 where usuario_id = '00000000-0000-0000-0000-0000000000f7' and rol = 'comerciante';
select actuar_como('00000000-0000-0000-0000-0000000000f7');
select is(
  (select plan_id || ':' || estado from mi_suscripcion('comerciante')),
  'comerciante_gratis:gratis', 'vencimiento: sin pago ni prueba vuelve al plan gratuito' );
select actuar_como('00000000-0000-0000-0000-0000000000b2');
select is(
  (select count(*)::int from negocios_publicos where nombre in ('Tienda F7', 'Segundo inactivo')), 0,
  'vencimiento: los negocios de quien no paga dejan de verse' );
select actuar_como('00000000-0000-0000-0000-0000000000f7');
select ok(
  (select count(*)::int from negocios where nombre in ('Tienda F7', 'Segundo inactivo')) = 2,
  'vencimiento: pero NO se borran: su dueño los sigue teniendo' );
select throws_ok(
  $$update negocios set fotos = array[
      'negocios/' || (select id from negocios where nombre = 'Tienda F7') || '/a.jpg',
      'negocios/' || (select id from negocios where nombre = 'Tienda F7') || '/b.jpg',
      'negocios/' || (select id from negocios where nombre = 'Tienda F7') || '/c.jpg',
      'negocios/' || (select id from negocios where nombre = 'Tienda F7') || '/d.jpg',
      'negocios/' || (select id from negocios where nombre = 'Tienda F7') || '/e.jpg'
    ] where nombre = 'Tienda F7'$$,
  'CP012', null, 'fotos: más de las 4 que permite el plan gratuito se rechaza' );

-- Al volver a pagar reaparecen.
select simular_pago('comerciante_basico');
select actuar_como('00000000-0000-0000-0000-0000000000b2');
select is(
  (select count(*)::int from negocios_publicos where nombre in ('Tienda F7', 'Segundo inactivo')), 1,
  'pago: al volver a pagar reaparece lo que cabe en el plan (Básico: 1 negocio)' );

-- Con demo_mode apagado otra vez, rechaza.
select actuar_como_servicio();
update configuracion_app set valor = 'false' where clave = 'demo_mode';
select actuar_como('00000000-0000-0000-0000-0000000000f7');
select throws_ok($$select simular_pago('comerciante_destacado')$$, 'CP010', null, 'simular_pago: apagado de nuevo, rechaza otra vez');

select actuar_como_servicio();
select is(has_table_privilege('anon', 'public.planes', 'select'), false, 'anon no lee los planes');
select throws_ok(
  $$insert into planes (id, rol, nombre, precio_centavos, limite_principal, max_fotos) values ('otro_gratis', 'comerciante', 'Otro', 0, 1, 1)$$,
  '23505', null, 'planes: no puede haber dos planes gratuitos para la misma función' );
select is(
  (select count(*)::int from planes), 5, 'planes: el catálogo trae los cinco planes propuestos' );

-- ── Reseñas (0054) ──────────────────────────────────────────────────────────
-- Objetivo: «Tienda F7» (de f7, visible) y la publicación «Mia» (de a1). Autoras: b2 y a1. Reporteras: e9, d5, f8.
-- f7 está en plan vigente o con prueba (su negocio es visible) al llegar aquí? Se asegura un periodo vigente.
select actuar_como_servicio();
update suscripciones set vigente_hasta = now() + interval '30 days', plan_id = 'comerciante_destacado'
 where usuario_id = '00000000-0000-0000-0000-0000000000f7' and rol = 'comerciante';

select actuar_como('00000000-0000-0000-0000-0000000000b2');
select lives_ok(
  $$insert into resenas (usuario_id, negocio_id, estrellas, texto)
    select '00000000-0000-0000-0000-0000000000b2', id, 5, 'Muy buenos tacos' from negocios_publicos where nombre = 'Tienda F7'$$,
  'reseña: un estudiante reseña un negocio visible' );
select throws_ok(
  $$insert into resenas (usuario_id, negocio_id, estrellas)
    select '00000000-0000-0000-0000-0000000000b2', id, 4 from negocios_publicos where nombre = 'Tienda F7'$$,
  '23505', null, 'reseña: una sola por persona y negocio' );
select throws_ok(
  $$insert into resenas (usuario_id, negocio_id, estrellas)
    select '00000000-0000-0000-0000-0000000000b2', id, 6 from negocios_publicos where nombre = 'Visible'$$,
  '23514', null, 'reseña: las estrellas van de 1 a 5' );
select throws_ok(
  $$insert into resenas (usuario_id, negocio_id, publicacion_id, estrellas)
    values ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-00000000aa01', 3)$$,
  '23514', null, 'reseña: o un negocio o una vivienda, no las dos' );
select throws_ok(
  $$insert into resenas (usuario_id, negocio_id, estrellas)
    values ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-00000000b003', 3)$$,
  '42501', null, 'reseña: un negocio oculto da el MISMO error que uno inexistente (no sirve de sonda)' );
select throws_ok(
  $$insert into resenas (usuario_id, negocio_id, estrellas)
    values ('00000000-0000-0000-0000-0000000000b2', gen_random_uuid(), 3)$$,
  '42501', null, 'reseña: un negocio que no existe, también' );
select throws_ok(
  $$insert into resenas (usuario_id, negocio_id, estrellas)
    select '00000000-0000-0000-0000-0000000000a1', id, 3 from negocios_publicos where nombre = 'Visible'$$,
  '42501', null, 'reseña: no se puede reseñar a nombre de otra persona' );
select throws_ok(
  $$insert into resenas (usuario_id, negocio_id, estrellas, oculta_por_reportes)
    select '00000000-0000-0000-0000-0000000000b2', id, 3, false from negocios_publicos where nombre = 'Visible'$$,
  '42501', null, 'reseña: el cliente no puede fijar la ocultación por reportes' );
select throws_ok(
  $$insert into resenas (usuario_id, negocio_id, estrellas, respuesta)
    select '00000000-0000-0000-0000-0000000000b2', id, 3, 'me respondo a mí' from negocios_publicos where nombre = 'Visible'$$,
  '42501', null, 'reseña: el cliente no puede escribir la respuesta' );

select actuar_como('00000000-0000-0000-0000-0000000000f7');
select throws_ok(
  $$insert into resenas (usuario_id, negocio_id, estrellas)
    select '00000000-0000-0000-0000-0000000000f7', id, 5 from negocios_publicos where nombre = 'Tienda F7'$$,
  '42501', null, 'reseña: el dueño no puede reseñar su propio negocio' );

-- La calificación se calcula.
select actuar_como('00000000-0000-0000-0000-0000000000a1');
select is(
  (select calificacion || ':' || num_resenas from negocios_publicos where nombre = 'Tienda F7'),
  '5.0:1', 'calificación: se calcula sobre las reseñas visibles' );
select lives_ok(
  $$insert into resenas (usuario_id, negocio_id, estrellas)
    select '00000000-0000-0000-0000-0000000000a1', id, 4 from negocios_publicos where nombre = 'Tienda F7'$$,
  'reseña: una segunda persona también puede' );
select is(
  (select calificacion || ':' || num_resenas from negocios_publicos where nombre = 'Tienda F7'),
  '4.5:2', 'calificación: el promedio de las dos' );
select is(
  (select calificacion from negocios_publicos where nombre = 'Visible'), null,
  'calificación: sin reseñas es null, no un cero inventado' );

-- Lectura.
select is(
  (select autor || ':' || es_mia::text from resenas_publicas where texto = 'Muy buenos tacos'),
  'usuario_b:false', 'vista: trae el nombre de usuario de la autora y marca que no es mía' );
select actuar_como('00000000-0000-0000-0000-0000000000b2');
select is(
  (select es_mia from resenas_publicas where texto = 'Muy buenos tacos'), true,
  'vista: la autora ve que la reseña es suya' );
select is(
  (select count(*)::int from resenas), 1, 'tabla: cada cuenta lee solo sus propias reseñas' );

-- Editar lo propio.
select lives_ok(
  $$update resenas set estrellas = 5, texto = 'Excelentes tacos' where texto = 'Muy buenos tacos'$$,
  'reseña: la autora edita la suya' );
select throws_ok(
  $$update resenas set respuesta = 'x' where texto = 'Excelentes tacos'$$,
  '42501', null, 'reseña: la autora no puede escribir la respuesta' );
select throws_ok(
  $$update resenas set oculta_por_reportes = true where texto = 'Excelentes tacos'$$,
  '42501', null, 'reseña: ni ocultarse a sí misma' );

-- Responder.
select actuar_como('00000000-0000-0000-0000-0000000000a1');
select throws_ok(
  $$select responder_resena((select id from resenas_publicas where texto = 'Excelentes tacos'), 'Gracias')$$,
  '42501', null, 'responder: quien no es dueño del negocio no puede' );
select actuar_como('00000000-0000-0000-0000-0000000000f7');
select lives_ok(
  $$select responder_resena((select id from resenas_publicas where texto = 'Excelentes tacos'), '  Gracias por venir  ')$$,
  'responder: el dueño responde' );
select is(
  (select respuesta from resenas_publicas where texto = 'Excelentes tacos'), 'Gracias por venir',
  'responder: la respuesta se ve en la reseña, sin espacios sobrantes' );
select is((select count(*)::int from resenas), 0, 'tabla: el dueño NO lee las reseñas ajenas desde la tabla');
select lives_ok(
  $$delete from resenas where texto = 'Excelentes tacos'$$, 'borrar: el dueño intenta borrar una reseña ajena (RLS lo filtra, sin error)' );
select actuar_como_servicio();
select is(
  (select count(*)::int from resenas where texto = 'Excelentes tacos'), 1, 'borrar: pero la reseña sigue ahí: el dueño responde, no borra' );

-- Reportar.
select actuar_como('00000000-0000-0000-0000-0000000000b2');
select throws_ok(
  $$select reportar_resena((select id from resenas_publicas where texto = 'Excelentes tacos'), 'spam')$$,
  '42501', null, 'reportar: nadie reporta su propia reseña' );
select actuar_como('00000000-0000-0000-0000-0000000000e9');
select throws_ok(
  $$select reportar_resena(gen_random_uuid(), 'spam')$$, '42501', null, 'reportar: una reseña que no existe da el mismo error' );
select lives_ok(
  $$select reportar_resena((select id from resenas_publicas where texto = 'Excelentes tacos'), 'lenguaje ofensivo')$$,
  'reportar: se puede reportar una reseña ajena' );
select lives_ok(
  $$select reportar_resena((select id from resenas_publicas where texto = 'Excelentes tacos'), 'otra vez')$$,
  'reportar: reportar dos veces no es un error' );
select actuar_como('00000000-0000-0000-0000-0000000000d5');
select lives_ok($$select reportar_resena((select id from resenas_publicas where texto = 'Excelentes tacos'), 'spam')$$, 'reportar: segunda persona');
select is(
  (select count(*)::int from resenas_publicas where texto = 'Excelentes tacos'), 1,
  'reportar: con dos reportes (y uno repetido) sigue visible: la misma persona no cuenta dos veces' );
select actuar_como('00000000-0000-0000-0000-0000000000f8');
select lives_ok($$select reportar_resena((select id from resenas_publicas where texto = 'Excelentes tacos'), 'spam')$$, 'reportar: tercera persona');
select is(
  (select count(*)::int from resenas_publicas where texto = 'Excelentes tacos'), 0,
  'reportar: tres personas distintas la ocultan' );
select actuar_como('00000000-0000-0000-0000-0000000000a1');
select is(
  (select calificacion || ':' || num_resenas from negocios_publicos where nombre = 'Tienda F7'),
  '4.0:1', 'calificación: una reseña oculta deja de contar en el promedio' );

-- Viviendas. Una publicación visible de f8.
select actuar_como_servicio();
insert into publicaciones (id, usuario_id, titulo, tipo, direccion, precio_renta, whatsapp)
values ('00000000-0000-0000-0000-00000000aa77', '00000000-0000-0000-0000-0000000000f8', 'Reseñable', 'cuarto', 'Calle R9', 2100, '5512345678');
select actuar_como('00000000-0000-0000-0000-0000000000b2');
select lives_ok(
  $$insert into resenas (usuario_id, publicacion_id, estrellas, texto)
    values ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-00000000aa77', 3, 'Cuarto correcto')$$,
  'reseña: también se reseñan las viviendas' );
select is(
  (select calificacion || ':' || num_resenas from calificacion_publicaciones where publicacion_id = '00000000-0000-0000-0000-00000000aa77'),
  '3.0:1', 'calificación de una vivienda: se calcula aparte' );
select actuar_como('00000000-0000-0000-0000-0000000000f8');
select throws_ok(
  $$insert into resenas (usuario_id, publicacion_id, estrellas)
    values ('00000000-0000-0000-0000-0000000000f8', '00000000-0000-0000-0000-00000000aa77', 5)$$,
  '42501', null, 'reseña: el dueño de una vivienda no puede reseñarla' );

select actuar_como_servicio();
select is(has_table_privilege('anon', 'public.resenas_publicas', 'select'), false, 'anon no lee las reseñas');
select is(has_table_privilege('authenticated', 'public.resenas_reportes', 'select'), false, 'los reportes de reseñas no los lee el cliente');

-- ── Ranking de Servicios (0055) ─────────────────────────────────────────────
-- a1 tiene su universidad en (19.28, -99.55). Negocios de ejemplo con coordenadas controladas; todos «viejos» (100 días) para que
-- la novedad no interfiera, salvo en la prueba de novedad.
select actuar_como_servicio();
insert into categorias_servicio (id, nombre, icono, orden) values ('cafes', 'Cafés', 'cafe-outline', 3) on conflict do nothing;
insert into negocios (categoria_id, nombre, direccion, latitud, longitud, origen, creado_en, destacado) values
  ('comida', 'R-cerca', 'Calle X', 19.281, -99.551, 'sembrado', now() - interval '100 days', false),
  ('comida', 'R-media', 'Calle X', 19.300, -99.550, 'sembrado', now() - interval '100 days', false),
  ('comida', 'R-lejos', 'Calle X', 19.400, -99.550, 'sembrado', now() - interval '100 days', false),
  ('comida', 'Q-alto',  'Calle X', 19.281, -99.551, 'sembrado', now() - interval '100 days', false),
  ('comida', 'Q-sin',   'Calle X', 19.281, -99.551, 'sembrado', now() - interval '100 days', false),
  ('comida', 'Q-bajo',  'Calle X', 19.281, -99.551, 'sembrado', now() - interval '100 days', false),
  ('cafes',  'T-cerca', 'Calle X', 19.281, -99.551, 'sembrado', now() - interval '100 days', false),
  ('cafes',  'T-lejos-dest', 'Calle X', 19.400, -99.550, 'sembrado', now() - interval '100 days', true),
  ('comida', 'N-nuevo', 'Calle X', 19.281, -99.551, 'sembrado', now(), false),
  ('comida', 'N-viejo', 'Calle X', 19.281, -99.551, 'sembrado', now() - interval '100 days', false),
  ('comida', 'P-100%', 'Calle X', 19.281, -99.551, 'sembrado', now() - interval '100 days', false);
-- Cinco reseñas de personas distintas: 5 estrellas para Q-alto, 2 para Q-bajo, ninguna para Q-sin.
insert into resenas (usuario_id, negocio_id, estrellas)
select u, n.id, case n.nombre when 'Q-alto' then 5 else 2 end
  from unnest(array['00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000c3',
                    '00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000e9']::uuid[]) u,
       negocios n
 where n.nombre in ('Q-alto', 'Q-bajo');

select actuar_como('00000000-0000-0000-0000-0000000000a1');
select is(
  (select array_agg(nombre order by puntaje desc, nombre) from negocios_ordenados(null, 'R-')),
  array['R-cerca', 'R-media', 'R-lejos'], 'ranking: a igualdad de todo lo demás, lo más CERCA va primero' );
select is(
  (select array_agg(nombre) from negocios_ordenados(null, 'R-')),
  array['R-cerca', 'R-media', 'R-lejos'], 'ranking: la función ya devuelve ese orden' );
select ok(
  (select abs(distancia_km - 0.15) < 0.1 from negocios_ordenados(null, 'R-cerca')),
  'ranking: devuelve la distancia en km desde TU universidad' );

select is(
  (select array_agg(nombre) from negocios_ordenados(null, 'Q-')),
  array['Q-alto', 'Q-sin', 'Q-bajo'],
  'ranking: bien calificado > sin reseñas > mal calificado (calificación bayesiana con prior)' );

select is(
  (select array_agg(nombre) from negocios_ordenados('cafes', null)),
  array['T-lejos-dest', 'T-cerca'], 'ranking: un DESTACADO va primero aunque esté más lejos (es el nivel del plan)' );

select is(
  (select array_agg(nombre) from negocios_ordenados(null, 'N-')),
  array['N-nuevo', 'N-viejo'], 'ranking: a igualdad, el negocio NUEVO gana (arranque en frío)' );

-- Filtros en el servidor.
select is(
  (select count(*)::int from negocios_ordenados('cafes', null)), 2, 'filtro: la categoría se aplica en el servidor' );
select is(
  (select count(*)::int from negocios_ordenados(null, '%')), 1,
  'filtro: «%» no es «todo»: los comodines de LIKE se escapan' );
select is(
  (select count(*)::int from negocios_ordenados(null, '   ')), (select count(*)::int from negocios_ordenados(null, null)),
  'filtro: un texto en blanco no filtra' );
select is(
  (select count(*)::int from negocios_ordenados(null, null, 2)), 2, 'límite: se respeta el que se pide' );
select ok(
  (select count(*)::int from negocios_ordenados(null, null, 100000)) <= 100, 'límite: se acota a 100 por llamada' );
select is(
  (select count(*)::int from negocios_ordenados(null, 'Inactivo') where id = '00000000-0000-0000-0000-00000000b002'), 0,
  'visibilidad: un negocio inactivo no entra al ranking' );
select ok(
  (select bool_and(puntaje between 0 and 1) from negocios_ordenados(null, null)), 'puntaje: siempre está entre 0 y 1' );

-- Sin dato de ubicación: neutro, no un error.
select actuar_como('00000000-0000-0000-0000-0000000000e9');
select ok(
  (select bool_and(distancia_km is null) from negocios_ordenados(null, 'R-')),
  'sin universidad registrada la distancia es null (no se inventa)' );
select is(
  (select array_agg(nombre) from negocios_ordenados(null, 'Q-')),
  array['Q-alto', 'Q-sin', 'Q-bajo'], 'sin ubicación, la calidad sigue ordenando' );

-- Sin sesión no devuelve nada.
select actuar_como_servicio();
select is((select count(*)::int from negocios_ordenados(null, null)), 0, 'sin sesión no devuelve nada');

-- ── Verificación de rostro (0056) ───────────────────────────────────────────
-- e9 recibe la función de comerciante y la envía; queda pendiente. b2 es ajena.
select actuar_como_servicio();
insert into roles_usuario (usuario_id, rol) values ('00000000-0000-0000-0000-0000000000e9', 'comerciante');
select actuar_como('00000000-0000-0000-0000-0000000000e9');
select enviar_verificacion('comerciante', 'Eva Prueba Soto', 'Calle 9, Lerma',
  '00000000-0000-0000-0000-0000000000e9/ine-frente.jpg', '00000000-0000-0000-0000-0000000000e9/ine-reverso.jpg', array['00000000-0000-0000-0000-0000000000e9/local-1.jpg'], 'v3');
select throws_ok(
  $$select reservar_intento_biometria('00000000-0000-0000-0000-0000000000e9', 'comerciante', 'v3')$$,
  '42501', null, 'biometría: el cliente autenticado no puede reservar intentos (los reserva el servicio)' );
select throws_ok(
  $$select registrar_resultado_biometria('00000000-0000-0000-0000-0000000000e9', 'comerciante', 'coincide', 0.9, 0.99, 'buffalo_l')$$,
  '42501', null, 'biometría: ni escribir un resultado propio (sería aprobarse a sí misma)' );
select throws_ok(
  $$select count(*) from verificaciones_biometria$$,
  '42501', null, 'biometría: la persona NO lee la tabla (las cifras serían un oráculo para afinar un ataque)' );

select actuar_como_servicio();
select throws_ok(
  $$select reservar_intento_biometria('00000000-0000-0000-0000-0000000000e9', 'comerciante', '  ')$$,
  '22023', null, 'biometría: sin versión del aviso no hay consentimiento y no se reserva' );
select throws_ok(
  $$select reservar_intento_biometria('00000000-0000-0000-0000-0000000000b2', 'comerciante', 'v3')$$,
  'CP005', null, 'biometría: sin verificación pendiente no hay nada que comparar' );
select is(reservar_intento_biometria('00000000-0000-0000-0000-0000000000e9', 'comerciante', 'v3'), 1::smallint,
  'biometría: el primer intento cuenta 1' );
select is(
  (select estado || ':' || version_aviso from verificaciones_biometria where usuario_id = '00000000-0000-0000-0000-0000000000e9'),
  'pendiente_de_foto:v3', 'biometría: queda el consentimiento con su versión y sin resultado todavía' );
select lives_ok(
  $$select registrar_resultado_biometria('00000000-0000-0000-0000-0000000000e9', 'comerciante', 'no_vivo', 0.61, 0.12, 'buffalo_l')$$,
  'biometría: el servicio registra el resultado' );
select is(
  (select estado || ':' || identidad::text || ':' || vivo::text from verificaciones_biometria where usuario_id = '00000000-0000-0000-0000-0000000000e9'),
  'no_vivo:0.61:0.12', 'biometría: estado y cifras quedan guardados' );
select throws_ok(
  $$select registrar_resultado_biometria('00000000-0000-0000-0000-0000000000e9', 'comerciante', 'aprobado', 1, 1, 'x')$$,
  '23514', null, 'biometría: un estado inventado se rechaza' );
select throws_ok(
  $$select registrar_resultado_biometria('00000000-0000-0000-0000-0000000000e9', 'comerciante', 'coincide', 2, 1, 'x')$$,
  '23514', null, 'biometría: una similitud fuera de [-1, 1] se rechaza' );
select throws_ok(
  $$select registrar_resultado_biometria('00000000-0000-0000-0000-0000000000b2', 'comerciante', 'coincide', 0.5, 0.95, 'x')$$,
  'CP005', null, 'biometría: no se registra un resultado sin intento reservado' );

select reservar_intento_biometria('00000000-0000-0000-0000-0000000000e9', 'comerciante', 'v3');
select reservar_intento_biometria('00000000-0000-0000-0000-0000000000e9', 'comerciante', 'v3');
select reservar_intento_biometria('00000000-0000-0000-0000-0000000000e9', 'comerciante', 'v3');
select reservar_intento_biometria('00000000-0000-0000-0000-0000000000e9', 'comerciante', 'v3');
select throws_ok(
  $$select reservar_intento_biometria('00000000-0000-0000-0000-0000000000e9', 'comerciante', 'v3')$$,
  'CP013', null, 'biometría: el sexto intento se rechaza (tope de 5 por envío)' );
select is(
  (select consentimiento_en = (select consentimiento_en from verificaciones_biometria where usuario_id = '00000000-0000-0000-0000-0000000000e9')
     from verificaciones_biometria where usuario_id = '00000000-0000-0000-0000-0000000000e9'),
  true, 'biometría: reintentar no reescribe el consentimiento original' );

-- Reenviar la verificación descarta el resultado anterior y reinicia los intentos.
update roles_usuario set estado = 'rechazado' where usuario_id = '00000000-0000-0000-0000-0000000000e9' and rol = 'comerciante';
select actuar_como('00000000-0000-0000-0000-0000000000e9');
select enviar_verificacion('comerciante', 'Eva Prueba Soto', 'Calle 9, Lerma',
  '00000000-0000-0000-0000-0000000000e9/ine-frente-2.jpg', '00000000-0000-0000-0000-0000000000e9/ine-reverso-2.jpg', array['00000000-0000-0000-0000-0000000000e9/local-2.jpg'], 'v3');
select actuar_como_servicio();
select is((select count(*)::int from verificaciones_biometria where usuario_id = '00000000-0000-0000-0000-0000000000e9'), 0,
  'biometría: reenviar la verificación descarta el resultado de la evidencia anterior' );
select is(reservar_intento_biometria('00000000-0000-0000-0000-0000000000e9', 'comerciante', 'v3'), 1::smallint,
  'biometría: tras reenviar, los intentos empiezan de nuevo' );
select is(
  (select count(*)::int from pg_trigger where tgname = 'verif_reinicia_biometria'), 1, 'el trigger que reinicia la biometría existe' );
select is(
  has_function_privilege('authenticated', 'public.reiniciar_biometria()', 'execute'), false,
  'authenticated no puede ejecutar la función del trigger' );

-- ── Borrado de la INE rechazada y intento devuelto (0057) ───────────────────
-- e9 tiene la verificación de comerciante PENDIENTE y 1 intento biométrico reservado (bloque de la 0056).
select actuar_como('00000000-0000-0000-0000-0000000000e9');
select throws_ok(
  $$select devolver_intento_biometria('00000000-0000-0000-0000-0000000000e9', 'comerciante')$$,
  '42501', null, 'devolver intento: el cliente autenticado no puede (devolverse intentos sería saltarse el tope)' );
select actuar_como_servicio();
select is(devolver_intento_biometria('00000000-0000-0000-0000-0000000000e9', 'comerciante'), 0::smallint,
  'devolver intento: el servicio lo restituye' );
select is(devolver_intento_biometria('00000000-0000-0000-0000-0000000000e9', 'comerciante'), 0::smallint,
  'devolver intento: nunca baja de cero' );
select resolver_verificacion('00000000-0000-0000-0000-0000000000e9', 'comerciante', false, 'La INE no se lee', '00000000-0000-0000-0000-0000000000a1');
select ok(
  (select ine_borrar_en between now() + interval '6 days 23 hours' and now() + interval '7 days 1 hour'
     from verificaciones_vendedor where usuario_id = '00000000-0000-0000-0000-0000000000e9' and rol = 'comerciante'),
  'rechazar: la INE queda programada para borrarse a los 7 días' );
select is(
  (select ine_borrada_en from verificaciones_vendedor where usuario_id = '00000000-0000-0000-0000-0000000000e9' and rol = 'comerciante'),
  null, 'rechazar: no se marca como borrada todavía (la borra el barrido, no esta función)' );
select actuar_como('00000000-0000-0000-0000-0000000000e9');
select enviar_verificacion('comerciante', 'Eva Prueba Soto', 'Calle 9, Lerma',
  '00000000-0000-0000-0000-0000000000e9/ine-frente-3.jpg', '00000000-0000-0000-0000-0000000000e9/ine-reverso-3.jpg', array['00000000-0000-0000-0000-0000000000e9/local-3.jpg'], 'v3');
select actuar_como_servicio();
select is(
  (select ine_borrar_en from verificaciones_vendedor where usuario_id = '00000000-0000-0000-0000-0000000000e9' and rol = 'comerciante'),
  null, 'reenviar tras un rechazo: la entrega nueva no hereda la fecha de borrado de la anterior' );

-- ── INE huérfanas (0058) ────────────────────────────────────────────────────
-- La verificación de e9 pasa a apuntar a rutas con el MISMO formato que sube la app: <usuario>/<rol>/ine-…jpg.
select actuar_como_servicio();
update verificaciones_vendedor set ine_frente = '00000000-0000-0000-0000-0000000000e9/comerciante/ine-frente-3.jpg', ine_reverso = '00000000-0000-0000-0000-0000000000e9/comerciante/ine-reverso-3.jpg'
 where usuario_id = '00000000-0000-0000-0000-0000000000e9' and rol = 'comerciante';
insert into storage.objects (bucket_id, name, created_at) values
  ('verificacion', '00000000-0000-0000-0000-0000000000e9/comerciante/ine-frente-3.jpg', now() - interval '3 days'),
  ('verificacion', '00000000-0000-0000-0000-0000000000e9/comerciante/ine-reverso-3.jpg', now() - interval '3 days'),
  ('verificacion', '00000000-0000-0000-0000-0000000000e9/comerciante/ine-frente-viejo.jpg', now() - interval '3 days'),
  ('verificacion', '00000000-0000-0000-0000-0000000000e9/comerciante/ine-reverso-viejo.jpg', now() - interval '2 days'),
  ('verificacion', '00000000-0000-0000-0000-0000000000e9/comerciante/ine-frente-reciente.jpg', now() - interval '2 hours'),
  ('verificacion', '00000000-0000-0000-0000-0000000000e9/comerciante/local-viejo.jpg', now() - interval '3 days'),
  ('verificacion', '00000000-0000-0000-0000-0000000000e9/admin/ine-frente-viejo.jpg', now() - interval '3 days'),
  ('verificacion', 'suelto-ine-frente-viejo.jpg', now() - interval '3 days');
select is(
  (select array_agg(ruta order by ruta) from evidencia_huerfana()),
  array['00000000-0000-0000-0000-0000000000e9/comerciante/ine-frente-viejo.jpg', '00000000-0000-0000-0000-0000000000e9/comerciante/ine-reverso-viejo.jpg'],
  'huérfanas: solo la evidencia sin fila que la apunte y con más de un día' );
select is(
  (select count(*)::int from evidencia_huerfana() where ruta like '%ine-frente-3.jpg' or ruta like '%ine-reverso-3.jpg'),
  0, 'huérfanas: la INE que la verificación vigente apunta NUNCA aparece' );
select is(
  (select count(*)::int from evidencia_huerfana() where ruta like '%reciente%'),
  0, 'huérfanas: una subida de hace horas no se toca (puede estar a punto de enviarse)' );
select is(
  (select count(*)::int from evidencia_huerfana() where ruta like '%local-viejo%'),
  0, 'huérfanas: las fotos del local no son documentos de identidad y no se tocan' );
select is(
  (select count(*)::int from evidencia_huerfana(1)), 1, 'huérfanas: respeta el límite pedido' );
select actuar_como('00000000-0000-0000-0000-0000000000e9');
select throws_ok(
  $$select * from evidencia_huerfana()$$,
  '42501', null, 'huérfanas: el cliente autenticado no puede listarlas' );

-- ── Versión del aviso aceptado (0059) ───────────────────────────────────────
select actuar_como_servicio();
select is((select version_aviso_aceptada from usuarios where id = '00000000-0000-0000-0000-0000000000f7'), 'v3',
  'el alta con aviso_version deja la versión aceptada escrita por el servidor' );
select is((select version_aviso_aceptada from usuarios where id = '00000000-0000-0000-0000-0000000000f8'), null,
  'sin consentimiento válido no hay versión, aunque el metadato la traiga' );
select is((select version_aviso_aceptada from usuarios where id = '00000000-0000-0000-0000-0000000000a1'), null,
  'una cuenta anterior a la versión queda en null: la base no inventa qué vio' );
select actuar_como('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$select aceptar_aviso('v3')$$, 'aceptar_aviso: la persona acepta la versión vigente' );
select is((select version_aviso_aceptada from usuarios where id = '00000000-0000-0000-0000-0000000000a1'), 'v3',
  'aceptar_aviso: queda la versión' );
select isnt((select acepto_aviso_privacidad_en from usuarios where id = '00000000-0000-0000-0000-0000000000a1'), null,
  'aceptar_aviso: queda la hora, escrita por el servidor' );
select throws_ok($$select aceptar_aviso('v3; drop table usuarios')$$, '22023', null, 'aceptar_aviso: una versión con formato raro se rechaza' );
select throws_ok($$select aceptar_aviso('')$$, '22023', null, 'aceptar_aviso: una versión vacía se rechaza' );
select throws_ok($$select aceptar_aviso(null)$$, '22023', null, 'aceptar_aviso: una versión nula se rechaza' );
select actuar_como('00000000-0000-0000-0000-0000000000b2');
select aceptar_aviso('v2');
select actuar_como_servicio();
select is((select version_aviso_aceptada from usuarios where id = '00000000-0000-0000-0000-0000000000a1'), 'v3',
  'aceptar_aviso: solo toca la fila de quien llama, no la de otra cuenta (a1 sigue en v3 tras aceptar b2)' );
select is((select version_aviso_aceptada from usuarios where id = '00000000-0000-0000-0000-0000000000b2'), 'v2',
  'aceptar_aviso: la fila de quien llama sí cambió' );
select is(has_function_privilege('anon', 'public.aceptar_aviso(text)', 'execute'), false, 'aceptar_aviso: anon no puede ejecutarla' );

-- ── Acciones de admin (0060) ────────────────────────────────────────────────
-- a1 es admin aprobado (bloque de la 0049). e9 y b2 NO lo son. b001 es un negocio visible de ejemplo.
select actuar_como_servicio();
insert into resenas (id, usuario_id, negocio_id, estrellas, texto)
values ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000e9', '00000000-0000-0000-0000-00000000b001', 1, 'Reseña de prueba para moderar');
insert into resenas_reportes (resena_id, reportado_por, motivo) values ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000000b2', 'prueba');

select is(es_admin_aprobado('00000000-0000-0000-0000-0000000000a1'), true, 'admin: un admin aprobado lo es');
select is(es_admin_aprobado('00000000-0000-0000-0000-0000000000e9'), false, 'admin: una cuenta normal no lo es');
select is(es_admin_aprobado(null), false, 'admin: null no es admin');
select throws_ok($$select * from admin_resumen('00000000-0000-0000-0000-0000000000e9')$$, 'CP007', null, 'admin_resumen: una cuenta que no es admin recibe CP007' );
select throws_ok($$select * from admin_listar_moderacion('00000000-0000-0000-0000-0000000000e9')$$, 'CP007', null, 'admin_listar_moderacion: idem' );
select throws_ok($$select * from admin_listar_verificaciones('00000000-0000-0000-0000-0000000000e9')$$, 'CP007', null, 'admin_listar_verificaciones: idem' );
select throws_ok($$select moderar_contenido('00000000-0000-0000-0000-0000000000e9', 'resena', '00000000-0000-0000-0000-00000000c001', true, 'x quiero')$$, 'CP007', null,
  'moderar: quien no es admin no oculta nada' );
select throws_ok($$select fijar_demo_mode('00000000-0000-0000-0000-0000000000e9', true)$$, 'CP007', null, 'modo demo: quien no es admin no lo enciende' );
select ok((select verificaciones_pendientes >= 0 and cuentas > 0 from admin_resumen('00000000-0000-0000-0000-0000000000a1')), 'admin_resumen: devuelve cifras a un admin' );
-- ── Resumen con detalle (0078) ──────────────────────────────────────────────
select throws_ok($$select admin_resumen_detalle('00000000-0000-0000-0000-0000000000e9')$$, 'CP007', null, 'admin_resumen_detalle: una cuenta que no es admin recibe CP007' );
select ok(admin_resumen_detalle('00000000-0000-0000-0000-0000000000a1') ?& array['altas_por_semana', 'roles_por_estado', 'publicaciones', 'negocios', 'conversaciones', 'mensajes_7d'],
  'admin_resumen_detalle: trae las seis secciones' );
select is(jsonb_array_length(admin_resumen_detalle('00000000-0000-0000-0000-0000000000a1')->'altas_por_semana'), 8, 'admin_resumen_detalle: ocho semanas, también las que tuvieron cero altas' );
select ok(((admin_resumen_detalle('00000000-0000-0000-0000-0000000000a1')->'altas_por_semana'->7->>'cuentas')::int) >= 1, 'admin_resumen_detalle: la semana en curso cuenta las cuentas de hoy' );
select is((admin_resumen_detalle('00000000-0000-0000-0000-0000000000a1')->'publicaciones'->>'total')::int, (select count(*)::int from publicaciones), 'admin_resumen_detalle: el total de publicaciones es el real' );
select ok((select count(*) from admin_listar_moderacion('00000000-0000-0000-0000-0000000000a1') where id = '00000000-0000-0000-0000-00000000c001' and reportes = 1 and not oculto) = 1,
  'moderación: la reseña reportada aparece con su número de reportes' );
select throws_ok($$select moderar_contenido('00000000-0000-0000-0000-0000000000a1', 'resena', '00000000-0000-0000-0000-00000000c001', true, '  ')$$, 'CP006', null,
  'moderar: ocultar exige motivo' );
select throws_ok($$select moderar_contenido('00000000-0000-0000-0000-0000000000a1', 'usuario', '00000000-0000-0000-0000-00000000c001', true, 'no se puede')$$, '22023', null,
  'moderar: un tipo que no existe se rechaza' );
select throws_ok($$select moderar_contenido('00000000-0000-0000-0000-0000000000a1', 'resena', '00000000-0000-0000-0000-00000000dead', true, 'no existe')$$, 'P0002', null,
  'moderar: lo que no existe se dice' );
select lives_ok($$select moderar_contenido('00000000-0000-0000-0000-0000000000a1', 'resena', '00000000-0000-0000-0000-00000000c001', true, 'Insulta al negocio')$$, 'moderar: un admin oculta una reseña con motivo' );
select is((select oculta_por_reportes from resenas where id = '00000000-0000-0000-0000-00000000c001'), true, 'moderar: la reseña queda oculta' );
select lives_ok($$select moderar_contenido('00000000-0000-0000-0000-0000000000a1', 'resena', '00000000-0000-0000-0000-00000000c001', false, null)$$, 'moderar: restaurar no exige motivo' );
select is((select oculta_por_reportes from resenas where id = '00000000-0000-0000-0000-00000000c001'), false, 'moderar: la reseña vuelve a verse' );
select is((select count(*)::int from resenas_reportes where resena_id = '00000000-0000-0000-0000-00000000c001'), 1, 'moderar: restaurar NO borra los reportes (son evidencia)' );
select lives_ok($$select moderar_contenido('00000000-0000-0000-0000-0000000000a1', 'negocio', '00000000-0000-0000-0000-00000000b001', true, 'Dirección falsa')$$, 'moderar: un admin oculta un negocio' );
select is((select count(*)::int from negocios_publicos where id = '00000000-0000-0000-0000-00000000b001'), 0, 'moderar: un negocio oculto ya no sale en la lista pública' );
select moderar_contenido('00000000-0000-0000-0000-0000000000a1', 'negocio', '00000000-0000-0000-0000-00000000b001', false, null);
select is((select count(*)::int from negocios_publicos where id = '00000000-0000-0000-0000-00000000b001'), 1, 'moderar: restaurado, vuelve a salir' );
select is(fijar_demo_mode('00000000-0000-0000-0000-0000000000a1', true), true, 'modo demo: un admin lo enciende' );
select is((select valor from configuracion_app where clave = 'demo_mode'), 'true', 'modo demo: queda en la configuración' );
select is(fijar_demo_mode('00000000-0000-0000-0000-0000000000a1', false), false, 'modo demo: y lo apaga' );
select is((select string_agg(accion, ',' order by creado_en, accion) from acciones_admin where admin_id = '00000000-0000-0000-0000-0000000000a1'
           and accion in ('ocultar_resena','restaurar_resena','ocultar_negocio','restaurar_negocio','modo_demo')) is not null, true,
  'bitácora: cada acción dejó su fila' );
-- Desde la 0079 aprobar y rechazar verificaciones TAMBIÉN dejan fila (y las pruebas anteriores las hacen): se excluyen aquí, que lo que se cuenta es que ningún intento fallido deje rastro de más.
select is((select count(*)::int from acciones_admin where admin_id = '00000000-0000-0000-0000-0000000000a1' and accion not in ('aprobar_verificacion', 'rechazar_verificacion')), 6,
  'bitácora: exactamente 6 acciones hasta aquí (ocultar y restaurar una reseña, ocultar y restaurar un negocio, encender y apagar el modo demo), ninguna de más' );
select is((select detalle from acciones_admin where accion = 'ocultar_resena'), 'Insulta al negocio', 'bitácora: queda el motivo' );
-- Ver documentos: solo con verificación pendiente, solo un admin, y deja rastro.
select throws_ok($$select registrar_acceso_documentos('00000000-0000-0000-0000-0000000000e9', '00000000-0000-0000-0000-0000000000e9', 'comerciante')$$,
  'CP007', null, 'documentos: quien no es admin no los ve' );
select throws_ok($$select registrar_acceso_documentos('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', 'comerciante')$$,
  'CP005', null, 'documentos: sin verificación pendiente no hay nada que ver (no se puede explorar a nadie)' );
select lives_ok($$select registrar_acceso_documentos('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e9', 'comerciante')$$,
  'documentos: un admin ve los de una verificación pendiente' );
select is((select count(*)::int from acciones_admin where accion = 'ver_documentos' and objetivo_id = '00000000-0000-0000-0000-0000000000e9'), 1,
  'documentos: queda registrado quién miró los de quién' );
select actuar_como('00000000-0000-0000-0000-0000000000e9');
select throws_ok($$select * from acciones_admin$$, '42501', null, 'bitácora: el cliente autenticado no la lee' );
select throws_ok($$select moderar_contenido('00000000-0000-0000-0000-0000000000a1', 'resena', '00000000-0000-0000-0000-00000000c001', true, 'intento desde el cliente')$$, '42501', null,
  'moderar: el cliente autenticado no puede ejecutarla, ni diciendo que es admin' );
select throws_ok($$select * from admin_resumen('00000000-0000-0000-0000-0000000000a1')$$, '42501', null, 'admin_resumen: el cliente autenticado no puede ejecutarla' );
select throws_ok($$select admin_resumen_detalle('00000000-0000-0000-0000-0000000000a1')$$, '42501', null, 'admin_resumen_detalle: el cliente autenticado no puede ejecutarla' );
select throws_ok($$select * from admin_listar_auditoria('00000000-0000-0000-0000-0000000000a1', 50)$$, '42501', null, 'admin_listar_auditoria: el cliente autenticado no puede ejecutarla' );
select throws_ok($$select admin_ingresos('00000000-0000-0000-0000-0000000000a1')$$, '42501', null, 'admin_ingresos: el cliente autenticado no puede ejecutarla' );
select throws_ok($$select admin_eventos_pago('00000000-0000-0000-0000-0000000000a1')$$, '42501', null, 'admin_eventos_pago: el cliente autenticado no puede ejecutarla' );
select throws_ok($$select registrar_evento_pago('x', 'info', 200, null, null)$$, '42501', null, 'registrar_evento_pago: el cliente autenticado no puede registrar eventos' );
select throws_ok($$select fijar_demo_mode('00000000-0000-0000-0000-0000000000a1', true)$$, '42501', null, 'modo demo: el cliente autenticado no puede ejecutarla' );
select throws_ok($$select registrar_acceso_documentos('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e9', 'comerciante')$$,
  '42501', null, 'documentos: el cliente autenticado no puede registrar (ni ver) nada' );


-- ── Privilegios de vistas y de anon (0061) ──────────────────────────────────
-- Hallazgo del 18/10/2026: las vistas «públicas» eran actualizables y escribían con los permisos de su dueño, saltándose RLS.
select actuar_como_servicio();
select is(
  (select count(*)::int from information_schema.role_table_grants g
     join information_schema.views v on v.table_schema = g.table_schema and v.table_name = g.table_name
    where g.table_schema = 'public' and g.grantee = 'authenticated' and g.privilege_type <> 'SELECT'),
  0, 'vistas: authenticated solo tiene SELECT sobre las vistas públicas (si no, las escribiría saltándose RLS)' );
select is(
  (select count(*)::int from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon'),
  0, 'anon no tiene ningún privilegio sobre tablas ni vistas de public' );
select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'authenticated' and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER')),
  0, 'authenticated no tiene TRUNCATE, REFERENCES ni TRIGGER (RLS no los filtra)' );
select is(has_table_privilege('authenticated', 'public.publicaciones_publicas', 'select'), true, 'vistas: authenticated SIGUE leyendo publicaciones_publicas' );
select is(has_table_privilege('authenticated', 'public.roomies_publicos', 'select'), true, 'vistas: authenticated SIGUE leyendo roomies_publicos' );
select is(has_table_privilege('authenticated', 'public.perfiles_publicos', 'select'), true, 'vistas: authenticated SIGUE leyendo perfiles_publicos' );
select actuar_como('00000000-0000-0000-0000-0000000000b2');
-- Desde la 0087 la vista une con los planes y deja de ser actualizable: ya no llega ni a mirar los permisos (55000, «no se puede escribir en una vista»). Sigue siendo imposible.
select throws_ok($$update publicaciones_publicas set titulo = 'HACKEADA'$$, '55000', null, 'vistas: no se puede ACTUALIZAR una publicación ajena a través de la vista' );
select throws_ok($$delete from publicaciones_publicas$$, '55000', null, 'vistas: no se puede BORRAR una publicación ajena a través de la vista' );
select throws_ok($$insert into publicaciones_publicas (id) values (gen_random_uuid())$$, '55000', null, 'vistas: no se puede insertar a través de la vista' );
select throws_ok($$update roomies_publicos set descripcion_busqueda = 'HACKEADO'$$, '42501', null, 'vistas: no se puede ACTUALIZAR un anuncio de roomie ajeno a través de la vista' );
select throws_ok($$delete from roomies_publicos$$, '42501', null, 'vistas: no se puede BORRAR un anuncio de roomie ajeno a través de la vista' );
select is(has_table_privilege('authenticated', 'public.perfiles_publicos', 'update'), false, 'vistas: perfiles_publicos tampoco se escribe (no tiene UPDATE)' );

-- ── Acceso a TODOS mis datos (0062) ─────────────────────────────────────────
-- f7 tiene funciones y una verificación (bloque de la 0049) y negocios (0052); b2 es ajena.
select actuar_como('00000000-0000-0000-0000-0000000000f7');
select is(
  (select array_agg(k order by k) from jsonb_object_keys(exportar_mis_datos()) k),
  array['contactos','favoritos','favoritos_negocios','funciones','generado_en','mensajes','menu','negocios','pagos','perfil','publicaciones','resenas','roomie','suscripciones','verificaciones'],
  'exportar: trae todas las secciones, también las nuevas' );
select is(jsonb_array_length(exportar_mis_datos()->'funciones'), (select count(*)::int from roles_usuario where usuario_id = '00000000-0000-0000-0000-0000000000f7'),
  'exportar: las funciones son las propias' );
select ok(jsonb_array_length(exportar_mis_datos()->'verificaciones') >= 1, 'exportar: incluye la verificación propia (nombre legal, domicilio, estado)' );
select ok((exportar_mis_datos()->'verificaciones'->0) ? 'nombre_legal', 'exportar: la verificación trae el nombre legal' );
select ok(exportar_mis_datos()::text !~ 'ine-frente|ine-reverso', 'exportar: NO trae las rutas internas de la INE' );
select is(jsonb_array_length(exportar_mis_datos()->'negocios'), (select count(*)::int from negocios where usuario_id = '00000000-0000-0000-0000-0000000000f7'),
  'exportar: los negocios son los propios' );
select actuar_como('00000000-0000-0000-0000-0000000000b2');
select is(jsonb_array_length(exportar_mis_datos()->'verificaciones'), 0, 'exportar: una cuenta ajena NO recibe la verificación de otra' );
select is(jsonb_array_length(exportar_mis_datos()->'negocios'), 0, 'exportar: ni sus negocios' );
select is(exportar_mis_datos()->'perfil'->>'id', '00000000-0000-0000-0000-0000000000b2', 'exportar: el perfil es el de quien llama' );

-- ── Tope a la evidencia de verificación (0063) ──────────────────────────────
-- d9: comerciante SIN verificar (puede subir). e9: comerciante pendiente. f7: aprobada. b2: sin ninguna función.
select actuar_como_servicio();
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000d9', 'authenticated', 'authenticated', 'd9@test.mx', '', now(), now(), '{"nombre_usuario":"usuario_d9"}');
insert into roles_usuario (usuario_id, rol) values ('00000000-0000-0000-0000-0000000000d9', 'comerciante');
insert into storage.objects (bucket_id, name, created_at) values
  ('verificacion', '00000000-0000-0000-0000-0000000000e9/comerciante/lugar-9-viejo-sin-fila.jpg', now() - interval '3 days');

select actuar_como('00000000-0000-0000-0000-0000000000d9');
select lives_ok($$insert into storage.objects (bucket_id, name) values ('verificacion', '00000000-0000-0000-0000-0000000000d9/comerciante/ine-frente-1760000000000-abc123.jpg')$$,
  'subir: quien puede enviar la verificación sube un archivo con la forma de la app' );
select lives_ok($$insert into storage.objects (bucket_id, name) values ('verificacion', '00000000-0000-0000-0000-0000000000d9/comerciante/lugar-2-1760000000001-abc123.jpg')$$,
  'subir: también las fotos del lugar (lugar-N)' );
select throws_ok($$insert into storage.objects (bucket_id, name) values ('verificacion', '00000000-0000-0000-0000-0000000000d9/comerciante/cualquier-cosa.jpg')$$, '42501', null,
  'subir: un nombre libre se rechaza' );
select throws_ok($$insert into storage.objects (bucket_id, name) values ('verificacion', '00000000-0000-0000-0000-0000000000d9/comerciante/ine-frente-1-a.png')$$, '42501', null,
  'subir: solo .jpg (es lo que sube la app)' );
select throws_ok($$insert into storage.objects (bucket_id, name) values ('verificacion', '00000000-0000-0000-0000-0000000000d9/admin/ine-frente-1-a.jpg')$$, '42501', null,
  'subir: un rol que no existe' );
select throws_ok($$insert into storage.objects (bucket_id, name) values ('verificacion', '00000000-0000-0000-0000-0000000000d9/arrendador/ine-frente-1-a.jpg')$$, '42501', null,
  'subir: la función de arrendador no la tiene, así que no sube a su carpeta' );
select throws_ok($$insert into storage.objects (bucket_id, name) values ('verificacion', '00000000-0000-0000-0000-0000000000b2/comerciante/ine-frente-1-a.jpg')$$, '42501', null,
  'subir: la carpeta de OTRA cuenta' );
select throws_ok($$insert into storage.objects (bucket_id, name) values ('verificacion', '00000000-0000-0000-0000-0000000000d9/comerciante/../x/ine-frente-1-a.jpg')$$, '42501', null,
  'subir: con «..» no' );
select actuar_como_servicio();
insert into storage.objects (bucket_id, name)
select 'verificacion', '00000000-0000-0000-0000-0000000000d9/comerciante/lugar-' || g || '-relleno.jpg' from generate_series(10, 31) g;
select actuar_como('00000000-0000-0000-0000-0000000000d9');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('verificacion', '00000000-0000-0000-0000-0000000000d9/comerciante/lugar-99-uno-mas.jpg')$$, '42501', null,
  'subir: con 24 archivos en la carpeta del rol, el siguiente se rechaza (tope)' );

select actuar_como('00000000-0000-0000-0000-0000000000b2');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('verificacion', '00000000-0000-0000-0000-0000000000b2/comerciante/ine-frente-1-a.jpg')$$, '42501', null,
  'subir: sin ninguna función de vendedor no se sube nada' );
select actuar_como('00000000-0000-0000-0000-0000000000e9');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('verificacion', '00000000-0000-0000-0000-0000000000e9/comerciante/ine-frente-2-a.jpg')$$, '42501', null,
  'subir: con la verificación PENDIENTE ya no hay nada que subir' );
select actuar_como('00000000-0000-0000-0000-0000000000f7');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('verificacion', '00000000-0000-0000-0000-0000000000f7/comerciante/ine-frente-2-a.jpg')$$, '42501', null,
  'subir: con la función ya APROBADA tampoco' );

select actuar_como_servicio();
select is((select count(*)::int from evidencia_huerfana() where ruta = '00000000-0000-0000-0000-0000000000e9/comerciante/lugar-9-viejo-sin-fila.jpg'), 1,
  'huérfanas: una foto del lugar (lugar-N) sin fila que la apunte, de hace 3 días, ahora SÍ se recoge' );
select is((select count(*)::int from evidencia_huerfana() where ruta like '%/lugar-%relleno.jpg'), 0,
  'huérfanas: lo reciente (recién subido) no se toca' );
select actuar_como('00000000-0000-0000-0000-0000000000e9');
select throws_ok($$select * from evidencia_huerfana()$$, '42501', null, 'huérfanas: el cliente autenticado no puede listarlas' );
select is(has_function_privilege('anon', 'public.puede_subir_evidencia(text)', 'execute'), false, 'puede_subir_evidencia: anon no la ejecuta' );

-- ── Aviso push al resolver una verificación (0064) ─────────────────────────
-- d9 (comerciante sin verificar) la envía y se aprueba; e9 (pendiente) se rechaza con un motivo que NO debe salir en la notificación.
select actuar_como_servicio();
insert into push_tokens (usuario_id, token) values ('00000000-0000-0000-0000-0000000000d9', 'ExponentPushToken[d9]'), ('00000000-0000-0000-0000-0000000000e9', 'ExponentPushToken[e9]')
  on conflict (usuario_id) do update set token = excluded.token;
select actuar_como('00000000-0000-0000-0000-0000000000d9');
select enviar_verificacion('comerciante', 'Dalia Prueba Nava', 'Calle 4, Lerma',
  '00000000-0000-0000-0000-0000000000d9/comerciante/ine-frente-9-a.jpg', '00000000-0000-0000-0000-0000000000d9/comerciante/ine-reverso-9-a.jpg', array['00000000-0000-0000-0000-0000000000d9/comerciante/lugar-1-9-a.jpg'], 'v3');
select actuar_como_servicio();
select lives_ok($$select resolver_verificacion('00000000-0000-0000-0000-0000000000d9', 'comerciante', true, null, '00000000-0000-0000-0000-0000000000a1')$$, 'aviso: aprobar sigue funcionando' );
select is((select estado from roles_usuario where usuario_id = '00000000-0000-0000-0000-0000000000d9' and rol = 'comerciante'), 'aprobado', 'aviso: y deja la función aprobada' );
select is(
  (select count(*)::int from net.http_request_queue where convert_from(body, 'utf8') like '%ExponentPushToken[d9]%' and convert_from(body, 'utf8') like '%Verificación aprobada%'),
  1, 'aviso: al aprobar se encola UN push a la persona, con el título correcto' );
select ok(
  (select convert_from(body, 'utf8')::jsonb->'data' @> '{"tipo":"verificacion","rol":"comerciante","estado":"aprobada"}'::jsonb
     from net.http_request_queue where convert_from(body, 'utf8') like '%ExponentPushToken[d9]%' limit 1),
  'aviso: el push lleva tipo y rol para abrir la pantalla correcta' );
select lives_ok($$select resolver_verificacion('00000000-0000-0000-0000-0000000000e9', 'comerciante', false, 'El domicilio no coincide con el recibo de Eva Soto', '00000000-0000-0000-0000-0000000000a1')$$, 'aviso: rechazar sigue funcionando' );
select is(
  (select count(*)::int from net.http_request_queue where convert_from(body, 'utf8') like '%ExponentPushToken[e9]%' and convert_from(body, 'utf8') like '%Verificación rechazada%'),
  1, 'aviso: al rechazar se encola UN push a la persona' );
select is(
  (select count(*)::int from net.http_request_queue where convert_from(body, 'utf8') like '%ExponentPushToken[e9]%' and (convert_from(body, 'utf8') like '%domicilio%' or convert_from(body, 'utf8') like '%Eva Soto%')),
  0, 'aviso: el MOTIVO no sale en la notificación (se lee en la pantalla de bloqueo)' );
-- ── Auditoría: las decisiones sobre verificaciones también quedan en la bitácora (0079) ──
select is((select count(*)::int from acciones_admin where accion = 'aprobar_verificacion' and objetivo_id = '00000000-0000-0000-0000-0000000000d9' and admin_id = '00000000-0000-0000-0000-0000000000a1'), 1,
  'auditoría: aprobar una verificación queda en la bitácora, con quién fue' );
select ok(exists (select 1 from acciones_admin where accion = 'rechazar_verificacion' and objetivo_id = '00000000-0000-0000-0000-0000000000e9' and detalle like '%comerciante%' and detalle like '%El domicilio no coincide%'),
  'auditoría: rechazar queda en la bitácora con la función y el motivo' );
select throws_ok($$select * from admin_listar_auditoria('00000000-0000-0000-0000-0000000000e9', 50)$$, 'CP007', null, 'admin_listar_auditoria: una cuenta que no es admin recibe CP007' );
select ok((select count(*) from admin_listar_auditoria('00000000-0000-0000-0000-0000000000a1', 200) where accion in ('aprobar_verificacion', 'rechazar_verificacion')) >= 2,
  'admin_listar_auditoria: trae las decisiones sobre verificaciones' );
select is((select count(*)::int from admin_listar_auditoria('00000000-0000-0000-0000-0000000000a1', 1)), 1, 'admin_listar_auditoria: el límite acota la lista' );
-- ── Ingresos y planes (0080) ────────────────────────────────────────────────
-- Los datos de prueba van dentro de un savepoint y se deshacen al final: no alteran los conteos de lo que sigue.
savepoint s_ingresos;
insert into pagos (usuario_id, rol, plan_id, monto_centavos, origen, mp_payment_id, periodo_inicio, periodo_fin, creado_en) values
  ('00000000-0000-0000-0000-0000000000d9', 'comerciante', 'comerciante_basico', 9900, 'mercadopago', 'mp-t-1', now(), now() + interval '30 days', now() - interval '1 day'),
  ('00000000-0000-0000-0000-0000000000d9', 'comerciante', 'comerciante_basico', 9900, 'mercadopago', 'mp-t-2', now(), now() + interval '30 days', now() - interval '2 days'),
  ('00000000-0000-0000-0000-0000000000d9', 'comerciante', 'comerciante_destacado', 19900, 'simulado', null, now(), now() + interval '30 days', now() - interval '10 days'),
  ('00000000-0000-0000-0000-0000000000d9', 'comerciante', 'comerciante_basico', 12345, 'mercadopago', 'mp-t-3', now(), now() + interval '30 days', now() - interval '60 days');
insert into ordenes_pago (usuario_id, rol, plan_id, monto_centavos, estado) values
  ('00000000-0000-0000-0000-0000000000d9', 'comerciante', 'comerciante_basico', 9900, 'creada'), ('00000000-0000-0000-0000-0000000000d9', 'comerciante', 'comerciante_basico', 9900, 'pendiente'),
  ('00000000-0000-0000-0000-0000000000d9', 'comerciante', 'comerciante_basico', 9900, 'pagada'), ('00000000-0000-0000-0000-0000000000d9', 'comerciante', 'comerciante_basico', 9900, 'rechazada');

select throws_ok($$select admin_ingresos('00000000-0000-0000-0000-0000000000e9')$$, 'CP007', null, 'admin_ingresos: una cuenta que no es admin recibe CP007' );
select ok(admin_ingresos('00000000-0000-0000-0000-0000000000a1') ?& array['por_semana', 'ingresos_30d', 'suscripciones', 'por_plan', 'ordenes_30d', 'ultimos_pagos'], 'admin_ingresos: trae las seis secciones' );
select is(jsonb_array_length(admin_ingresos('00000000-0000-0000-0000-0000000000a1')->'por_semana'), 8, 'admin_ingresos: ocho semanas, también las de cero' );
select is((admin_ingresos('00000000-0000-0000-0000-0000000000a1')->'ingresos_30d'->>'mercadopago_centavos')::bigint,
  (select coalesce(sum(monto_centavos), 0) from pagos where origen = 'mercadopago' and creado_en >= now() - interval '30 days'),
  'admin_ingresos: lo cobrado por Mercado Pago en 30 días es la suma real' );
select ok((admin_ingresos('00000000-0000-0000-0000-0000000000a1')->'ingresos_30d'->>'mercadopago_centavos')::bigint < (select sum(monto_centavos) from pagos where origen = 'mercadopago'),
  'admin_ingresos: un pago de hace 60 días NO entra en los 30 días' );
select is((admin_ingresos('00000000-0000-0000-0000-0000000000a1')->'ingresos_30d'->>'simulado_centavos')::bigint, (select coalesce(sum(monto_centavos), 0) from pagos where origen = 'simulado' and creado_en >= now() - interval '30 days'),
  'admin_ingresos: lo simulado se cuenta APARTE de lo real' );
select is((admin_ingresos('00000000-0000-0000-0000-0000000000a1')->'suscripciones'->>'activas')::int, (select count(*)::int from suscripciones where vigente_hasta > now()), 'admin_ingresos: suscripciones activas = con periodo pagado vigente' );
select is(
  (select sum((e->>'mercadopago_centavos')::bigint)::bigint from jsonb_array_elements(admin_ingresos('00000000-0000-0000-0000-0000000000a1')->'por_semana') e),
  (select coalesce(sum(monto_centavos), 0) from pagos where origen = 'mercadopago' and (creado_en at time zone 'America/Mexico_City')::date >= (date_trunc('week', now() at time zone 'America/Mexico_City'))::date - 49),
  'admin_ingresos: la suma de las semanas es lo cobrado en esas semanas' );
select is((admin_ingresos('00000000-0000-0000-0000-0000000000a1')->'ordenes_30d'->>'pagada')::int, (select count(*)::int from ordenes_pago where estado = 'pagada' and creada_en >= now() - interval '30 days'), 'admin_ingresos: el embudo de órdenes cuenta las pagadas' );
select ok(jsonb_array_length(admin_ingresos('00000000-0000-0000-0000-0000000000a1')->'ultimos_pagos') between 1 and 10 and (admin_ingresos('00000000-0000-0000-0000-0000000000a1')->'ultimos_pagos'->0->>'creado_en')::timestamptz >= (admin_ingresos('00000000-0000-0000-0000-0000000000a1')->'ultimos_pagos'->1->>'creado_en')::timestamptz,
  'admin_ingresos: los últimos pagos son a lo más 10 y van del más reciente al más antiguo' );
rollback to savepoint s_ingresos;
-- ── Eventos del webhook de pagos (0081) ─────────────────────────────────────
savepoint s_eventos;
select throws_ok($$select admin_eventos_pago('00000000-0000-0000-0000-0000000000e9')$$, 'CP007', null, 'admin_eventos_pago: una cuenta que no es admin recibe CP007' );
select lives_ok($$select registrar_evento_pago('activado', 'info', 200, '1234567890', null)$$, 'registrar_evento_pago: guarda un aviso' );
select lives_ok($$select registrar_evento_pago('no-coincide', 'alerta', 401, null, null)$$, 'registrar_evento_pago: guarda una alerta sin pago' );
select is(admin_eventos_pago('00000000-0000-0000-0000-0000000000a1')->'eventos'->0->>'etiqueta', 'no-coincide', 'admin_eventos_pago: el más reciente va primero' );
select is((admin_eventos_pago('00000000-0000-0000-0000-0000000000a1')->>'total_24h')::int, 2, 'admin_eventos_pago: cuenta los avisos de las últimas 24 horas' );
select is((admin_eventos_pago('00000000-0000-0000-0000-0000000000a1')->>'alertas_24h')::int, 1, 'admin_eventos_pago: y cuántos de ellos son alertas' );
select throws_ok($$select registrar_evento_pago('x', 'grave', 200, null, null)$$, '22023', null, 'registrar_evento_pago: un nivel que no es info ni alerta se rechaza' );
select lives_ok($$select registrar_evento_pago(repeat('a', 300), 'info', 500, 'no-es-un-numero', null)$$, 'registrar_evento_pago: una etiqueta enorme no rompe nada' );
select ok((select char_length(etiqueta) <= 60 and pago_id is null from eventos_pago where status = 500), 'registrar_evento_pago: acota la etiqueta y solo guarda un id de pago NUMÉRICO' );
insert into eventos_pago (recibido_en, etiqueta, nivel, status) values (now() - interval '70 days', 'viejo', 'info', 200);
select registrar_evento_pago('activado', 'info', 200, null, null);
select is((select count(*)::int from eventos_pago where recibido_en < now() - interval '60 days'), 0, 'registrar_evento_pago: poda lo de más de 60 días (la tabla no crece sin fin)' );
rollback to savepoint s_eventos;
-- Sin token no se avisa, pero la resolución no se rompe: rechazar la verificación de un tercero sin token es el mismo camino.
select actuar_como_servicio();
delete from push_tokens where usuario_id = '00000000-0000-0000-0000-0000000000d9';
select is((select estado from roles_usuario where usuario_id = '00000000-0000-0000-0000-0000000000e9' and rol = 'comerciante'), 'rechazado', 'aviso: la decisión quedó tomada aunque el aviso sea opcional' );

-- ── Búsqueda de Servicios sin acentos y por producto (0065) ─────────────────
select actuar_como_servicio();
insert into categorias_servicio (id, nombre, icono, orden, activa) values ('bus', 'Búsqueda', 'search-outline', 9, true) on conflict (id) do nothing;
insert into negocios (id, categoria_id, nombre, descripcion, direccion, origen, activo, oculto_por_reportes) values
  ('00000000-0000-0000-0000-00000000f001', 'bus', 'Cafetería Ñandú', 'Café de especialidad', 'Calle S1', 'sembrado', true, false),
  ('00000000-0000-0000-0000-00000000f002', 'bus', 'Tacos Beto', null, 'Calle S2', 'sembrado', true, false),
  ('00000000-0000-0000-0000-00000000f003', 'bus', 'Panadería Lupe', null, 'Calle S3', 'sembrado', true, false),
  ('00000000-0000-0000-0000-00000000f004', 'bus', 'Ferretería Oculta', null, 'Calle S4', 'sembrado', true, false);
insert into negocio_items (negocio_id, nombre) values
  ('00000000-0000-0000-0000-00000000f003', 'Tacos dorados de horno'),
  ('00000000-0000-0000-0000-00000000f004', 'Clavos');
select actuar_como('00000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from negocios_ordenados('bus', 'cafeteria') where id = '00000000-0000-0000-0000-00000000f001'), 1,
  'búsqueda: «cafeteria» (sin acento) encuentra «Cafetería»' );
select is((select count(*)::int from negocios_ordenados('bus', 'CAFETERÍA') where id = '00000000-0000-0000-0000-00000000f001'), 1,
  'búsqueda: mayúsculas y acento escrito también' );
select is((select count(*)::int from negocios_ordenados('bus', 'nandu') where id = '00000000-0000-0000-0000-00000000f001'), 1,
  'búsqueda: «nandu» encuentra «Ñandú»' );
select is((select count(*)::int from negocios_ordenados('bus', 'cafe') where id = '00000000-0000-0000-0000-00000000f001'), 1,
  'búsqueda: también por la descripción («Café de especialidad»)' );
select is((select count(*)::int from negocios_ordenados('bus', 'clavos') where id = '00000000-0000-0000-0000-00000000f004'), 1,
  'búsqueda: por el nombre de un PRODUCTO del menú' );
select is((select array_agg(id::text order by ord) from (select id, row_number() over () as ord from negocios_ordenados('bus', 'tacos')) t),
  array['00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-00000000f003'],
  'búsqueda: «tacos» trae al que se llama así ANTES que al que solo los vende' );
select is((select count(*)::int from negocios_ordenados('bus', 'zzzxxx')), 0, 'búsqueda: lo que no existe no devuelve nada' );
select is((select count(*)::int from negocios_ordenados('bus', '%')), 0, 'búsqueda: «%» sigue sin ser «todo»' );
select is((select count(*)::int from negocios_ordenados('bus', 'tacos', 100)), 2, 'búsqueda: los productos de un negocio NO visible no cuentan (solo los dos que sí lo son)' );
select actuar_como_servicio();
update negocios set oculto_por_reportes = true where id = '00000000-0000-0000-0000-00000000f004';
select actuar_como('00000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from negocios_ordenados('bus', 'clavos')), 0, 'búsqueda: un negocio oculto no aparece ni por su producto' );
select throws_ok($$select normalizar_busqueda('x')$$, '42501', null, 'normalizar_busqueda: no la ejecuta el cliente' );

-- ── Compatibilidad de Roomies con razones (0066) ────────────────────────────
-- cc01 = quien busca (ruido bajo, no fuma, sin mascotas, diurno, presupuesto 2000–3500).
-- cc02 compatible en todo; cc03 opuesto en todo; cc04 sin ruido declarado y horario «mixto».
select actuar_como_servicio();
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000cc01', 'authenticated', 'authenticated', 'cc01@test.mx', '', now(), now(), '{"nombre_usuario":"usuario_cc01"}'),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000cc02', 'authenticated', 'authenticated', 'cc02@test.mx', '', now(), now(), '{"nombre_usuario":"usuario_cc02"}'),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000cc03', 'authenticated', 'authenticated', 'cc03@test.mx', '', now(), now(), '{"nombre_usuario":"usuario_cc03"}'),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000cc04', 'authenticated', 'authenticated', 'cc04@test.mx', '', now(), now(), '{"nombre_usuario":"usuario_cc04"}');
update usuarios set nivel_ruido = 'bajo', fuma = false, mascotas = false, horario_predominante = 'diurno', presupuesto_min = 2000, presupuesto_max = 3500 where id = '00000000-0000-0000-0000-00000000cc01';
update usuarios set nivel_ruido = 'bajo', fuma = false, mascotas = false, horario_predominante = 'diurno' where id = '00000000-0000-0000-0000-00000000cc02';
update usuarios set nivel_ruido = 'alto', fuma = true, mascotas = true, horario_predominante = 'nocturno' where id = '00000000-0000-0000-0000-00000000cc03';
update usuarios set nivel_ruido = null, fuma = false, mascotas = false, horario_predominante = 'mixto' where id = '00000000-0000-0000-0000-00000000cc04';
insert into roomies (usuario_id, descripcion_busqueda, presupuesto_aportacion, estado) values
  ('00000000-0000-0000-0000-00000000cc02', 'Busco roomie tranquilo', 3000, 'activo'),
  ('00000000-0000-0000-0000-00000000cc03', 'Busco fiesta', 5000, 'activo'),
  ('00000000-0000-0000-0000-00000000cc04', 'Busco roomie', null, 'activo');
select actuar_como('00000000-0000-0000-0000-00000000cc01');
select is((select compatibilidad from sugerencias_roomies(100) where usuario_id = '00000000-0000-0000-0000-00000000cc02'), 1.000::numeric, 'roomies: todo coincide → compatibilidad 1' );
select is((select coincidencias from sugerencias_roomies(100) where usuario_id = '00000000-0000-0000-0000-00000000cc02'),
  array['Mismo nivel de ruido', 'Ninguno fuma', 'Ninguno tiene mascotas', 'Mismo horario', 'Su aportación entra en tu presupuesto'],
  'roomies: dice POR QUÉ coincide, con frases legibles' );
select is((select cardinality(diferencias) from sugerencias_roomies(100) where usuario_id = '00000000-0000-0000-0000-00000000cc02'), 0, 'roomies: sin diferencias cuando no las hay' );
select is((select compatibilidad from sugerencias_roomies(100) where usuario_id = '00000000-0000-0000-0000-00000000cc03'), 0.081::numeric, 'roomies: opuesto en casi todo → compatibilidad baja (0.081)' );
select is((select diferencias from sugerencias_roomies(100) where usuario_id = '00000000-0000-0000-0000-00000000cc03'),
  array['Nivel de ruido muy distinto', 'Uno fuma y el otro no', 'Uno tiene mascotas y el otro no', 'Horarios opuestos', 'Su aportación queda fuera de tu presupuesto'],
  'roomies: dice POR QUÉ no, también' );
select is((select cardinality(coincidencias) from sugerencias_roomies(100) where usuario_id = '00000000-0000-0000-0000-00000000cc03'), 0, 'roomies: ninguna coincidencia inventada' );
select is((select compatibilidad from sugerencias_roomies(100) where usuario_id = '00000000-0000-0000-0000-00000000cc04'), 0.864::numeric,
  'roomies: lo que no tiene dato se IGNORA y los pesos se re-normalizan (no se castiga ni se premia)' );
select is((select coincidencias from sugerencias_roomies(100) where usuario_id = '00000000-0000-0000-0000-00000000cc04'), array['Ninguno fuma', 'Ninguno tiene mascotas'],
  'roomies: sin dato de ruido no hay razón de ruido (ni a favor ni en contra)' );
select is((select array_agg(usuario_id order by ord) from (select usuario_id, row_number() over () as ord from sugerencias_roomies(100)
   where usuario_id in ('00000000-0000-0000-0000-00000000cc02', '00000000-0000-0000-0000-00000000cc03', '00000000-0000-0000-0000-00000000cc04')) t), array['00000000-0000-0000-0000-00000000cc02', '00000000-0000-0000-0000-00000000cc04', '00000000-0000-0000-0000-00000000cc03']::uuid[],
  'roomies: ordena por puntaje (compatible, luego sin ruido, luego opuesto)' );
select is((select puntaje from sugerencias_roomies(100) where usuario_id = '00000000-0000-0000-0000-00000000cc02'), 0.5000::numeric,
  'roomies: sin vector la afinidad aporta 0 (puntaje = la mitad de la compatibilidad), no desaparece' );
select is((select similitud from sugerencias_roomies(100) where usuario_id = '00000000-0000-0000-0000-00000000cc02'), null, 'roomies: la similitud sigue siendo nula sin vectores (no se inventa)' );
select is((select count(*)::int from sugerencias_roomies(100) where usuario_id = '00000000-0000-0000-0000-00000000cc01'), 0, 'roomies: nunca te sugiere a ti mismo' );
select throws_ok($$select vector_busqueda from sugerencias_roomies(1)$$, '42703', null, 'roomies: la firma sigue sin exponer el vector' );
select is(has_function_privilege('anon', 'public.sugerencias_roomies(integer)', 'execute'), false, 'roomies: anon no la ejecuta' );

-- ── Higiene del asesor (0067) ───────────────────────────────────────────────
select actuar_como_servicio();
select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      -- Los tres auxiliares de ESTE archivo (ver más arriba) viven solo dentro de la transacción de la prueba.
      and p.proname not in ('actuar_como', 'actuar_como_servicio', 'ejecutables_por')
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
  0, 'higiene: TODA función propia de public fija su search_path (las futuras también: esta prueba falla si una nueva no lo hace)' );
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'roomies' and policyname = 'roomies_select_propio'), 0,
  'higiene: la policy de lectura redundante de roomies ya no existe' );
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'roomies' and cmd in ('SELECT', 'ALL')), 1,
  'higiene: roomies queda con UNA sola policy de lectura por rol' );
select ok(pg_get_viewdef('public.perfiles_publicos'::regclass) !~ 'auth\.users', 'higiene: perfiles_publicos ya no depende de auth.users' );
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000cc05', 'authenticated', 'authenticated', 'cc05@test.mx', '', now(), now(), '{"nombre_usuario":"usuario_cc05"}');
select is((select correo_verificado from perfiles_publicos where id = '00000000-0000-0000-0000-00000000cc05'), false, 'correo: una cuenta sin confirmar no aparece como verificada' );
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-00000000cc05';
select is((select correo_verificado from perfiles_publicos where id = '00000000-0000-0000-0000-00000000cc05'), true, 'correo: al confirmar el correo, el trigger lo marca' );
update auth.users set email_confirmed_at = null where id = '00000000-0000-0000-0000-00000000cc05';
select is((select correo_verificado from perfiles_publicos where id = '00000000-0000-0000-0000-00000000cc05'), false, 'correo: y si se desconfirma, vuelve a falso' );
select actuar_como('00000000-0000-0000-0000-00000000cc05');
select throws_ok($$update usuarios set correo_verificado = true where id = '00000000-0000-0000-0000-00000000cc05'$$, 'P0001', null,
  'correo: una cuenta NO puede ponerse el sello de correo verificado' );
select lives_ok($$update usuarios set biografia = 'hola' where id = '00000000-0000-0000-0000-00000000cc05'$$, 'correo: pero sigue pudiendo editar el resto de su perfil' );

-- ── Registro de errores de la app (0068) ────────────────────────────────────
select actuar_como('00000000-0000-0000-0000-0000000000b2');
select lives_ok($$select registrar_error_app('error', 'No se pudo cargar la lista (usuario ana@correo.mx, token eyJabcdefghij.klmnopqrstu.vwxyz123456, tel 7221234567)', 'Bearer abc.def-123 falló', '1.0.0', 'android')$$,
  'errores: una cuenta con sesión registra un error' );
select actuar_como_servicio();
select is((select count(*)::int from errores_app), 1, 'errores: queda UNA fila' );
select is((select mensaje from errores_app limit 1),
  'No se pudo cargar la lista (usuario [correo], token [token], tel [tel])',
  'errores: el servidor limpia correos, tokens y teléfonos aunque el cliente no lo haya hecho' );
select is((select detalle from errores_app limit 1), 'Bearer [token] falló', 'errores: también el detalle' );
select ok(not exists (select 1 from information_schema.columns where table_name = 'errores_app' and column_name ~ 'usuario|correo|ip|dispositivo'),
  'errores: la tabla NO tiene ninguna columna que identifique a quién (minimización)' );
select actuar_como('00000000-0000-0000-0000-0000000000b2');
select registrar_error_app('error', 'No se pudo cargar la lista (usuario x@y.mx, token eyJabcdefghij.klmnopqrstu.vwxyz123456, tel 7229999999)', null, '1.0.0', 'android');
select actuar_como_servicio();
select is((select conteo from errores_app limit 1), 2, 'errores: el mismo problema con distintos números e ids se AGRUPA y cuenta' );
select is((select count(*)::int from errores_app), 1, 'errores: sigue siendo una sola fila (crece con los problemas distintos, no con las repeticiones)' );
select actuar_como('00000000-0000-0000-0000-0000000000b2');
select registrar_error_app('error', 'No se pudo cargar la lista (usuario x@y.mx, token eyJabcdefghij.klmnopqrstu.vwxyz123456, tel 7229999999)', null, '1.1.0', 'android');
select registrar_error_app('aviso', '   ', null, '1.0.0', 'android');
select registrar_error_app('inventado', 'Otro problema 42', null, '', 'playstation');
select actuar_como_servicio();
select is((select count(*)::int from errores_app), 3, 'errores: otra versión es otro grupo; un mensaje vacío no crea nada; un nivel desconocido se trata como error' );
select is((select plataforma from errores_app where mensaje = 'Otro problema 42'), 'otro', 'errores: una plataforma desconocida queda como «otro»' );
select is((select version_app from errores_app where mensaje = 'Otro problema 42'), '?', 'errores: una versión vacía queda como «?»' );
select actuar_como('00000000-0000-0000-0000-0000000000b2');
select registrar_error_app('error', repeat('x', 5000), repeat('y', 5000), '1.0.0', 'ios');
select actuar_como_servicio();
select is((select char_length(mensaje) from errores_app where plataforma = 'ios'), 300, 'errores: el mensaje se acota a 300' );
select is((select char_length(detalle) from errores_app where plataforma = 'ios'), 500, 'errores: el detalle se acota a 500' );

-- Sin sesión no se registra; el cliente anónimo ni siquiera puede ejecutarla.
select is(has_function_privilege('anon', 'public.registrar_error_app(text, text, text, text, text)', 'execute'), false, 'errores: anon no puede registrar' );
select actuar_como('00000000-0000-0000-0000-0000000000b2');
select throws_ok($$select * from errores_app$$, '42501', null, 'errores: el cliente NO lee la tabla' );
select throws_ok($$select * from admin_listar_errores('00000000-0000-0000-0000-0000000000a1')$$, '42501', null, 'errores: ni el listado del panel (es de servicio)' );

-- Cuota diaria: pasado el tope no se registra más y no se produce un error nuevo.
select actuar_como_servicio();
delete from cuotas_uso where usuario_id = '00000000-0000-0000-0000-0000000000e9' and recurso = 'error_app';
select actuar_como('00000000-0000-0000-0000-0000000000e9');
select lives_ok($$select registrar_error_app('error', 'bucle ' || g, null, '2.0.0', 'android') from generate_series(1, 60) g$$,
  'errores: 60 llamadas seguidas no revientan (la cuota las absorbe)' );
select actuar_como_servicio();
select is((select coalesce(sum(conteo), 0)::int from errores_app where version_app = '2.0.0'), 40, 'errores: la cuota de 40 por cuenta y día se cumple (los 60 «bucle N» son UN problema agrupado, contado 40 veces)' );

-- Panel de admin.
select is((select count(*)::int from admin_listar_errores('00000000-0000-0000-0000-0000000000a1')), (select count(*)::int from errores_app where ultima_vez > now() - interval '7 days'), 'panel: un admin ve los errores de la última semana' );
select throws_ok($$select * from admin_listar_errores('00000000-0000-0000-0000-0000000000e9')$$, 'CP007', null, 'panel: quien no es admin recibe CP007' );
select lives_ok($$select admin_borrar_error('00000000-0000-0000-0000-0000000000a1', (select id from errores_app where mensaje = 'Otro problema 42'))$$, 'panel: un admin borra un grupo' );
select is((select count(*)::int from errores_app where mensaje = 'Otro problema 42'), 0, 'panel: y desaparece' );
select is((select count(*)::int from acciones_admin where accion = 'borrar_error'), 1, 'panel: queda en la bitácora' );
select throws_ok($$select admin_borrar_error('00000000-0000-0000-0000-0000000000a1', gen_random_uuid())$$, 'P0002', null, 'panel: borrar lo que no existe se dice' );
select throws_ok($$select admin_borrar_error('00000000-0000-0000-0000-0000000000e9', gen_random_uuid())$$, 'CP007', null, 'panel: quien no es admin no borra' );

-- Limpieza programada.
update errores_app set ultima_vez = now() - interval '31 days' where version_app = '1.1.0';
select limpiar_errores_app();
select is((select count(*)::int from errores_app where version_app = '1.1.0'), 0, 'limpieza: lo que no se repite en 30 días se borra' );
select is((select coalesce(sum(conteo), 0)::int from errores_app where version_app = '2.0.0'), 40, 'limpieza: lo reciente se conserva' );
select is((select count(*)::int from cron.job where jobname = 'limpiar-errores-app'), 1, 'limpieza: está programada' );

-- ── Códigos postales (0069) ─────────────────────────────────────────────────
select actuar_como_servicio();
insert into codigos_postales (cp, estado, municipio, ciudad, asentamiento, tipo) values
  ('52044', 'México', 'Lerma', 'Santa María Atarasquillo', 'Santa María Atarasquillo', 'Pueblo'),
  ('52044', 'México', 'Lerma', 'Santa María Atarasquillo', 'Barrio La Concepción', 'Barrio'),
  ('06000', 'Ciudad de México', 'Cuauhtémoc', 'Ciudad de México', 'Centro (Área 1)', 'Colonia'),
  ('01000', 'Ciudad de México', 'Álvaro Obregón', null, 'San Ángel', 'Colonia');
select actuar_como('00000000-0000-0000-0000-0000000000b2');
select is((select colonias from buscar_codigo_postal('52044')), array['Barrio La Concepción', 'Santa María Atarasquillo'],
  'cp: devuelve TODAS las colonias del código, ordenadas' );
select is((select estado || ' / ' || municipio || ' / ' || ciudad from buscar_codigo_postal('52044')), 'México / Lerma / Santa María Atarasquillo',
  'cp: y el estado, municipio y ciudad' );
select is((select count(*)::int from buscar_codigo_postal('06000')), 1, 'cp: UNA fila por código' );
select is((select ciudad from buscar_codigo_postal('01000')), null, 'cp: sin ciudad queda nulo (no se inventa)' );
select is((select count(*)::int from buscar_codigo_postal('99999')), 0, 'cp: un código que no existe devuelve cero filas, no un error' );
select is((select count(*)::int from buscar_codigo_postal(' 06000 ')), 1, 'cp: recorta espacios' );
select throws_ok($$select * from buscar_codigo_postal('0600')$$, '22023', null, 'cp: un código de 4 dígitos se rechaza' );
select throws_ok($$select * from buscar_codigo_postal('06000; drop table usuarios')$$, '22023', null, 'cp: una cadena rara se rechaza (no llega a la consulta)' );
select throws_ok($$select * from buscar_codigo_postal('abcde')$$, '22023', null, 'cp: letras se rechazan' );
select throws_ok($$select * from buscar_codigo_postal(null)$$, '22023', null, 'cp: nulo se rechaza' );
select throws_ok($$select * from codigos_postales$$, '42501', null, 'cp: la tabla NO se lee desde el cliente (solo por la RPC)' );
select throws_ok($$insert into codigos_postales (cp, estado, municipio, asentamiento) values ('11111', 'x', 'x', 'x')$$, '42501', null, 'cp: ni se escribe' );
select is(has_function_privilege('anon', 'public.buscar_codigo_postal(text)', 'execute'), false, 'cp: anon no la ejecuta' );
select actuar_como_servicio();
select throws_ok($$insert into codigos_postales (cp, estado, municipio, asentamiento) values ('1234', 'x', 'x', 'x')$$, '23514', null, 'cp: un código mal formado no entra a la tabla' );

-- ── Horario estructurado y «Abierto ahora» (0070) ───────────────────────────
-- Fechas FIJAS (la regla recibe el instante): lun 19/10/2026, vie 23/10, sáb 24/10, dom 25/10. Hora de México.
select actuar_como_servicio();
insert into categorias_servicio (id, nombre, icono, orden, activa) values ('bus', 'Búsqueda', 'search-outline', 9, true) on conflict (id) do nothing;
insert into negocios (id, categoria_id, nombre, direccion, origen, activo, oculto_por_reportes) values
  ('00000000-0000-0000-0000-00000000d001', 'bus', 'H-Oficina', 'Calle H1', 'sembrado', true, false),
  ('00000000-0000-0000-0000-00000000d002', 'bus', 'H-Bar', 'Calle H2', 'sembrado', true, false),
  ('00000000-0000-0000-0000-00000000d003', 'bus', 'H-Domingo', 'Calle H3', 'sembrado', true, false),
  ('00000000-0000-0000-0000-00000000d004', 'bus', 'H-24h', 'Calle H4', 'sembrado', true, false),
  ('00000000-0000-0000-0000-00000000d005', 'bus', 'H-SinHorario', 'Calle H5', 'sembrado', true, false),
  ('00000000-0000-0000-0000-00000000d006', 'bus', 'H-Partido', 'Calle H6', 'sembrado', true, false),
  ('00000000-0000-0000-0000-00000000d007', 'bus', 'H-Oculto', 'Calle H7', 'sembrado', true, true);
-- Oficina: lun–vie 09:00–18:00. Bar: vie 20:00–02:00 (cruza). Domingo: dom 22:00–03:00 (cruza hacia el LUNES). 24h: todos los días 00:00–23:59.
-- Partido: lun 09:00–14:00 y 16:00–20:00. Oculto: lun 09:00–18:00 (pero no es visible).
insert into negocio_horarios (negocio_id, dia, abre, cierra)
select '00000000-0000-0000-0000-00000000d001', d, '09:00', '18:00' from generate_series(1, 5) d;
insert into negocio_horarios (negocio_id, dia, abre, cierra) values
  ('00000000-0000-0000-0000-00000000d002', 5, '20:00', '02:00'),
  ('00000000-0000-0000-0000-00000000d003', 7, '22:00', '03:00'),
  ('00000000-0000-0000-0000-00000000d006', 1, '09:00', '14:00'), ('00000000-0000-0000-0000-00000000d006', 1, '16:00', '20:00'),
  ('00000000-0000-0000-0000-00000000d007', 1, '09:00', '18:00');
insert into negocio_horarios (negocio_id, dia, abre, cierra) select '00000000-0000-0000-0000-00000000d004', d, '00:00', '23:59' from generate_series(1, 7) d;

select is(negocio_abierto_en('00000000-0000-0000-0000-00000000d001', (timestamp '2026-10-19 10:00' at time zone 'America/Mexico_City')), true, 'horario: lunes 10:00 la oficina está ABIERTA' );
select is(negocio_abierto_en('00000000-0000-0000-0000-00000000d001', (timestamp '2026-10-19 09:00' at time zone 'America/Mexico_City')), true, 'horario: a la hora exacta de apertura ya está abierta' );
select is(negocio_abierto_en('00000000-0000-0000-0000-00000000d001', (timestamp '2026-10-19 18:00' at time zone 'America/Mexico_City')), false, 'horario: a la hora exacta de cierre YA está cerrada (el cierre es exclusivo)' );
select is(negocio_abierto_en('00000000-0000-0000-0000-00000000d001', (timestamp '2026-10-19 08:59' at time zone 'America/Mexico_City')), false, 'horario: un minuto antes de abrir, cerrada' );
select is(negocio_abierto_en('00000000-0000-0000-0000-00000000d001', (timestamp '2026-10-24 10:00' at time zone 'America/Mexico_City')), false, 'horario: sábado 10:00 la oficina (solo lun–vie) está cerrada' );
select is(negocio_abierto_en('00000000-0000-0000-0000-00000000d002', (timestamp '2026-10-23 21:00' at time zone 'America/Mexico_City')), true, 'horario: el bar abre el viernes 20:00 y a las 21:00 está abierto' );
select is(negocio_abierto_en('00000000-0000-0000-0000-00000000d002', (timestamp '2026-10-24 01:00' at time zone 'America/Mexico_City')), true, 'horario: y el SÁBADO a la 01:00 sigue abierto (turno del viernes que cruza la medianoche)' );
select is(negocio_abierto_en('00000000-0000-0000-0000-00000000d002', (timestamp '2026-10-24 02:00' at time zone 'America/Mexico_City')), false, 'horario: a las 02:00 cierra' );
select is(negocio_abierto_en('00000000-0000-0000-0000-00000000d002', (timestamp '2026-10-24 21:00' at time zone 'America/Mexico_City')), false, 'horario: el sábado por la noche NO abre (solo declaró el viernes)' );
select is(negocio_abierto_en('00000000-0000-0000-0000-00000000d002', (timestamp '2026-10-23 19:59' at time zone 'America/Mexico_City')), false, 'horario: el viernes antes de las 20:00, cerrado' );
select is(negocio_abierto_en('00000000-0000-0000-0000-00000000d003', (timestamp '2026-10-25 23:00' at time zone 'America/Mexico_City')), true, 'horario: domingo 23:00 abierto' );
select is(negocio_abierto_en('00000000-0000-0000-0000-00000000d003', (timestamp '2026-10-26 01:00' at time zone 'America/Mexico_City')), true, 'horario: y el LUNES 01:00 sigue abierto (el domingo cruza hacia el lunes: la semana se cierra en círculo)' );
select is(negocio_abierto_en('00000000-0000-0000-0000-00000000d003', (timestamp '2026-10-26 03:00' at time zone 'America/Mexico_City')), false, 'horario: lunes 03:00 cerrado' );
select is(negocio_abierto_en('00000000-0000-0000-0000-00000000d004', (timestamp '2026-10-21 03:00' at time zone 'America/Mexico_City')), true, 'horario: 24 horas, de madrugada, abierto' );
select is(negocio_abierto_en('00000000-0000-0000-0000-00000000d005', (timestamp '2026-10-19 10:00' at time zone 'America/Mexico_City')), null, 'horario: sin horario estructurado devuelve NULO (no sé), no «cerrado»' );
select is(negocio_abierto_en('00000000-0000-0000-0000-00000000d006', (timestamp '2026-10-19 12:00' at time zone 'America/Mexico_City')), true, 'horario: dos turnos en el día, dentro del primero' );
select is(negocio_abierto_en('00000000-0000-0000-0000-00000000d006', (timestamp '2026-10-19 15:00' at time zone 'America/Mexico_City')), false, 'horario: en el hueco entre turnos, cerrado' );
select is(negocio_abierto_en('00000000-0000-0000-0000-00000000d006', (timestamp '2026-10-19 17:00' at time zone 'America/Mexico_City')), true, 'horario: dentro del segundo turno' );
select is(negocio_abierto_en(gen_random_uuid(), now()), null, 'horario: un negocio que no existe devuelve nulo' );

-- La zona horaria es la de México, no la del servidor: 16:00 UTC del lunes son las 10:00 en México.
select is(negocio_abierto_en('00000000-0000-0000-0000-00000000d001', timestamptz '2026-10-19 16:00:00+00'), true, 'zona: 16:00 UTC = 10:00 en México (abierto)' );
select is(negocio_abierto_en('00000000-0000-0000-0000-00000000d001', timestamptz '2026-10-19 10:00:00+00'), false, 'zona: 10:00 UTC = 04:00 en México (cerrado, aunque «10:00» sea la hora de apertura en otro huso)' );

-- La vista pública y la lista.
select actuar_como('00000000-0000-0000-0000-0000000000b2');
select ok(exists (select 1 from information_schema.columns where table_name = 'negocios_publicos' and column_name = 'abierto_ahora'), 'vista: negocios_publicos expone abierto_ahora' );
select is((select count(*)::int from negocio_horarios_publicos where negocio_id = '00000000-0000-0000-0000-00000000d001'), 5, 'vista: los turnos de un negocio visible se leen' );
select is((select count(*)::int from negocio_horarios_publicos where negocio_id = '00000000-0000-0000-0000-00000000d007'), 0, 'vista: los turnos de un negocio OCULTO no' );
select is((select abierto_ahora from negocios_ordenados('bus', 'H-SinHorario')), null, 'lista: sin horario, abierto_ahora es nulo' );
select is((select count(*)::int from negocios_ordenados('bus', 'H-', 100, true) where abierto_ahora is not true), 0, 'filtro: «solo abiertos» NUNCA devuelve uno cerrado ni uno sin horario' );
select is((select count(*)::int from negocios_ordenados('bus', 'H-Oculto', 100)), 0, 'lista: un negocio oculto no aparece' );
select is((select count(*)::int from negocio_horarios), 0, 'tabla: RLS deja a la persona leer SOLO los turnos de sus propios negocios (de otros, cero filas: lo público va por la vista)' );

-- Quién puede guardar el horario.
select actuar_como_servicio();
select is((select count(*)::int from negocios where usuario_id = '00000000-0000-0000-0000-0000000000f7'), (select count(*)::int from negocios where usuario_id = '00000000-0000-0000-0000-0000000000f7'), 'fixture: f7 tiene negocios (de la 0052)' );
select actuar_como('00000000-0000-0000-0000-0000000000f7');
select lives_ok($$select guardar_horario((select id from negocios where usuario_id = '00000000-0000-0000-0000-0000000000f7' limit 1), '[{"dia":1,"abre":"09:00","cierra":"18:00"},{"dia":2,"abre":"20:00","cierra":"02:00"}]'::jsonb)$$,
  'guardar: la dueña guarda su horario' );
select is((select count(*)::int from negocio_horarios where negocio_id = (select id from negocios where usuario_id = '00000000-0000-0000-0000-0000000000f7' limit 1)), 2, 'guardar: quedan sus dos turnos' );
select lives_ok($$select guardar_horario((select id from negocios where usuario_id = '00000000-0000-0000-0000-0000000000f7' limit 1), '[{"dia":3,"abre":"10:00","cierra":"12:00"}]'::jsonb)$$,
  'guardar: volver a guardar REEMPLAZA (no acumula)' );
select is((select count(*)::int from negocio_horarios where negocio_id = (select id from negocios where usuario_id = '00000000-0000-0000-0000-0000000000f7' limit 1)), 1, 'guardar: solo queda el último' );
select lives_ok($$select guardar_horario((select id from negocios where usuario_id = '00000000-0000-0000-0000-0000000000f7' limit 1), '[]'::jsonb)$$, 'guardar: una lista vacía borra el horario (vuelve a «no sé»)' );
select throws_ok($$select guardar_horario((select id from negocios where usuario_id = '00000000-0000-0000-0000-0000000000f7' limit 1), '[{"dia":8,"abre":"09:00","cierra":"18:00"}]'::jsonb)$$, '22023', null, 'guardar: un día fuera de 1–7 se rechaza' );
select throws_ok($$select guardar_horario((select id from negocios where usuario_id = '00000000-0000-0000-0000-0000000000f7' limit 1), '[{"dia":1,"abre":"25:00","cierra":"18:00"}]'::jsonb)$$, '22023', null, 'guardar: una hora inválida se rechaza' );
select throws_ok($$select guardar_horario((select id from negocios where usuario_id = '00000000-0000-0000-0000-0000000000f7' limit 1), '[{"dia":1,"abre":"09:00","cierra":"09:00"}]'::jsonb)$$, '22023', null, 'guardar: abrir y cerrar a la misma hora se rechaza' );
select throws_ok($$select guardar_horario((select id from negocios where usuario_id = '00000000-0000-0000-0000-0000000000f7' limit 1), '{"dia":1}'::jsonb)$$, '22023', null, 'guardar: lo que no es una lista se rechaza' );
select throws_ok($$select guardar_horario((select id from negocios where usuario_id = '00000000-0000-0000-0000-0000000000f7' limit 1), (select jsonb_agg(jsonb_build_object('dia', 1, 'abre', '09:00', 'cierra', '10:00')) from generate_series(1, 22)))$$, '22023', null, 'guardar: más de 21 turnos se rechaza' );
select actuar_como('00000000-0000-0000-0000-0000000000b2');
select throws_ok($$select guardar_horario((select id from negocios where usuario_id = '00000000-0000-0000-0000-0000000000f7' limit 1), '[{"dia":1,"abre":"09:00","cierra":"18:00"}]'::jsonb)$$, '42501', null,
  'guardar: OTRA cuenta no puede poner el horario de un negocio ajeno' );
select actuar_como_servicio();
select is(has_function_privilege('anon', 'public.guardar_horario(uuid, jsonb)', 'execute'), false, 'guardar: anon no puede' );

-- ═══════ Personalización con favoritos y «Parecidos a este» (0071) ═══════
-- Vectores en 2 dimensiones (el resto en cero): perfil de a1 = (1,0); favorito F = (0,1); A es casi F; B es casi el perfil.
select actuar_como_servicio();
update publicaciones set activa = false;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000fa', 'authenticated', 'authenticated', 'fa@test.mx', '', now(), now(),
        '{"nombre_usuario":"usuario_fa","nombre_completo":"Fabiola Prueba"}');
create function pg_temp.v2(x float8, y float8) returns vector language sql as $$
  select ('[' || x || ',' || y || ',' || array_to_string(array_fill(0::float8, array[382]), ',') || ']')::vector $$;
insert into publicaciones (id, usuario_id, titulo, tipo, direccion, precio_renta, whatsapp, latitud, longitud, vector_embedding) values
  ('00000000-0000-0000-0000-0000fe5a0001', '00000000-0000-0000-0000-0000000000fa', 'Fav E1',  'depa', 'Calle E9 1', 2800, '5512345678', 19.29, -99.56, pg_temp.v2(0, 1)),
  ('00000000-0000-0000-0000-0000fe5a0002', '00000000-0000-0000-0000-0000000000fa', 'Cerca de la favorita', 'depa', 'Calle E9 2', 2800, '5512345678', 19.29, -99.56, pg_temp.v2(0.1, 0.99499)),
  ('00000000-0000-0000-0000-0000fe5a0003', '00000000-0000-0000-0000-0000000000fa', 'Cerca de mi perfil', 'depa', 'Calle E9 3', 2800, '5512345678', 19.29, -99.56, pg_temp.v2(0.99499, 0.1));
update usuarios set perfil_vector = pg_temp.v2(1, 0) where id = '00000000-0000-0000-0000-0000000000a1';
select actuar_como('00000000-0000-0000-0000-0000000000a1');

select is((select count(*)::int from sugerencias_con_ranking(30) where parecido_a is not null), 0, 'sin favoritos NO hay «parecido a»' );
create temp table sim_antes as
  select id, similitud from sugerencias_con_ranking(30);
grant select on sim_antes to authenticated;

select actuar_como_servicio();
insert into favoritos (usuario_id, publicacion_id) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000fe5a0001');
select actuar_como('00000000-0000-0000-0000-0000000000a1');

select cmp_ok((select similitud from sugerencias_con_ranking(30) where id = '00000000-0000-0000-0000-0000fe5a0002'),
              '>', (select similitud from sim_antes where id = '00000000-0000-0000-0000-0000fe5a0002'),
              'guardar un favorito SUBE la similitud de lo parecido a él' );
select cmp_ok((select similitud from sugerencias_con_ranking(30) where id = '00000000-0000-0000-0000-0000fe5a0003'),
              '<', (select similitud from sim_antes where id = '00000000-0000-0000-0000-0000fe5a0003'),
              'y BAJA la de lo que se parece a tu perfil pero no a lo que guardaste' );
select is((select similitud from sugerencias_con_ranking(30) where id = '00000000-0000-0000-0000-0000fe5a0001'),
          (select similitud from sim_antes where id = '00000000-0000-0000-0000-0000fe5a0001'),
          'una publicación YA guardada no se auto-refuerza' );
select is((select parecido_a from sugerencias_con_ranking(30) where id = '00000000-0000-0000-0000-0000fe5a0002'), 'Fav E1',
          '«parecido a» nombra tu favorito más cercano (coseno ≥ 0.70)' );
select is((select parecido_a from sugerencias_con_ranking(30) where id = '00000000-0000-0000-0000-0000fe5a0003'), null,
          'lo que no se parece a ningún favorito no inventa explicación' );
select is((select parecido_a from sugerencias_con_ranking(30) where id = '00000000-0000-0000-0000-0000fe5a0001'), null,
          'una publicación no es «parecida» a sí misma' );
select is((select score_final from afinidad_de('00000000-0000-0000-0000-0000fe5a0002'::uuid)),
          (select score_final from sugerencias_con_ranking(30) where id = '00000000-0000-0000-0000-0000fe5a0002'),
          'la ficha y la lista dan el MISMO número también con favoritos' );
select is((select parecido_a from afinidad_de('00000000-0000-0000-0000-0000fe5a0002'::uuid)), 'Fav E1', 'la ficha dice el mismo «parecido a»' );

-- Los favoritos son PRIVADOS: los de a1 no mueven la lista de otra cuenta.
select actuar_como('00000000-0000-0000-0000-0000000000b2');
select is((select count(*)::int from sugerencias_con_ranking(30) where parecido_a is not null), 0, 'los favoritos de a1 no producen «parecido a» para b2' );

-- Parecidos a este.
select actuar_como('00000000-0000-0000-0000-0000000000a1');
select is((select array_agg(id order by similitud desc) from publicaciones_parecidas('00000000-0000-0000-0000-0000fe5a0001'::uuid)),
          array['00000000-0000-0000-0000-0000fe5a0002']::uuid[],
          'parecidas: solo lo que pasa el umbral 0.60 (B, a 0.1, queda fuera), sin la misma' );
select is((select count(*)::int from publicaciones_parecidas('00000000-0000-0000-0000-0000fe5a0001'::uuid, 0)), 1, 'parecidas: el límite se acota por abajo a 1' );
select actuar_como('00000000-0000-0000-0000-0000000000fa');
select is((select count(*)::int from publicaciones_parecidas('00000000-0000-0000-0000-0000fe5a0001'::uuid)), 0, 'parecidas: nunca devuelve las publicaciones de quien pregunta' );
select actuar_como_servicio();
update publicaciones set activa = false where id = '00000000-0000-0000-0000-0000fe5a0002';
select actuar_como('00000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from publicaciones_parecidas('00000000-0000-0000-0000-0000fe5a0001'::uuid)), 0, 'parecidas: una publicación inactiva no aparece' );
select is(has_function_privilege('anon', 'public.publicaciones_parecidas(uuid, int)', 'execute'), false, 'parecidas: anon no puede' );
select actuar_como_servicio();
select is(has_function_privilege('authenticated', 'public.afinidad_de_para(uuid, uuid)', 'execute'), false, 'afinidad_de_para sigue cerrada al cliente' );

-- ═══════ Centro de notificaciones (0072) ═══════
select actuar_como_servicio();
select ok((select count(*) from notificaciones where usuario_id = '00000000-0000-0000-0000-0000000000f7' and tipo = 'resena_nueva') >= 1,
  'una reseña nueva avisa al DUEÑO del negocio' );
select ok((select bool_and(contenido like 'Nueva reseña de % ★ en «Tienda F7»' and destino like 'negocio:%')
             from notificaciones where usuario_id = '00000000-0000-0000-0000-0000000000f7' and tipo = 'resena_nueva'),
  'el aviso dice la calificación y el negocio, y lleva al negocio; no dice quién reseñó' );
select is((select count(*)::int from notificaciones where usuario_id = '00000000-0000-0000-0000-0000000000b2' and tipo = 'resena_nueva'), 0,
  'quien reseña no recibe aviso de su propia reseña' );

-- Se parte de cero en estos dos tipos: bloques anteriores ya movieron estados y respondieron reseñas.
delete from notificaciones where tipo in ('verificacion_resuelta', 'resena_respondida');

-- Verificación resuelta: pendiente → rechazado avisa a la persona, con destino a su verificación.
update roles_usuario set estado = 'pendiente' where usuario_id = '00000000-0000-0000-0000-0000000000f7' and rol = 'comerciante';
select is((select count(*)::int from notificaciones where usuario_id = '00000000-0000-0000-0000-0000000000f7' and tipo = 'verificacion_resuelta'), 0,
  'pasar a pendiente NO avisa (solo el resultado)' );
update roles_usuario set estado = 'rechazado' where usuario_id = '00000000-0000-0000-0000-0000000000f7' and rol = 'comerciante';
select is((select destino from notificaciones where usuario_id = '00000000-0000-0000-0000-0000000000f7' and tipo = 'verificacion_resuelta'), 'verificacion:comerciante',
  'rechazar una verificación pendiente avisa y lleva a la verificación' );
update roles_usuario set estado = 'rechazado' where usuario_id = '00000000-0000-0000-0000-0000000000f7' and rol = 'comerciante';
select is((select count(*)::int from notificaciones where usuario_id = '00000000-0000-0000-0000-0000000000f7' and tipo = 'verificacion_resuelta'), 1,
  'volver a guardar el mismo estado NO duplica el aviso' );

-- Reseña respondida: avisa a quien reseñó.
update resenas set respuesta = 'Gracias por venir' where usuario_id = '00000000-0000-0000-0000-0000000000b2' and negocio_id is not null;
select ok((select count(*) from notificaciones where usuario_id = '00000000-0000-0000-0000-0000000000b2' and tipo = 'resena_respondida') >= 1,
  'responder una reseña avisa a quien la escribió' );
create temp table avisos_antes as select count(*)::int as n from notificaciones where usuario_id = '00000000-0000-0000-0000-0000000000b2' and tipo = 'resena_respondida';
update resenas set respuesta = 'Gracias por venir' where usuario_id = '00000000-0000-0000-0000-0000000000b2' and negocio_id is not null;
select is((select count(*)::int from notificaciones where usuario_id = '00000000-0000-0000-0000-0000000000b2' and tipo = 'resena_respondida'), (select n from avisos_antes),
  'repetir la misma respuesta no avisa otra vez' );

-- Privilegios: la persona solo puede marcar como leída.
select actuar_como('00000000-0000-0000-0000-0000000000f7');
select ok((select count(*) from notificaciones) >= 2, 'la persona lee SUS avisos' );
select is((select count(*)::int from notificaciones where usuario_id <> '00000000-0000-0000-0000-0000000000f7'), 0, 'y ninguno ajeno' );
select throws_ok($$update notificaciones set contenido = 'reescrito' where usuario_id = '00000000-0000-0000-0000-0000000000f7'$$, '42501', null,
  'no puede reescribir el contenido de un aviso' );
select throws_ok($$update notificaciones set tipo = 'nuevo_mensaje' where usuario_id = '00000000-0000-0000-0000-0000000000f7'$$, '42501', null,
  'no puede cambiar el tipo' );
select throws_ok($$insert into notificaciones (usuario_id, tipo, contenido) values ('00000000-0000-0000-0000-0000000000f7', 'resena_nueva', 'falso')$$, '42501', null,
  'no puede fabricarse avisos' );
select throws_ok($$delete from notificaciones where usuario_id = '00000000-0000-0000-0000-0000000000f7'$$, '42501', null,
  'no puede borrar avisos' );
select lives_ok($$update notificaciones set leida = true where usuario_id = '00000000-0000-0000-0000-0000000000f7'$$, 'sí puede marcarlos como leídos' );
select is((select count(*)::int from notificaciones where not leida), 0, 'y quedan leídos' );
select actuar_como('00000000-0000-0000-0000-0000000000b2');
select is((select count(*)::int from notificaciones where usuario_id = '00000000-0000-0000-0000-0000000000f7'), 0, 'otra cuenta no ve los avisos de f7' );

-- Retención.
select actuar_como_servicio();
insert into notificaciones (usuario_id, tipo, contenido, creado_en) values
  ('00000000-0000-0000-0000-0000000000f7', 'nuevo_mensaje', 'viejo', now() - interval '20 days'),
  ('00000000-0000-0000-0000-0000000000f7', 'nuevo_mensaje', 'reciente', now() - interval '2 days'),
  ('00000000-0000-0000-0000-0000000000f7', 'nuevo_contacto', 'de hace 100 días', now() - interval '100 days'),
  ('00000000-0000-0000-0000-0000000000f7', 'nuevo_contacto', 'de hace 40 días', now() - interval '40 days');
select limpiar_notificaciones();
select is((select array_agg(contenido order by contenido) from notificaciones where contenido in ('viejo', 'reciente', 'de hace 100 días', 'de hace 40 días')),
  array['de hace 40 días', 'reciente']::text[], 'retención: avisos de mensaje a los 14 días, el resto a los 90' );
select is(has_table_privilege('anon', 'public.notificaciones', 'select'), false, 'anon no lee notificaciones' );
select is(has_function_privilege('authenticated', 'public.limpiar_notificaciones()', 'execute'), false, 'la limpieza no es del cliente' );

-- ═══════ Favoritos de negocios (0073) ═══════
select actuar_como_servicio();
create temp table neg_fav as select (select id from negocios_publicos order by nombre limit 1) as visible,
                                    '00000000-0000-0000-0000-00000000d007'::uuid as oculto;
grant select on neg_fav to authenticated;
select ok((select visible from neg_fav) is not null, 'fixture: hay un negocio visible' );
select is((select count(*)::int from negocios_publicos where id = (select oculto from neg_fav)), 0, 'fixture: el otro NO es visible' );
select is((select relrowsecurity from pg_class where oid = 'public.favoritos_negocios'::regclass), true, 'favoritos_negocios tiene RLS activo' );
select is(has_table_privilege('anon', 'public.favoritos_negocios', 'select'), false, 'anon no lee favoritos de negocios' );
select is((select bool_or(has_table_privilege('authenticated', 'public.favoritos_negocios', p)) from unnest(array['update', 'truncate']) p), false,
  'authenticated no puede actualizar ni truncar favoritos de negocios' );

select actuar_como('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$insert into favoritos_negocios (usuario_id, negocio_id) select '00000000-0000-0000-0000-0000000000a1', visible from neg_fav$$,
  'se guarda un negocio visible' );
select is((select count(*)::int from favoritos_negocios), 1, 'y la cuenta lo ve' );
select throws_ok($$insert into favoritos_negocios (usuario_id, negocio_id) select '00000000-0000-0000-0000-0000000000a1', visible from neg_fav$$,
  '23505', null, 'guardar dos veces el mismo negocio se rechaza por clave única' );
select throws_ok($$insert into favoritos_negocios (usuario_id, negocio_id) select '00000000-0000-0000-0000-0000000000a1', oculto from neg_fav$$,
  '42501', null, 'un negocio oculto se rechaza con 42501' );
select throws_ok($$insert into favoritos_negocios (usuario_id, negocio_id) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000ffff')$$,
  '42501', null, 'uno que no existe da el MISMO error: guardar no sirve de sonda' );

select actuar_como('00000000-0000-0000-0000-0000000000b2');
select is((select count(*)::int from favoritos_negocios), 0, 'otra cuenta no ve los favoritos de negocios de a1' );
select throws_ok($$insert into favoritos_negocios (usuario_id, negocio_id) select '00000000-0000-0000-0000-0000000000a1', visible from neg_fav$$,
  '42501', null, 'no se puede guardar a nombre de otra cuenta' );
select lives_ok($$delete from favoritos_negocios where usuario_id = '00000000-0000-0000-0000-0000000000a1'$$, 'borrar los de otra cuenta no falla...' );
select actuar_como('00000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from favoritos_negocios), 1, '...pero no borra nada' );

-- La fila se conserva si el negocio deja de ser visible.
select actuar_como_servicio();
update negocios set activo = false where id = (select visible from neg_fav);
select is((select count(*)::int from favoritos_negocios where usuario_id = '00000000-0000-0000-0000-0000000000a1'), 1, 'si el negocio se oculta, el favorito se conserva' );
update negocios set activo = true where id = (select visible from neg_fav);

-- Tope de 200 con CP004.
insert into negocios (categoria_id, nombre, direccion, origen, activo, oculto_por_reportes)
select 'comida', 'Tope ' || n, 'Calle T ' || n, 'sembrado', true, false from generate_series(1, 200) n;
insert into favoritos_negocios (usuario_id, negocio_id)
select '00000000-0000-0000-0000-0000000000b2', id from negocios where nombre like 'Tope %' limit 200;
select actuar_como('00000000-0000-0000-0000-0000000000b2');
select throws_ok($$insert into favoritos_negocios (usuario_id, negocio_id) select '00000000-0000-0000-0000-0000000000b2', visible from neg_fav$$,
  'CP004', null, 'el favorito 201 se rechaza con CP004' );

-- Exportación (derecho de acceso).
select actuar_como('00000000-0000-0000-0000-0000000000a1');
select is(jsonb_array_length(exportar_mis_datos() -> 'favoritos_negocios'), 1, 'exportar_mis_datos incluye los favoritos de negocios' );

-- ═══════ Tablas de servicio sin privilegios para el cliente (0074) ═══════
select actuar_como_servicio();
select is((select bool_or(has_table_privilege(r, 'public.' || t, p))
             from unnest(array['acciones_admin','codigos_postales','configuracion_app','cuotas_uso','errores_app','fotos_huerfanas','geocodificaciones_ritmo','resenas_reportes','verificaciones_biometria']) t,
                  unnest(array['anon','authenticated']) r,
                  unnest(array['select','insert','update','delete','truncate']) p),
  false, 'ninguna tabla de servicio concede privilegios a anon ni a authenticated (el Advisor las lista como «RLS sin policy»)' );
select is(has_table_privilege('service_role', 'public.cuotas_uso', 'select'), true, 'y el servicio sigue pudiendo leer' );

-- ═══════ Integridad del consentimiento (0075) ═══════
-- Hallazgo 1 de la auditoría del 23/10/2026. El cliente podía escribir CUALQUIER versión y CUALQUIER hora de aceptación con
-- un `update` directo (comprobado: 'zzz' y 1999-01-01 quedaban guardadas). La 0046 decía que la hora la pone el servidor y ese
-- camino la esquivaba. Y el camino biométrico solo exigía una cadena de 1 a 20 caracteres.
select actuar_como_servicio();
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        created_at, updated_at, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000f9',
   'authenticated', 'authenticated', 'inexistente@test.mx', '', now(), now(),
   '{"nombre_usuario":"usuario_f9","acepto_aviso":true,"aviso_version":"v99"}');

select is((select version_aviso_aceptada from usuarios where id = '00000000-0000-0000-0000-0000000000f9'), null,
  'alta: una versión con formato válido pero que NO existe no se guarda' );
select isnt((select acepto_aviso_privacidad_en from usuarios where id = '00000000-0000-0000-0000-0000000000f9'), null,
  'alta: la aceptación sí queda, sin versión: la app le pedirá aceptar la vigente' );

select actuar_como('00000000-0000-0000-0000-0000000000f9');
select throws_ok($$select aceptar_aviso('v99')$$, '22023', null,
  'aceptar_aviso: una versión con formato válido pero inexistente se rechaza' );
select lives_ok($$select aceptar_aviso('v2')$$, 'aceptar_aviso: una versión publicada sigue aceptándose' );
select is((select version_aviso_aceptada from usuarios where id = '00000000-0000-0000-0000-0000000000f9'), 'v2',
  'aceptar_aviso: queda la versión publicada' );

select throws_ok($$update usuarios set version_aviso_aceptada = 'zzz' where id = '00000000-0000-0000-0000-0000000000f9'$$,
  'CP014', null, 'el cliente NO escribe la versión aceptada con un update directo' );
select throws_ok($$update usuarios set acepto_aviso_privacidad_en = '1999-01-01' where id = '00000000-0000-0000-0000-0000000000f9'$$,
  'CP014', null, 'el cliente NO escribe la hora de aceptación con un update directo' );
select lives_ok($$update usuarios set nombre_completo = 'Otro Nombre' where id = '00000000-0000-0000-0000-0000000000f9'$$,
  'el resto del perfil sigue editable por su dueño' );
select is((select nombre_completo from usuarios where id = '00000000-0000-0000-0000-0000000000f9'), 'Otro Nombre',
  'y el cambio quedó escrito (no afectó cero filas en silencio)' );

select is(current_setting('app.aviso', true), 'off',
  'aceptar_aviso apaga su marca al escribir: no queda abierta para el resto de la transacción' );

-- Una cuenta sin fila en `usuarios` no puede aceptar el aviso. Protege que el `perform` que apaga la marca no pise FOUND (lo pone en
-- true con su fila y el `if` dejaría de ver que el `update` no tocó nada).
select actuar_como_servicio();
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000fb',
        'authenticated', 'authenticated', 'sinperfil@test.mx', '', now(), now(), '{"nombre_usuario":"usuario_fb"}');
delete from usuarios where id = '00000000-0000-0000-0000-0000000000fb';
select actuar_como('00000000-0000-0000-0000-0000000000fb');
select throws_ok($$select aceptar_aviso('v3')$$, 'CP005', null, 'aceptar_aviso: sin perfil no hay a quién registrar la aceptación' );

select actuar_como_servicio();
select lives_ok($$update usuarios set version_aviso_aceptada = 'v3' where id = '00000000-0000-0000-0000-0000000000f9'$$,
  'el servicio sí puede corregir la versión (scripts de demo y mantenimiento)' );

select throws_ok(
  $$select reservar_intento_biometria('00000000-0000-0000-0000-0000000000e9', 'comerciante', 'zzz')$$,
  '22023', null, 'biometría: una versión con formato raro no cuenta como consentimiento' );
select throws_ok(
  $$select reservar_intento_biometria('00000000-0000-0000-0000-0000000000e9', 'comerciante', 'v99')$$,
  '22023', null, 'biometría: una versión inexistente no cuenta como consentimiento' );

select is(has_function_privilege('authenticated', 'aviso_version_valida(text)', 'execute'), false,
  'aviso_version_valida no es ejecutable por el cliente' );
select is(has_table_privilege('authenticated', 'public.avisos_privacidad', 'select')
       or has_table_privilege('anon', 'public.avisos_privacidad', 'select'), false,
  'avisos_privacidad no concede nada a anon ni a authenticated' );
select is(has_table_privilege('service_role', 'public.avisos_privacidad', 'select'), true,
  'y el servicio sí la lee' );

-- ═══════ Pagos con Mercado Pago: órdenes y registro idempotente (0077) ═══════
-- El SERVIDOR decide plan y monto (desde `planes`), nunca lo que diga Mercado Pago; y el webhook llega duplicado y en paralelo: registrar
-- el mismo pago dos veces no extiende dos veces (idempotente por `mp_payment_id`) ni se pisa con otro (candado de la orden, patrón de la 0076).
select actuar_como_servicio();
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000fc', 'authenticated', 'authenticated', 'mp1@test.mx', '', now(), now(), '{"nombre_usuario":"usuario_fc"}'),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000fd', 'authenticated', 'authenticated', 'mp2@test.mx', '', now(), now(), '{"nombre_usuario":"usuario_fd"}');
insert into roles_usuario (usuario_id, rol, estado) values ('00000000-0000-0000-0000-0000000000fc', 'comerciante', 'aprobado'), ('00000000-0000-0000-0000-0000000000fd', 'comerciante', 'aprobado');
insert into suscripciones (usuario_id, rol, prueba_hasta) values ('00000000-0000-0000-0000-0000000000fc', 'comerciante', now() + interval '15 days'), ('00000000-0000-0000-0000-0000000000fd', 'comerciante', now() + interval '15 days');

create temp table t_orden as select * from crear_orden_pago('00000000-0000-0000-0000-0000000000fc'::uuid, 'comerciante_basico');
select is((select monto from t_orden), 9900, 'orden: el monto sale del catálogo de planes, no de quien la pide' );
select is((select estado from ordenes_pago where id = (select orden_id from t_orden)), 'creada', 'orden: nace «creada»' );
select throws_ok($$select * from crear_orden_pago('00000000-0000-0000-0000-0000000000fc', 'comerciante_gratis')$$, 'CP011', null,
  'orden: un plan gratuito no se paga' );
select throws_ok($$select * from crear_orden_pago('00000000-0000-0000-0000-0000000000fc', 'no_existe')$$, 'CP011', null,
  'orden: un plan inexistente tampoco' );
select throws_ok($$select * from crear_orden_pago('00000000-0000-0000-0000-0000000000a1', 'comerciante_basico')$$, 'CP011', null,
  'orden: sin la función de comerciante APROBADA no hay orden' );
select throws_ok($$select * from crear_orden_pago('00000000-0000-0000-0000-0000000000fc', 'arrendador_plus')$$, 'CP011', null,
  'orden: el plan de otra función (arrendador) tampoco, aunque la cuenta tenga la suya' );

-- Tope de órdenes sin pagar: cada una cuesta una llamada a la API de Mercado Pago.
-- La función va en la lista de selección y no en un `lateral`: con argumentos constantes el planificador la evalúa UNA vez y cruza el resultado
-- (se creaba una sola orden y el `count` daba 10 igual).
select is((select count(*)::int from (select (crear_orden_pago('00000000-0000-0000-0000-0000000000fd'::uuid, 'comerciante_basico')).orden_id
                                        from generate_series(1, 10)) t), 10,
  'orden: caben 10 órdenes sin pagar en una hora' );
select is((select count(*)::int from ordenes_pago where usuario_id = '00000000-0000-0000-0000-0000000000fd'), 10,
  'orden: y de verdad quedaron diez filas (no una evaluada diez veces)' );
select throws_ok($$select * from crear_orden_pago('00000000-0000-0000-0000-0000000000fd', 'comerciante_basico')$$, 'CP015', null,
  'orden: la número 11 en la hora se rechaza (CP015)' );

-- Privilegios: el cliente no crea órdenes ni registra pagos; solo lee las suyas.
select is(has_function_privilege('authenticated', 'crear_orden_pago(uuid,text)', 'execute')
       or has_function_privilege('anon', 'crear_orden_pago(uuid,text)', 'execute'), false,
  'crear_orden_pago no es ejecutable por el cliente' );
select is(has_function_privilege('authenticated', 'registrar_pago_mp(uuid,text,text,integer)', 'execute')
       or has_function_privilege('anon', 'registrar_pago_mp(uuid,text,text,integer)', 'execute'), false,
  'registrar_pago_mp no es ejecutable por el cliente (sería activarse un plan gratis)' );
select actuar_como('00000000-0000-0000-0000-0000000000fc');
select is((select count(*)::int from ordenes_pago), 1, 'cada cuenta lee SOLO sus órdenes (fc ve la suya, no las diez de fd)' );
select throws_ok($$insert into ordenes_pago (usuario_id, rol, plan_id, monto_centavos) values ('00000000-0000-0000-0000-0000000000fc', 'comerciante', 'comerciante_basico', 1)$$,
  '42501', null, 'el cliente no inserta órdenes (con monto a su gusto)' );
select throws_ok($$update ordenes_pago set estado = 'pagada'$$, '42501', null, 'el cliente no marca una orden como pagada' );

-- Registro del pago.
select actuar_como_servicio();
select throws_ok($$select registrar_pago_mp((select orden_id from t_orden), null, 'approved', 9900)$$, '22023', null,
  'registrar: sin el id del pago de Mercado Pago no hay idempotencia posible y se rechaza' );
select is(registrar_pago_mp(gen_random_uuid(), 'mp-x', 'approved', 9900), 'orden_inexistente', 'registrar: una orden que no existe no activa nada' );

select is(registrar_pago_mp((select orden_id from t_orden), 'mp-1', 'pending', 9900), 'pendiente', 'registrar: pendiente (OXXO) se reconoce como pendiente' );
select is((select estado from ordenes_pago where id = (select orden_id from t_orden)), 'pendiente', 'registrar: la orden queda «pendiente»' );
select is((select count(*)::int from pagos where usuario_id = '00000000-0000-0000-0000-0000000000fc'), 0, 'registrar: un pago pendiente NO se registra como pago ni extiende nada' );
select is((select vigente_hasta from suscripciones where usuario_id = '00000000-0000-0000-0000-0000000000fc'), null, 'registrar: y la suscripción sigue sin periodo pagado' );

select is(registrar_pago_mp((select orden_id from t_orden), 'mp-2', 'approved', 100), 'monto_distinto', 'registrar: un monto distinto al de la orden NO activa el plan' );
select is((select count(*)::int from pagos where usuario_id = '00000000-0000-0000-0000-0000000000fc'), 0, 'registrar: y no deja pago registrado' );

select is(registrar_pago_mp((select orden_id from t_orden), 'mp-1', 'approved', 9900), 'activado', 'registrar: aprobado y con el monto exacto, activa el plan' );
select is((select estado from ordenes_pago where id = (select orden_id from t_orden)), 'pagada', 'registrar: la orden queda «pagada»' );
select is((select origen || ':' || mp_payment_id || ':' || plan_id from pagos where usuario_id = '00000000-0000-0000-0000-0000000000fc'), 'mercadopago:mp-1:comerciante_basico',
  'registrar: el pago queda con su origen, su id de Mercado Pago y el plan de la ORDEN' );
select ok((select vigente_hasta between now() + interval '29 days' and now() + interval '31 days' from suscripciones where usuario_id = '00000000-0000-0000-0000-0000000000fc'),
  'registrar: el plan queda vigente 30 días' );

select is(registrar_pago_mp((select orden_id from t_orden), 'mp-1', 'approved', 9900), 'duplicado', 'registrar: el MISMO pago otra vez (webhook duplicado) no hace nada' );
select is((select count(*)::int from pagos where usuario_id = '00000000-0000-0000-0000-0000000000fc'), 1, 'registrar: y no queda un segundo pago' );
select ok((select vigente_hasta between now() + interval '29 days' and now() + interval '31 days' from suscripciones where usuario_id = '00000000-0000-0000-0000-0000000000fc'),
  'registrar: ni se extiende un segundo periodo' );

select is(registrar_pago_mp((select orden_id from t_orden), 'mp-3', 'pending', 9900), 'pendiente', 'registrar: un pendiente tardío se reconoce' );
select is(registrar_pago_mp((select orden_id from t_orden), 'mp-4', 'rejected', 9900), 'rechazado', 'registrar: un rechazo se reconoce' );
select is((select estado from ordenes_pago where id = (select orden_id from t_orden)), 'pagada', 'registrar: un pendiente o un rechazo NO baja una orden ya pagada' );
select is(registrar_pago_mp((select orden_id from t_orden), 'mp-6', 'refunded', 9900), 'ignorado', 'registrar: un estado que no se maneja (reembolso) se ignora y se dice' );

select is(registrar_pago_mp((select orden_id from t_orden), 'mp-5', 'approved', 9900), 'activado', 'registrar: un segundo pago aprobado distinto activa otro periodo' );
select ok((select vigente_hasta between now() + interval '59 days' and now() + interval '61 days' from suscripciones where usuario_id = '00000000-0000-0000-0000-0000000000fc'),
  'registrar: el segundo periodo se SUMA al primero (60 días)' );
select ok((select count(*) = 1 from pagos a join pagos b on b.usuario_id = a.usuario_id and b.periodo_inicio = a.periodo_fin where a.usuario_id = '00000000-0000-0000-0000-0000000000fc'),
  'registrar: los periodos de los dos pagos quedan encadenados' );

-- ════════════════ 0082 · cuentas de vendedor sin correo universitario ════════════════
-- El filtro `.edu.mx` vivía SOLO en la app: con la llave anónima (que va en el APK) cualquiera daba de alta un Gmail llamando a Auth.
-- Ahora lo exige el hook `before_user_created`, y lo que protege de las cuentas desechables es que una cuenta SIN correo universitario
-- (`cuenta_restringida`) no puede reportar, reseñar ni abrir conversaciones; sí puede responder en las que ya existen.
select actuar_como_servicio();
-- Más arriba esta publicación quedó inactiva. Se vuelve visible para que lo ÚNICO que pueda impedir una reseña o un reporte sea la
-- restricción: si no, las aserciones «no puede» pasarían porque la publicación no se ve, no porque la cuenta esté restringida.
update publicaciones set activa = true, oculta_por_reportes = false where id = '00000000-0000-0000-0000-00000000dea1';
select ok(exists (select 1 from publicaciones_publicas where id = '00000000-0000-0000-0000-00000000dea1'),
  '0082: preparación: la publicación de prueba se ve en la vista pública');

-- 1 · la regla del dominio, igual que `correoUniversitario.ts`
select is(es_correo_universitario('ana@utvtol.edu.mx'), true, '0082: un correo de la UTVT es universitario');
select is(es_correo_universitario('Ana@Otra.EDU.MX'), true, '0082: otra universidad .edu.mx cuenta, sin importar mayúsculas');
select is(es_correo_universitario('ana@gmail.com'), false, '0082: Gmail no es universitario');
select is(es_correo_universitario('ana@edu.mx.atacante.com'), false, '0082: «edu.mx» en medio del dominio no engaña');
select is(es_correo_universitario('ana@edu.mx'), false, '0082: «edu.mx» a secas no es una universidad');
select is(es_correo_universitario(null), false, '0082: sin correo no es universitario');

-- 2 · el alta marca la cuenta por el camino real (sin el trigger de prueba)
alter table usuarios disable trigger zz_t_sin_restriccion;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000ee01', 'authenticated', 'authenticated',
   'est@utvtol.edu.mx', '', now(), now(), '{"nombre_usuario":"est_ee01","nombre_completo":"Estudiante"}'),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000ee02', 'authenticated', 'authenticated',
   'duena@gmail.com', '', now(), now(), '{"nombre_usuario":"vend_ee02","nombre_completo":"Vendedora","tipo_cuenta":"arrendador"}');
-- El alta de un vendedor crea su rol (siempre sin verificar) y no le pide el cuestionario de estudiante.
select is((select rol || ':' || estado || ':' || origen from roles_usuario where usuario_id = '00000000-0000-0000-0000-00000000ee02'), 'arrendador:sin_verificar:solicitud',
  '0082: el alta declarada arrendador crea el rol, sin verificar');
select is((select cuestionario_completo from usuarios where id = '00000000-0000-0000-0000-00000000ee02'), true,
  '0082: y no le pide el cuestionario de estudiante');
select is((select count(*)::int from roles_usuario where usuario_id = '00000000-0000-0000-0000-00000000ee01'), 0,
  '0082: un estudiante no recibe ningún rol de vendedor');
select is((select cuestionario_completo from usuarios where id = '00000000-0000-0000-0000-00000000ee01'), false,
  '0082: y el estudiante sí lo hace');
-- Una cuenta de servicio (la marca va en app_metadata, que solo escribe la clave de servicio) y una que intenta marcarse desde user_metadata.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at, raw_user_meta_data, raw_app_meta_data)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000ee03', 'authenticated', 'authenticated',
   'demo@cuervopass-demo.test', '', now(), now(), '{"nombre_usuario":"demo_ee03"}', '{"sin_restriccion":true}'),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000ee04', 'authenticated', 'authenticated',
   'listo@gmail.com', '', now(), now(), '{"nombre_usuario":"listo_ee04","sin_restriccion":true}', '{}');
alter table usuarios enable trigger zz_t_sin_restriccion;
select is((select cuenta_restringida from usuarios where id = '00000000-0000-0000-0000-00000000ee01'), false,
  '0082: el alta con correo universitario NO queda restringida');
select is((select cuenta_restringida from usuarios where id = '00000000-0000-0000-0000-00000000ee02'), true,
  '0082: el alta con un correo que no es universitario queda restringida');

select is((select cuenta_restringida from usuarios where id = '00000000-0000-0000-0000-00000000ee03'), false,
  '0082: la marca de app_metadata (solo la clave de servicio) deja una cuenta de demo sin restricción');
select is((select cuenta_restringida from usuarios where id = '00000000-0000-0000-0000-00000000ee04'), true,
  '0082: la misma marca en user_metadata (la manda el cliente) NO sirve');

-- Auth escribe app_metadata en un UPDATE posterior al INSERT: la marca tiene que surtir efecto también por ese camino.
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"sin_restriccion":true}'::jsonb
 where id = '00000000-0000-0000-0000-00000000ee04';
select is((select cuenta_restringida from usuarios where id = '00000000-0000-0000-0000-00000000ee04'), false,
  '0082: la marca de servicio que llega en un UPDATE (como la escribe Auth) también levanta la restricción');

-- 3 · la restricción no se quita desde la app
select actuar_como('00000000-0000-0000-0000-00000000ee02');
select throws_ok($$update usuarios set cuenta_restringida = false where id = '00000000-0000-0000-0000-00000000ee02'$$, null, null,
  '0082: una cuenta restringida no se quita la restricción con un update directo');
select actuar_como('00000000-0000-0000-0000-00000000ee01');
select throws_ok($$update usuarios set cuenta_restringida = true where id = '00000000-0000-0000-0000-00000000ee01'$$, null, null,
  '0082: ni una cuenta normal se la pone (la fija solo el servidor)');

-- 4 · el hook de Auth
select actuar_como_servicio();
select is(hook_alta_de_usuario('{"user":{"email":"est@utvtol.edu.mx","user_metadata":{}}}'::jsonb), '{}'::jsonb,
  '0082 hook: un correo universitario pasa');
select is((hook_alta_de_usuario('{"user":{"email":"a@gmail.com","user_metadata":{}}}'::jsonb)->'error'->>'http_code'), '400',
  '0082 hook: un Gmail sin declarar vendedor se rechaza');
select is(hook_alta_de_usuario('{"user":{"email":"a@gmail.com","user_metadata":{"tipo_cuenta":"comerciante"}}}'::jsonb), '{}'::jsonb,
  '0082 hook: un Gmail que se declara comerciante pasa (queda restringido)');
select is((hook_alta_de_usuario('{"user":{"email":"a@gmail.com","user_metadata":{"tipo_cuenta":"admin"}}}'::jsonb)->'error'->>'http_code'), '400',
  '0082 hook: declararse «admin» no abre nada');
select is((hook_alta_de_usuario('{"user":{"user_metadata":{}}}'::jsonb)->'error'->>'http_code'), '400',
  '0082 hook: sin correo se rechaza (falla cerrado)');
select ok(not has_function_privilege('authenticated', 'hook_alta_de_usuario(jsonb)', 'execute')
      and not has_function_privilege('anon', 'hook_alta_de_usuario(jsonb)', 'execute')
      and has_function_privilege('supabase_auth_admin', 'hook_alta_de_usuario(jsonb)', 'execute'),
  '0082 hook: lo ejecuta Auth y nadie más');

-- 5 · lo que una cuenta restringida NO puede
select actuar_como('00000000-0000-0000-0000-00000000ee02');
select throws_ok($$insert into reportes (reportado_por, publicacion_id, motivo)
  values ('00000000-0000-0000-0000-00000000ee02', '00000000-0000-0000-0000-00000000dea1', 'spam')$$, '42501', null,
  '0082: una cuenta restringida no puede reportar');
select throws_ok($$insert into resenas (usuario_id, publicacion_id, estrellas)
  values ('00000000-0000-0000-0000-00000000ee02', '00000000-0000-0000-0000-00000000dea1', 1)$$, '42501', null,
  '0082: una cuenta restringida no puede reseñar');
select throws_ok($$select reportar_resena(gen_random_uuid(), 'spam')$$, 'CP016', null,
  '0082: ni reportar una reseña (la restricción se comprueba ANTES que cualquier otra cosa)');
select throws_ok($$select abrir_conversacion('00000000-0000-0000-0000-0000000000a1')$$, 'CP016', null,
  '0082: no puede abrir una conversación nueva con un estudiante');
select throws_ok($$insert into conversaciones (usuario_a, usuario_b)
  values ('00000000-0000-0000-0000-00000000ee02', '00000000-0000-0000-0000-0000000000a1')$$, '42501', null,
  '0082: ni saltarse abrir_conversacion insertando directo');

-- 6 · lo que SÍ puede: responder donde la buscaron
select actuar_como('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$select abrir_conversacion('00000000-0000-0000-0000-00000000ee02')$$,
  '0082: un estudiante sí abre la conversación con el arrendador');
select actuar_como('00000000-0000-0000-0000-00000000ee02');
select lives_ok($$select abrir_conversacion('00000000-0000-0000-0000-0000000000a1')$$,
  '0082: la cuenta restringida recupera una conversación que YA existe');
select lives_ok($$insert into mensajes (conversacion_id, remitente_id, contenido)
  select id, '00000000-0000-0000-0000-00000000ee02', 'Hola, sí está disponible' from conversaciones
   where usuario_a = least('00000000-0000-0000-0000-0000000000a1'::uuid, '00000000-0000-0000-0000-00000000ee02'::uuid)
     and usuario_b = greatest('00000000-0000-0000-0000-0000000000a1'::uuid, '00000000-0000-0000-0000-00000000ee02'::uuid)$$,
  '0082: y responde en ella');

-- 7 · el control: una cuenta normal conserva todo
select actuar_como('00000000-0000-0000-0000-00000000ee01');
select lives_ok($$insert into reportes (reportado_por, publicacion_id, motivo)
  values ('00000000-0000-0000-0000-00000000ee01', '00000000-0000-0000-0000-00000000dea1', 'spam')$$,
  '0082: una cuenta universitaria sigue pudiendo reportar');
select lives_ok($$insert into resenas (usuario_id, publicacion_id, estrellas)
  values ('00000000-0000-0000-0000-00000000ee01', '00000000-0000-0000-0000-00000000dea1', 4)$$,
  '0082: y reseñar');
select throws_ok($$select reportar_resena(gen_random_uuid(), 'spam')$$, '42501', null,
  '0082: y reportar_resena sigue con su error de siempre para una reseña que no se ve');
select actuar_como_servicio();

-- ════════════════ 0083 · perfil activo: estudiante o vendedor ════════════════
-- La barra de pestañas y la primera vista dependen de qué perfil está usando la persona. El alta lo fija según lo declarado; cambiarlo pasa por
-- `cambiar_perfil_activo`, que no deja pasar a «vendedor» a quien no tiene ninguna función de vendedor (aunque sea sin verificar).
select actuar_como_servicio();
select is((select perfil_activo from usuarios where id = '00000000-0000-0000-0000-00000000ee01'), 'estudiante',
  '0083: el alta de un estudiante deja el perfil activo en «estudiante»');
select is((select perfil_activo from usuarios where id = '00000000-0000-0000-0000-00000000ee02'), 'vendedor',
  '0083: el alta declarada como vendedor deja el perfil activo en «vendedor»');

select actuar_como('00000000-0000-0000-0000-00000000ee01');
select throws_ok($$update usuarios set perfil_activo = 'vendedor' where id = '00000000-0000-0000-0000-00000000ee01'$$, 'CP017', null,
  '0083: el perfil activo no se cambia con un update directo');
select throws_ok($$select cambiar_perfil_activo('vendedor')$$, 'CP017', null,
  '0083: sin ninguna función de vendedor no se puede pasar a «vendedor»');
select throws_ok($$select cambiar_perfil_activo('admin')$$, '22023', null,
  '0083: un perfil que no existe se rechaza');
select lives_ok($$select agregar_funcion('comerciante')$$, '0083: preparación: el estudiante pide la función de comerciante');
select lives_ok($$select cambiar_perfil_activo('vendedor')$$, '0083: con una función de vendedor (aunque sin verificar) sí pasa a «vendedor»');
select actuar_como_servicio();
select is((select perfil_activo from usuarios where id = '00000000-0000-0000-0000-00000000ee01'), 'vendedor',
  '0083: y queda guardado');
select actuar_como('00000000-0000-0000-0000-00000000ee01');
select lives_ok($$select cambiar_perfil_activo('estudiante')$$, '0083: volver a «estudiante» siempre se puede');
select actuar_como_servicio();
select is((select perfil_activo from usuarios where id = '00000000-0000-0000-0000-00000000ee01'), 'estudiante',
  '0083: y queda guardado');
select is((select count(*)::int from roles_usuario where usuario_id = '00000000-0000-0000-0000-00000000ee01'), 1,
  '0083: cambiar de perfil no borra ni toca la función de vendedor');

-- ════════════════ 0084 · la prueba gratis la inicia la persona ════════════════
-- Antes empezaba sola al aprobar la verificación. Ahora la persona la inicia con «Empezar prueba gratis», una sola vez por función, y puede hacerlo antes
-- de verificarse (la verificación gobierna si PUBLICA, no si tiene un plan). Pagar antes de usar la prueba la consume: no se regala gratis lo ya pagado.
select actuar_como('00000000-0000-0000-0000-00000000ee02');
select throws_ok($$select iniciar_prueba('comerciante')$$, 'CP018', null, '0084: sin esa función no se puede iniciar su prueba');
select throws_ok($$select iniciar_prueba('admin')$$, '22023', null, '0084: un rol que no existe se rechaza');
select is((select prueba_disponible from mi_suscripcion('arrendador')), true,
  '0084: antes de iniciarla, la app SABE que la prueba está disponible (para ofrecerla y no rechazarla después)');
-- `x between a and b` evalúa `x` DOS veces, y `iniciar_prueba` no es idempotente a propósito: se llama una vez y el resultado se compara.
select ok((select h between now() + interval '14 days' and now() + interval '16 days' from (select iniciar_prueba('arrendador') as h) t),
  '0084: iniciar la prueba devuelve hasta cuándo dura (15 días), aunque la verificación siga sin hacerse');
select is((select estado from mi_suscripcion('arrendador')), 'prueba', '0084: y desde entonces el plan es el de prueba');
select is((select prueba_disponible from mi_suscripcion('arrendador')), false, '0084: iniciada, ya no está disponible');
select throws_ok($$select iniciar_prueba('arrendador')$$, 'CP019', null, '0084: la prueba se usa UNA sola vez');
-- Pagar antes de usar la prueba la consume: ee01 tiene la función de comerciante y un pago, y nunca inició la prueba.
select actuar_como_servicio();
insert into pagos (usuario_id, rol, plan_id, monto_centavos, origen, periodo_inicio, periodo_fin)
values ('00000000-0000-0000-0000-00000000ee01', 'comerciante', 'comerciante_basico', 9900, 'simulado', now(), now() + interval '30 days');
select actuar_como('00000000-0000-0000-0000-00000000ee01');
select is((select prueba_disponible from mi_suscripcion('comerciante')), false, '0084: quien ya pagó tampoco la tiene disponible');
select throws_ok($$select iniciar_prueba('comerciante')$$, 'CP019', null, '0084: quien ya pagó esa función no recibe además una prueba gratis');
select actuar_como_servicio();
select throws_ok($$select iniciar_prueba('arrendador')$$, '28000', null, '0084: sin sesión no hay prueba que iniciar');
select ok(not has_function_privilege('anon', 'iniciar_prueba(text)', 'execute') and has_function_privilege('authenticated', 'iniciar_prueba(text)', 'execute'),
  '0084: la llama quien tiene sesión y nadie sin ella');



-- ════════════════ 0087 · depas destacados ════════════════
-- Un arrendador con el plan que destaca (Plus, o su prueba) sale en el carrusel «Destacados» de Departamentos. El destacado SALE DEL PLAN, no de una columna que
-- el vendedor escriba: la vista lo calcula con los planes efectivos. La función respeta los mismos filtros duros que las sugerencias (presupuesto, radio, mascotas).
select actuar_como_servicio();
insert into publicaciones (id, usuario_id, titulo, tipo, direccion, precio_renta, whatsapp, latitud, longitud, permite_mascotas)
values ('00000000-0000-0000-0000-00000000dea7', '00000000-0000-0000-0000-0000000000f7', 'Depa F7 destacado', 'depa',
        'Calle Plus 7', 3000, '5512345679', 19.29, -99.56, false);
select is((select destacado from publicaciones_publicas where titulo = 'Depa F7 destacado'), true,
  '0087: la publicación de quien tiene el plan que destaca sale marcada como destacada');
select is((select destacado from publicaciones_publicas where titulo = 'Depa B'), false,
  '0087: la de quien no tiene ese plan no');
select actuar_como('00000000-0000-0000-0000-0000000000a1');
select ok((select count(*) = 1 from destacadas_publicaciones(10) where titulo = 'Depa F7 destacado'),
  '0087: otra persona ve la destacada en la lista de destacados');
select ok((select count(*) = 0 from destacadas_publicaciones(10) where titulo = 'Depa B'),
  '0087: y NO ve las que no son destacadas');
select actuar_como('00000000-0000-0000-0000-0000000000f7');
select ok((select count(*) = 0 from destacadas_publicaciones(10) where titulo = 'Depa F7 destacado'),
  '0087: nadie se ve a sí mismo entre los destacados');
select ok(pg_get_function_result('destacadas_publicaciones(int,text)'::regprocedure) not like '%vector_embedding%',
  '0087: la función no devuelve el vector al cliente');
select ok(not has_function_privilege('anon', 'destacadas_publicaciones(int,text)', 'execute') and has_function_privilege('authenticated', 'destacadas_publicaciones(int,text)', 'execute'),
  '0087: la llama quien tiene sesión y nadie sin ella');


-- ════════════════ 0088 · cuántas personas guardaron mi negocio ════════════════
-- El panel del vendedor dice «te guardaron N». El conteo es SOLO de los negocios del propio vendedor (la tabla de favoritos es privada y nunca dice QUIÉN), así que
-- quien pregunta por un negocio ajeno no recibe ni un cero: no recibe fila.
select actuar_como_servicio();
insert into favoritos_negocios (usuario_id, negocio_id)
values ('00000000-0000-0000-0000-0000000000a1', (select id from negocios where nombre = 'Tienda F7'));
select actuar_como('00000000-0000-0000-0000-0000000000f7');
select is(
  (select total from favoritos_por_negocio(array[(select id from negocios where nombre = 'Tienda F7')])), 1,
  '0088: el dueño ve cuántas personas guardaron su negocio');
select actuar_como('00000000-0000-0000-0000-0000000000a1');
select is(
  (select count(*)::int from favoritos_por_negocio(array[(select id from negocios where nombre = 'Tienda F7')])), 0,
  '0088: quien NO es el dueño no recibe fila (ni siquiera un cero), aunque él mismo lo haya guardado');
select actuar_como_servicio();
select throws_ok($$select * from favoritos_por_negocio(array[gen_random_uuid()])$$, '28000', null, '0088: sin sesión no hay conteo');
select ok(not has_function_privilege('anon', 'favoritos_por_negocio(uuid[])', 'execute') and has_function_privilege('authenticated', 'favoritos_por_negocio(uuid[])', 'execute'),
  '0088: la llama quien tiene sesión y nadie sin ella');

select * from finish();
rollback;
