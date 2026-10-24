-- La prueba gratis la inicia la persona · 24/10/2026.
--
-- ── Qué cambia ──────────────────────────────────────────────────────────────
-- Hasta aquí la prueba empezaba SOLA al aprobar la verificación (0053). En la pantalla de planes eso se veía como un plan ya activo que nadie pidió, y no
-- había nada que tocar para «empezar gratis». Ahora:
--
--   · `iniciar_prueba(rol)`: la persona la inicia con el botón «Empezar prueba gratis». UNA sola vez por función, y solo si no ha pagado antes por ella
--     (pagar primero consume la prueba: no se regala lo ya pagado). Puede iniciarla antes de verificarse: la verificación gobierna si PUBLICA (0051), no
--     si tiene un plan; los límites del plan de prueba rigen desde que empieza. Devuelve hasta cuándo dura.
--   · `mi_suscripcion` gana `prueba_disponible`: ¿puede esta cuenta iniciar su prueba ahora? (no la ha usado y no ha pagado). Así la app ofrece el botón solo
--     cuando funciona, en vez de ofrecerlo y rechazarlo después. Cambiar las columnas de salida de una función exige borrarla y crearla de nuevo.
--   · `resolver_verificacion` (cuerpo de la 0064) ya NO crea la prueba al aprobar. El aviso push lo dice: ya no promete una prueba que empezó.
--
-- La duración sigue siendo de 15 días, como fijó la 0053 (la maqueta decía 30 por error; el dato vigente es éste). Una cuenta que ya tenía su prueba
-- por haberse aprobado antes de esta migración la conserva: `prueba_hasta` no se toca.
--
-- Códigos propios: CP018 (no tiene esa función de vendedor) y CP019 (la prueba ya se usó, o ya hay un pago).
--
-- Reversión:
--   drop function if exists iniciar_prueba(text);
--   -- y volver a crear mi_suscripcion (0053) sin `prueba_disponible` (drop function + create);
--   -- y volver a crear resolver_verificacion con el cuerpo de la 0064 (que inserta la prueba de 15 días al aprobar).

create or replace function iniciar_prueba(p_rol text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_hasta timestamptz;
begin
  if v_uid is null then
    raise exception 'sin sesion' using errcode = '28000';
  end if;
  if p_rol is null or p_rol not in ('comerciante', 'arrendador') then
    raise exception 'rol no valido' using errcode = '22023';
  end if;
  if not exists (select 1 from roles_usuario where usuario_id = v_uid and rol = p_rol) then
    raise exception 'sin esa funcion' using errcode = 'CP018';
  end if;

  -- Una sola vez por función, y nunca después de pagar. `for update` sobre la fila de la suscripción (si la hay) evita que dos toques seguidos la inicien dos veces.
  perform 1 from suscripciones where usuario_id = v_uid and rol = p_rol for update;
  if exists (select 1 from suscripciones where usuario_id = v_uid and rol = p_rol and prueba_hasta is not null)
     or exists (select 1 from pagos where usuario_id = v_uid and rol = p_rol) then
    raise exception 'prueba ya usada' using errcode = 'CP019';
  end if;

  v_hasta := now() + interval '15 days';
  insert into suscripciones (usuario_id, rol, prueba_hasta) values (v_uid, p_rol, v_hasta)
  on conflict (usuario_id, rol) do update set prueba_hasta = excluded.prueba_hasta
    where suscripciones.prueba_hasta is null;
  return v_hasta;
end;
$$;
revoke execute on function iniciar_prueba(text) from public, anon, authenticated;
grant execute on function iniciar_prueba(text) to authenticated;

-- Cuerpo de la 0064 SIN el alta de la prueba al aprobar, y con el aviso ajustado.
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

    begin
      perform enviar_notificacion_push(
        p_usuario,
        'Verificación aprobada',
        'Ya puedes publicar como ' || p_rol || '.',
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

-- ── mi_suscripcion + prueba_disponible ──────────────────────────────────────
drop function if exists mi_suscripcion(text);
create or replace function mi_suscripcion(p_rol text)
returns table (
  plan_id text, plan_nombre text, estado text, hasta timestamptz,
  limite_principal integer, max_fotos integer, max_productos integer, destaca boolean,
  prueba_disponible boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with efectivo as (select plan_efectivo(auth.uid(), p_rol) as id),
       s as (select * from suscripciones where usuario_id = auth.uid() and rol = p_rol)
  select p.id, p.nombre,
         case
           when exists (select 1 from s where vigente_hasta > now() and plan_id = p.id) then 'vigente'
           when p.precio_centavos = 0 then 'gratis'
           else 'prueba'
         end,
         case
           when exists (select 1 from s where vigente_hasta > now() and plan_id = p.id) then (select vigente_hasta from s)
           when p.precio_centavos = 0 then null
           else (select prueba_hasta from s)
         end,
         p.limite_principal, p.max_fotos, p.max_productos, p.destaca,
         -- La misma condición que `iniciar_prueba`: sin prueba usada y sin pagos. Una sola idea, escrita dos veces; la prueba de la base las ata.
         (not exists (select 1 from s where prueba_hasta is not null)
          and not exists (select 1 from pagos where usuario_id = auth.uid() and rol = p_rol))
    from efectivo e join planes p on p.id = e.id
   where auth.uid() is not null;
$$;
revoke execute on function mi_suscripcion(text) from public, anon, authenticated;
grant execute on function mi_suscripcion(text) to authenticated;
