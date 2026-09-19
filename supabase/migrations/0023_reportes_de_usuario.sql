-- Documento maestro v5 · §13 · corrige una omisión de la 0013.
--
-- EL FALLO: reportar a una PERSONA no hacía absolutamente nada.
--
-- `reportarUsuario()` existe en src/services/usuarios.service.ts, la pantalla
-- de perfil ajeno (src/app/perfil/[usuarioId].tsx) lo llama, la fila se inserta
-- en `reportes`, y la app responde «Gracias». Y el trigger empieza así:
--
--   if new.publicacion_id is null then
--     return new;
--   end if;
--
-- Sale sin tocar nada. Nunca. Para nadie. El botón existe, la tabla acepta la
-- fila, el usuario recibe un acuse, y no ocurre absolutamente nada.
--
-- Es el hallazgo AUD-16 que la propia 0013 documenta —«un valor muerto, que es
-- la clase de detalle que delata que el esquema y la lógica se escribieron por
-- separado»— reproducido en la ruta de SEGURIDAD PERSONAL, en un producto donde
-- alguien de dieciocho años queda con un desconocido para ver un departamento.
-- Un botón de seguridad que miente es peor que no tenerlo: produce la sensación
-- de protección sin la protección.
--
-- LA CORRECCIÓN: la misma mecánica que ya existía para publicaciones —contar y
-- ocultar a los tres— aplicada a personas. No se inventa un modelo nuevo.
--
-- Umbral de tres, igual que en publicaciones. Es discutible y se declara: tres
-- cuentas coordinadas pueden suspender a alguien. Con el registro abierto y
-- sin verificación de correo eso es barato, y por eso la ORDEN A.7 (verificar
-- el correo y exigir dominio universitario) es la que de verdad encarece el
-- abuso. Esta migración no lo resuelve; lo deja anotado.
--
-- Lo que NO trae, y hay que decirlo: no hay panel de moderación, ni revisión
-- humana, ni apelación, ni forma de revertir una suspensión desde la app. Se
-- revierte a mano en el SQL Editor:
--
--   update usuarios set suspendido = false, activo = true, reportes_count = 0
--    where id = '<uuid>';
--
-- Reversión:
--   alter table usuarios drop column if exists suspendido, drop column if exists reportes_count;
--   alter table notificaciones drop constraint notificaciones_tipo_check;
--   alter table notificaciones add constraint notificaciones_tipo_check
--     check (tipo in ('nuevo_mensaje','nuevo_contacto','publicacion_oculta'));
--   -- y recrear al_reportar() de la 0013, con su `return new` temprano.

-- ============================================================
-- 1. Columnas
-- ============================================================
alter table usuarios
  add column if not exists reportes_count int not null default 0,
  -- `suspendido` y `activo` son cosas distintas a propósito: `activo` ya existía
  -- y el usuario lo controla (darse de baja); `suspendido` lo pone el sistema y
  -- el usuario no puede quitárselo. Guardar solo `activo = false` perdería la
  -- diferencia entre «se fue» y «lo sacamos», que es justo la que importa
  -- cuando alguien pregunta por qué no aparece.
  add column if not exists suspendido boolean not null default false;

comment on column usuarios.suspendido is
  'Lo pone al_reportar() a los 3 reportes. El usuario NO puede revertirlo: la '
  'policy usuarios_update_propio permite el UPDATE, pero revertirlo a mano desde '
  'la app dejaria el control de moderacion en manos del moderado. Ver trigger '
  'trg_suspension_inmutable mas abajo.';

-- ============================================================
-- 2. El tipo de notificación que faltaba
-- ============================================================
alter table notificaciones drop constraint if exists notificaciones_tipo_check;
alter table notificaciones add constraint notificaciones_tipo_check
  check (tipo in ('nuevo_mensaje','nuevo_contacto','publicacion_oculta','cuenta_suspendida'));

-- ============================================================
-- 3. El trigger, ahora con las DOS ramas
-- ============================================================
create or replace function al_reportar()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_dueno uuid; v_total int;
begin
  -- ── Rama publicación (0013, sin cambios de fondo) ──
  if new.publicacion_id is not null then
    update publicaciones
       set reportes_count = reportes_count + 1,
           oculta_por_reportes = (reportes_count + 1) >= 3
     where id = new.publicacion_id
    returning usuario_id, reportes_count into v_dueno, v_total;

    if v_total = 3 then
      insert into notificaciones (usuario_id, tipo, contenido)
      values (v_dueno, 'publicacion_oculta',
              'Tu publicación se ocultó tras varios reportes y está en revisión.');
    end if;
    return new;
  end if;

  -- ── Rama persona (lo que faltaba) ──
  -- Marca de moderación. `proteger_suspension` (abajo) impide que la propia
  -- persona se quite la suspensión, y se dispara sobre CUALQUIER update de
  -- `usuarios` — incluido este, que corre con el rol `authenticated` de quien
  -- reportó. Sin esta marca, la suspensión se bloquearía a sí misma.
  perform set_config('app.moderacion', 'on', true);

  update usuarios
     set reportes_count = reportes_count + 1,
         suspendido = (reportes_count + 1) >= 3,
         -- `activo = false` es lo que la saca de perfiles_publicos, y con ella
         -- de los perfiles ajenos, de sugerencias_roomies y —por la 0022— de
         -- sus fotos en Storage. La suspensión no necesita tocar nada más:
         -- toda la visibilidad del producto ya cuelga de esa vista.
         activo = case when (reportes_count + 1) >= 3 then false else activo end
   where id = new.usuario_reportado_id
  returning reportes_count into v_total;

  if v_total = 3 then
    insert into notificaciones (usuario_id, tipo, contenido)
    values (new.usuario_reportado_id, 'cuenta_suspendida',
            'Tu cuenta se suspendió tras varios reportes y está en revisión.');

    -- Un roomie activo de una cuenta suspendida seguiría ofreciéndose:
    -- `sugerencias_roomies` filtra por `estado = 'activo'`, no por el dueño.
    update roomies set estado = 'pausado'
     where usuario_id = new.usuario_reportado_id and estado = 'activo';

    -- Y sus publicaciones dejan de mostrarse. No se marcan como reportadas
    -- —no lo están— sino como inactivas, que es lo que la vista mira.
    update publicaciones set activa = false
     where usuario_id = new.usuario_reportado_id and activa = true;
  end if;

  perform set_config('app.moderacion', 'off', true);
  return new;
end;
$$;

drop trigger if exists trg_al_reportar on reportes;
create trigger trg_al_reportar
  after insert on reportes
  for each row execute function al_reportar();

-- ============================================================
-- 4. La suspensión no se la quita el suspendido
-- ============================================================
-- `usuarios_update_propio` (0014) permite a cualquiera actualizar su propia
-- fila. Sin esta barrera, un suspendido hace `update usuarios set suspendido =
-- false, activo = true where id = auth.uid()` y vuelve. Una policy de UPDATE
-- limita FILAS, no COLUMNAS —el mismo motivo por el que la 0012 usa un trigger
-- para la inmutabilidad de los mensajes— así que esto también va en trigger.
create or replace function proteger_suspension()
returns trigger language plpgsql as $$
begin
  -- La escritura de al_reportar() lleva la marca y pasa. Es local a la
  -- transacción (`set_config(..., true)`), así que no sobrevive al commit ni
  -- puede fijarla el cliente para saltarse la barrera: PostgREST no expone
  -- set_config, y un RPC que lo hiciera tendría que existir en el esquema.
  if coalesce(current_setting('app.moderacion', true), 'off') = 'on' then
    return new;
  end if;

  if current_setting('role', true) = 'authenticated' then
    if new.suspendido is distinct from old.suspendido then
      raise exception 'la suspension no se modifica desde la aplicacion';
    end if;
    if old.suspendido and new.activo and not old.activo then
      raise exception 'una cuenta suspendida no se reactiva desde la aplicacion';
    end if;
    if new.reportes_count is distinct from old.reportes_count then
      raise exception 'reportes_count no se modifica desde la aplicacion';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_suspension_inmutable on usuarios;
create trigger trg_suspension_inmutable
  before update on usuarios
  for each row execute function proteger_suspension();
