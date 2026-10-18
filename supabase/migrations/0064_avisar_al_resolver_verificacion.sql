-- Aviso push al vendedor cuando se resuelve su verificación. Hallazgo M1 de la auditoría del 18/10/2026.
--
-- Hasta aquí quien enviaba su verificación tenía que abrir la app para enterarse de que la habían aprobado o rechazado. Solo los mensajes disparaban
-- push. `resolver_verificacion` (0049, 0053, 0057) ahora manda uno al final de cada rama.
--
-- · El texto NO lleva el motivo del rechazo: una notificación se lee en la pantalla de bloqueo, y el motivo puede mencionar datos de la persona
--   («el domicilio no coincide…»). La notificación dice que hay un motivo y lleva a la pantalla donde se lee.
-- · Nunca tumba la resolución: `enviar_notificacion_push` ya falla en silencio sin token, y aquí además se atrapa cualquier error. Que no se pueda
--   avisar no puede deshacer una aprobación.
-- · El cuerpo de la función es el de la 0057 (aprobar fija 30 días; rechazar, 7), más el aviso. Nada más cambia.
--
-- Reversión: volver a crear la función con el cuerpo de la 0057.

create or replace function resolver_verificacion(
  p_usuario uuid, p_rol text, p_aprobar boolean, p_motivo text, p_admin uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado text;
begin
  if p_admin is null or not exists (
    select 1 from roles_usuario where usuario_id = p_admin and rol = 'admin' and estado = 'aprobado'
  ) then
    raise exception 'responsable no es admin' using errcode = 'CP007';
  end if;

  select estado into v_estado from roles_usuario where usuario_id = p_usuario and rol = p_rol for update;
  if v_estado is distinct from 'pendiente' then
    raise exception 'no hay verificacion pendiente' using errcode = 'CP005';
  end if;

  if p_aprobar then
    update roles_usuario set estado = 'aprobado' where usuario_id = p_usuario and rol = p_rol;
    update verificaciones_vendedor
       set revisada_en = now(), revisada_por = p_admin, motivo_rechazo = null,
           ine_borrar_en = now() + interval '30 days'
     where usuario_id = p_usuario and rol = p_rol;
    insert into suscripciones (usuario_id, rol, prueba_hasta)
    values (p_usuario, p_rol, now() + interval '15 days')
    on conflict (usuario_id, rol) do nothing;

    begin
      perform enviar_notificacion_push(
        p_usuario,
        'Verificación aprobada',
        'Ya puedes publicar como ' || p_rol || '. Tu prueba gratis de 15 días empezó.',
        jsonb_build_object('tipo', 'verificacion', 'rol', p_rol, 'estado', 'aprobada')
      );
    exception when others then
      null;
    end;
  else
    if p_motivo is null or char_length(btrim(p_motivo)) < 3 then
      raise exception 'falta el motivo del rechazo' using errcode = 'CP006';
    end if;
    update roles_usuario set estado = 'rechazado' where usuario_id = p_usuario and rol = p_rol;
    update verificaciones_vendedor
       set revisada_en = now(), revisada_por = p_admin, motivo_rechazo = btrim(p_motivo),
           ine_borrar_en = now() + interval '7 days'
     where usuario_id = p_usuario and rol = p_rol;

    begin
      perform enviar_notificacion_push(
        p_usuario,
        'Verificación rechazada',
        'Abre la app para ver el motivo y volver a enviarla.',
        jsonb_build_object('tipo', 'verificacion', 'rol', p_rol, 'estado', 'rechazada')
      );
    exception when others then
      null;
    end;
  end if;
end;
$$;
revoke execute on function resolver_verificacion(uuid, text, boolean, text, uuid) from public, anon, authenticated;
grant execute on function resolver_verificacion(uuid, text, boolean, text, uuid) to service_role;
