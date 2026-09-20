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
select plan(86);

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
select is( (select count(*)::int from cuotas_uso), 0,
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
select is( (select count(*)::int from fotos_huerfanas), 0,
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
    'afinidad_de',
    'afinidad_roomie_de',
    'consumir_cuota',
    'contactos_de_mis_publicaciones',
    'distancia_km',
    'exportar_mis_datos',
    'nuevas_esta_semana',
    'resumen_conversaciones',
    'revelar_contacto',
    'score_ajuste',
    'sugerencias_con_ranking',
    'sugerencias_publicaciones',
    'sugerencias_roomies'
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

select * from finish();
rollback;
