-- Panel de administración · funciones de SERVICIO con bitácora.
--
-- La Edge Function `admin` (que llama la app solo a cuentas admin) lee y escribe a través de estas funciones, nunca con SQL suelto. Dos
-- razones: (1) cada acción que cambia algo deja una fila en `acciones_admin` (quién, qué, cuándo, por qué): un administrador puede ver
-- documentos de identidad y ocultar contenido ajeno, y eso tiene que poder auditarse; (2) cada función repite la comprobación de que
-- `p_admin` es un admin aprobado, así que aunque la Edge Function se equivocara, la base no ejecuta nada a nombre de quien no lo es.
--
-- Ninguna se concede a `anon` ni a `authenticated`: solo `service_role`. Aprobar o rechazar verificaciones sigue siendo
-- `resolver_verificacion` (0049/0053/0057), que ya guarda quién y cuándo.
--
-- Ver los documentos de identidad de alguien también se registra (`registrar_acceso_documentos`): es la acción más delicada que puede hacer
-- un administrador y debe dejar rastro aunque no cambie nada.
--
-- Lo que NO cubre: publicaciones de vivienda reportadas y cuentas suspendidas (0023) siguen con su mecanismo automático.
-- Restaurar una reseña con 3 o más reportes no borra los reportes (son evidencia): un reporte NUEVO la volvería a ocultar.
--
-- Reversión:
--   drop function if exists admin_resumen(uuid), admin_listar_moderacion(uuid), admin_listar_verificaciones(uuid),
--     moderar_contenido(uuid, text, uuid, boolean, text), fijar_demo_mode(uuid, boolean), es_admin_aprobado(uuid),
--     registrar_acceso_documentos(uuid, uuid, text);
--   drop table if exists acciones_admin;

create table if not exists acciones_admin (
  id           uuid primary key default gen_random_uuid(),
  admin_id     uuid references usuarios(id) on delete set null,
  accion       text not null check (accion in ('ocultar_resena', 'restaurar_resena', 'ocultar_negocio', 'restaurar_negocio', 'modo_demo', 'ver_documentos')),
  objetivo_id  uuid,
  detalle      text check (char_length(detalle) <= 400),
  creado_en    timestamptz not null default now()
);
alter table acciones_admin enable row level security;
revoke all on acciones_admin from public, anon, authenticated;
grant select on acciones_admin to service_role;

create or replace function es_admin_aprobado(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_uid is not null and exists (
    select 1 from roles_usuario where usuario_id = p_uid and rol = 'admin' and estado = 'aprobado'
  );
$$;
revoke execute on function es_admin_aprobado(uuid) from public, anon, authenticated;
grant execute on function es_admin_aprobado(uuid) to service_role;

create or replace function admin_resumen(p_admin uuid)
returns table (
  verificaciones_pendientes integer, resenas_reportadas integer, resenas_ocultas integer, negocios_ocultos integer,
  cuentas integer, negocios_activos integer, modo_demo boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not es_admin_aprobado(p_admin) then
    raise exception 'responsable no es admin' using errcode = 'CP007';
  end if;
  return query select
    (select count(*)::integer from roles_usuario where estado = 'pendiente' and rol in ('comerciante', 'arrendador')),
    (select count(distinct resena_id)::integer from resenas_reportes rr join resenas r on r.id = rr.resena_id where not r.oculta_por_reportes),
    (select count(*)::integer from resenas where oculta_por_reportes),
    (select count(*)::integer from negocios where oculto_por_reportes),
    (select count(*)::integer from usuarios),
    (select count(*)::integer from negocios where activo and not oculto_por_reportes),
    coalesce((select valor = 'true' from configuracion_app where clave = 'demo_mode'), false);
end;
$$;
revoke execute on function admin_resumen(uuid) from public, anon, authenticated;
grant execute on function admin_resumen(uuid) to service_role;

create or replace function admin_listar_verificaciones(p_admin uuid)
returns table (
  usuario_id uuid, rol text, nombre_usuario text, nombre_legal text, direccion text, enviada_en timestamptz,
  version_aviso text, fotos_del_lugar integer, rostro_estado text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not es_admin_aprobado(p_admin) then
    raise exception 'responsable no es admin' using errcode = 'CP007';
  end if;
  return query
    select v.usuario_id, v.rol, u.nombre_usuario, v.nombre_legal, v.direccion, v.enviada_en, v.version_aviso,
           cardinality(v.fotos), b.estado
      from roles_usuario r
      join verificaciones_vendedor v on v.usuario_id = r.usuario_id and v.rol = r.rol
      join usuarios u on u.id = v.usuario_id
      left join verificaciones_biometria b on b.usuario_id = v.usuario_id and b.rol = v.rol
     where r.estado = 'pendiente'
     order by v.enviada_en
     limit 100;
end;
$$;
revoke execute on function admin_listar_verificaciones(uuid) from public, anon, authenticated;
grant execute on function admin_listar_verificaciones(uuid) to service_role;

create or replace function admin_listar_moderacion(p_admin uuid)
returns table (tipo text, id uuid, titulo text, texto text, autor text, reportes integer, oculto boolean, creado_en timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not es_admin_aprobado(p_admin) then
    raise exception 'responsable no es admin' using errcode = 'CP007';
  end if;
  return query
    (select 'resena'::text, r.id,
            coalesce(n.nombre, 'Vivienda ' || left(r.publicacion_id::text, 8)) || ' · ' || r.estrellas || ' estrellas',
            r.texto, u.nombre_usuario,
            (select count(*)::integer from resenas_reportes rr where rr.resena_id = r.id),
            r.oculta_por_reportes, r.creado_en
       from resenas r
       join usuarios u on u.id = r.usuario_id
       left join negocios n on n.id = r.negocio_id
      where r.oculta_por_reportes or exists (select 1 from resenas_reportes rr where rr.resena_id = r.id)
      order by r.creado_en desc limit 100)
    union all
    (select 'negocio'::text, n.id, n.nombre, n.descripcion, coalesce(u.nombre_usuario, 'ejemplo'), 0, n.oculto_por_reportes, n.creado_en
       from negocios n
       left join usuarios u on u.id = n.usuario_id
      where n.oculto_por_reportes
      order by n.creado_en desc limit 100);
end;
$$;
revoke execute on function admin_listar_moderacion(uuid) from public, anon, authenticated;
grant execute on function admin_listar_moderacion(uuid) to service_role;

create or replace function moderar_contenido(p_admin uuid, p_tipo text, p_id uuid, p_ocultar boolean, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  if not es_admin_aprobado(p_admin) then
    raise exception 'responsable no es admin' using errcode = 'CP007';
  end if;
  if p_tipo not in ('resena', 'negocio') or p_ocultar is null then
    raise exception 'tipo de contenido invalido' using errcode = '22023';
  end if;
  -- Ocultar contenido ajeno exige decir por qué (queda en la bitácora). Restaurarlo no.
  if p_ocultar and (v_motivo is null or char_length(v_motivo) < 3) then
    raise exception 'falta el motivo' using errcode = 'CP006';
  end if;

  if p_tipo = 'resena' then
    update resenas set oculta_por_reportes = p_ocultar where id = p_id;
  else
    update negocios set oculto_por_reportes = p_ocultar where id = p_id;
  end if;
  if not found then
    raise exception 'no existe' using errcode = 'P0002';
  end if;

  insert into acciones_admin (admin_id, accion, objetivo_id, detalle)
  values (p_admin, (case when p_ocultar then 'ocultar_' else 'restaurar_' end) || p_tipo, p_id, left(v_motivo, 400));
end;
$$;
revoke execute on function moderar_contenido(uuid, text, uuid, boolean, text) from public, anon, authenticated;
grant execute on function moderar_contenido(uuid, text, uuid, boolean, text) to service_role;

-- El modo de demostración enciende los pagos SIMULADOS (`simular_pago`, 0053). Apagado es lo normal en producción.
create or replace function fijar_demo_mode(p_admin uuid, p_activo boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not es_admin_aprobado(p_admin) then
    raise exception 'responsable no es admin' using errcode = 'CP007';
  end if;
  if p_activo is null then
    raise exception 'valor invalido' using errcode = '22023';
  end if;
  update configuracion_app set valor = case when p_activo then 'true' else 'false' end where clave = 'demo_mode';
  if not found then
    insert into configuracion_app (clave, valor) values ('demo_mode', case when p_activo then 'true' else 'false' end);
  end if;
  insert into acciones_admin (admin_id, accion, detalle) values (p_admin, 'modo_demo', case when p_activo then 'encendido' else 'apagado' end);
  return p_activo;
end;
$$;
revoke execute on function fijar_demo_mode(uuid, boolean) from public, anon, authenticated;
grant execute on function fijar_demo_mode(uuid, boolean) to service_role;

-- Quién miró los documentos de quién. Solo si hay una verificación PENDIENTE de esa persona y rol: no se puede «explorar» a alguien.
create or replace function registrar_acceso_documentos(p_admin uuid, p_usuario uuid, p_rol text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not es_admin_aprobado(p_admin) then
    raise exception 'responsable no es admin' using errcode = 'CP007';
  end if;
  if not exists (
    select 1 from roles_usuario where usuario_id = p_usuario and rol = p_rol and estado = 'pendiente'
  ) then
    raise exception 'no hay verificacion pendiente' using errcode = 'CP005';
  end if;
  insert into acciones_admin (admin_id, accion, objetivo_id, detalle) values (p_admin, 'ver_documentos', p_usuario, p_rol);
end;
$$;
revoke execute on function registrar_acceso_documentos(uuid, uuid, text) from public, anon, authenticated;
grant execute on function registrar_acceso_documentos(uuid, uuid, text) to service_role;
