-- Centro de notificaciones · Fase 1.5 del plan de excelencia.
--
-- ── Qué había ───────────────────────────────────────────────────────────────
-- La tabla `notificaciones` existía desde la 0001, pero solo se escribía por mensajes nuevos, contactos y ocultamientos por reportes, y la app no la
-- leía en ningún sitio. Lo que de verdad le importa a una persona —«te aprobaron la verificación», «tu negocio tiene una reseña»— no avisaba.
--
-- ── Hallazgo de privilegios (se corrige aquí) ───────────────────────────────
-- `authenticated` tenía INSERT, UPDATE y DELETE sobre TODAS las columnas. RLS lo contenía (no hay policy de insert ni de delete), pero la policy de update
-- dejaba a cada persona reescribir `tipo` y `contenido` de sus propias filas. Una notificación es del sistema: la persona solo puede marcarla como leída.
-- Ahora: SELECT, y UPDATE solo de `leida`.
--
-- ── Qué se agrega ───────────────────────────────────────────────────────────
--  · `destino`: a dónde lleva tocarla, como «clase:id» (negocio:<uuid>, publicacion:<uuid>, verificacion:<rol>). La app solo sigue las clases que conoce.
--  · Tres tipos nuevos con su productor, todos en la base (la app no escribe notificaciones):
--      verificacion_resuelta  al pasar `roles_usuario.estado` de pendiente a aprobado o rechazado
--      resena_nueva           al dueño del negocio o de la publicación reseñada (sin decir quién reseñó)
--      resena_respondida      a quien reseñó, cuando el dueño responde
--  · Retención: los avisos de mensaje (que el centro no muestra: ya viven en Chats) se borran a los 14 días; todo lo demás a los 90.
--    Antes crecían sin límite: una fila por mensaje enviado, para siempre.
--
-- Reversión:
--   drop trigger if exists trg_notificar_verificacion on roles_usuario;     drop function if exists notificar_resultado_verificacion();
--   drop trigger if exists trg_notificar_resena_nueva on resenas;           drop function if exists notificar_resena_nueva();
--   drop trigger if exists trg_notificar_resena_respondida on resenas;      drop function if exists notificar_resena_respondida();
--   select cron.unschedule('limpiar-notificaciones'); drop function if exists limpiar_notificaciones();
--   alter table notificaciones drop column if exists destino; (y volver a conceder lo que 0001 dejaba por defecto)
--   restaurar el CHECK de 0023.

-- ── Privilegios ─────────────────────────────────────────────────────────────
revoke all on notificaciones from public, anon, authenticated;
grant select on notificaciones to authenticated;
grant update (leida) on notificaciones to authenticated;

-- ── Tipos y destino ─────────────────────────────────────────────────────────
alter table notificaciones add column if not exists destino text
  check (destino is null or destino ~ '^(negocio|publicacion|verificacion):[A-Za-z0-9_-]{1,64}$');

alter table notificaciones drop constraint if exists notificaciones_tipo_check;
alter table notificaciones add constraint notificaciones_tipo_check
  check (tipo in ('nuevo_mensaje', 'nuevo_contacto', 'publicacion_oculta', 'cuenta_suspendida',
                  'verificacion_resuelta', 'resena_nueva', 'resena_respondida'));

-- La lista del centro: las propias, sin avisos de mensaje, de la más reciente a la más antigua.
create index if not exists notificaciones_centro_idx on notificaciones (usuario_id, creado_en desc) where tipo <> 'nuevo_mensaje';

-- ── Productores ─────────────────────────────────────────────────────────────
create or replace function notificar_resultado_verificacion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.estado = 'pendiente' and new.estado in ('aprobado', 'rechazado') then
    insert into notificaciones (usuario_id, tipo, contenido, destino)
    values (new.usuario_id, 'verificacion_resuelta',
            case when new.estado = 'aprobado'
                 then 'Tu verificación fue aprobada. Ya puedes publicar.'
                 else 'Tu verificación no fue aprobada. Revisa el motivo y vuelve a enviarla.' end,
            'verificacion:' || new.rol);
  end if;
  return new;
end;
$$;
revoke execute on function notificar_resultado_verificacion() from public, anon, authenticated;
drop trigger if exists trg_notificar_verificacion on roles_usuario;
create trigger trg_notificar_verificacion after update of estado on roles_usuario
  for each row execute function notificar_resultado_verificacion();

create or replace function notificar_resena_nueva()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_dueno uuid;
  v_nombre text;
  v_destino text;
begin
  if new.negocio_id is not null then
    select n.usuario_id, n.nombre into v_dueno, v_nombre from negocios n where n.id = new.negocio_id;
    v_destino := 'negocio:' || new.negocio_id;
  else
    select p.usuario_id, p.titulo into v_dueno, v_nombre from publicaciones p where p.id = new.publicacion_id;
    v_destino := 'publicacion:' || new.publicacion_id;
  end if;
  if v_dueno is null or v_dueno = new.usuario_id then
    return new;
  end if;
  insert into notificaciones (usuario_id, tipo, contenido, destino)
  values (v_dueno, 'resena_nueva', 'Nueva reseña de ' || new.estrellas || ' ★ en «' || left(coalesce(v_nombre, ''), 60) || '»', v_destino);
  return new;
end;
$$;
revoke execute on function notificar_resena_nueva() from public, anon, authenticated;
drop trigger if exists trg_notificar_resena_nueva on resenas;
create trigger trg_notificar_resena_nueva after insert on resenas
  for each row execute function notificar_resena_nueva();

create or replace function notificar_resena_respondida()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nombre text;
  v_destino text;
begin
  if new.respuesta is null or new.respuesta is not distinct from old.respuesta then
    return new;
  end if;
  if new.negocio_id is not null then
    select n.nombre into v_nombre from negocios n where n.id = new.negocio_id;
    v_destino := 'negocio:' || new.negocio_id;
  else
    select p.titulo into v_nombre from publicaciones p where p.id = new.publicacion_id;
    v_destino := 'publicacion:' || new.publicacion_id;
  end if;
  insert into notificaciones (usuario_id, tipo, contenido, destino)
  values (new.usuario_id, 'resena_respondida', 'Respondieron a tu reseña de «' || left(coalesce(v_nombre, ''), 60) || '»', v_destino);
  return new;
end;
$$;
revoke execute on function notificar_resena_respondida() from public, anon, authenticated;
drop trigger if exists trg_notificar_resena_respondida on resenas;
create trigger trg_notificar_resena_respondida after update of respuesta on resenas
  for each row execute function notificar_resena_respondida();

-- ── Retención ───────────────────────────────────────────────────────────────
create or replace function limpiar_notificaciones()
returns void language sql security definer set search_path = public as $$
  delete from notificaciones
   where (tipo = 'nuevo_mensaje' and creado_en < now() - interval '14 days')
      or creado_en < now() - interval '90 days';
$$;
revoke execute on function limpiar_notificaciones() from public, anon, authenticated;
grant execute on function limpiar_notificaciones() to service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'limpiar-notificaciones') then
    perform cron.unschedule('limpiar-notificaciones');
  end if;
  perform cron.schedule('limpiar-notificaciones', '47 3 * * *', 'select public.limpiar_notificaciones()');
end $$;
