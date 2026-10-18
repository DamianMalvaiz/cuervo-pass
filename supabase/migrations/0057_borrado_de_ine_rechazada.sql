-- Borrado de la INE de una verificación RECHAZADA, y devolución del intento biométrico perdido.
--
-- ── El hueco que cierra ─────────────────────────────────────────────────────
-- `resolver_verificacion` (0049, reescrita en 0053) fijaba `ine_borrar_en` solo al APROBAR (30 días). Al rechazar lo dejaba en `null`
-- y el barrido (`barrer-verificaciones`, 0050) solo borra filas CON fecha: una INE rechazada se conservaba para siempre. Es el dato más
-- sensible de la base y el aviso de privacidad promete conservarlo solo mientras hace falta.
--
-- Plazo decidido por el responsable (17/10/2026): **7 días tras el rechazo**, suficiente para ver el motivo y corregir; si la persona
-- reenvía antes, `enviar_verificacion` vuelve a poner la fecha en null: la entrega nueva es otra evidencia y no hereda la fecha de la anterior
-- (los archivos de la entrega anterior quedan huérfanos: ver «Lo que NO resuelve»).
--
-- ── Lo que NO resuelve (dicho, no escondido) ────────────────────────────────
-- · Una verificación que se queda PENDIENTE sin que nadie la revise conserva su INE sin plazo. Es un problema de operación (revisar), y un
--   tope automático decidiría por el admin; queda como decisión abierta.
-- · Al REENVIAR, los archivos de la entrega anterior dejan de estar referenciados por la fila y el barrido ya no los encuentra: quedan
--   huérfanos en el bucket. Hace falta un barrido por carpeta (pendiente, no se resuelve desde SQL: los archivos viven en Storage).
-- · Las filas ya rechazadas antes de esta migración reciben la fecha ahora (relleno de abajo): se borrarán a los 7 días de aplicarla.
--
-- ── Intento biométrico devuelto ─────────────────────────────────────────────
-- `reservar_intento_biometria` (0056) cobra el intento ANTES de llamar al servicio de IA. Si el servicio no responde, la persona perdía uno de sus 5 sin
-- culpa suya. `devolver_intento_biometria` lo restituye; solo `service_role` (la Edge Function) la llama, y nunca baja de 0.
--
-- Reversión:
--   drop function if exists devolver_intento_biometria(uuid, text);
--   -- y volver a crear resolver_verificacion con el cuerpo de la 0053 (rechazo con `ine_borrar_en = null`).

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
  else
    if p_motivo is null or char_length(btrim(p_motivo)) < 3 then
      raise exception 'falta el motivo del rechazo' using errcode = 'CP006';
    end if;
    update roles_usuario set estado = 'rechazado' where usuario_id = p_usuario and rol = p_rol;
    update verificaciones_vendedor
       set revisada_en = now(), revisada_por = p_admin, motivo_rechazo = btrim(p_motivo),
           ine_borrar_en = now() + interval '7 days'
     where usuario_id = p_usuario and rol = p_rol;
  end if;
end;
$$;
revoke execute on function resolver_verificacion(uuid, text, boolean, text, uuid) from public, anon, authenticated;
grant execute on function resolver_verificacion(uuid, text, boolean, text, uuid) to service_role;

-- Relleno: lo ya rechazado y sin fecha (idempotente: solo toca filas sin fecha y con la INE aún sin borrar).
update verificaciones_vendedor v
   set ine_borrar_en = now() + interval '7 days'
  from roles_usuario r
 where r.usuario_id = v.usuario_id and r.rol = v.rol and r.estado = 'rechazado'
   and v.ine_borrar_en is null and v.ine_borrada_en is null;

create or replace function devolver_intento_biometria(p_usuario uuid, p_rol text)
returns smallint
language sql
security definer
set search_path = public
as $$
  update verificaciones_biometria
     set intentos = greatest(intentos - 1, 0)
   where usuario_id = p_usuario and rol = p_rol
  returning intentos;
$$;

revoke execute on function devolver_intento_biometria(uuid, text) from public, anon, authenticated;
grant execute on function devolver_intento_biometria(uuid, text) to service_role;
