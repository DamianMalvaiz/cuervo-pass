-- Auditoría del panel de admin · Cuervo 360 (paso 4 del panel nuevo).
--
-- ── El hueco ────────────────────────────────────────────────────────────────
-- La bitácora `acciones_admin` (0060) registra moderar, modo demo, borrar errores y ver documentos, pero NO las decisiones sobre verificaciones: aprobar o
-- rechazar a un vendedor dejaba `revisada_por` y `revisada_en` en `verificaciones_vendedor` y nada en la bitácora. Una vista de auditoría sin la decisión más
-- sensible del panel tenía un hueco justo donde más importa. Además, esas columnas se borran cuando la persona reenvía su verificación (se pierde el historial).
--
-- ── Lo que hace ─────────────────────────────────────────────────────────────
-- 1 · Amplía la restricción de `acciones_admin.accion` con `aprobar_verificacion` y `rechazar_verificacion`.
-- 2 · Un TRIGGER sobre `verificaciones_vendedor` escribe la decisión en la bitácora, en la MISMA transacción que la decisión. No toca `resolver_verificacion`: da igual por
--     dónde se resuelva una verificación, queda el rastro. Aprobar = `motivo_rechazo` nulo (así lo deja la función); el motivo del rechazo va en el detalle.
-- 3 · Rellena las decisiones que ya existían (con su fecha real). Es idempotente: no duplica lo que ya está.
-- 4 · `admin_listar_auditoria(p_admin, p_limite)`: la bitácora con quién actuó y sobre quién, de la más reciente a la más antigua, acotada a 200. Solo `service_role`, y
--     vuelve a comprobar que sea admin (CP007).
--
-- Reversión (borra primero las filas nuevas o la restricción antigua no se podrá volver a poner):
--   drop function if exists admin_listar_auditoria(uuid, integer);
--   drop trigger if exists registrar_decision_verificacion_trg on verificaciones_vendedor;
--   drop function if exists registrar_decision_verificacion();
--   delete from acciones_admin where accion in ('aprobar_verificacion', 'rechazar_verificacion');
--   alter table acciones_admin drop constraint acciones_admin_accion_check;
--   alter table acciones_admin add constraint acciones_admin_accion_check check (accion in
--     ('ocultar_resena', 'restaurar_resena', 'ocultar_negocio', 'restaurar_negocio', 'modo_demo', 'ver_documentos', 'borrar_error'));

alter table acciones_admin drop constraint if exists acciones_admin_accion_check;
alter table acciones_admin add constraint acciones_admin_accion_check check (accion in (
  'ocultar_resena', 'restaurar_resena', 'ocultar_negocio', 'restaurar_negocio', 'modo_demo', 'ver_documentos', 'borrar_error',
  'aprobar_verificacion', 'rechazar_verificacion'
));

create or replace function registrar_decision_verificacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Solo cuando se DECIDE (revisada_en pasa a tener un valor nuevo). Reenviar la verificación la deja en null y no cuenta.
  if new.revisada_en is not null and new.revisada_en is distinct from old.revisada_en then
    insert into acciones_admin (admin_id, accion, objetivo_id, detalle)
    values (
      new.revisada_por,
      case when new.motivo_rechazo is null then 'aprobar_verificacion' else 'rechazar_verificacion' end,
      new.usuario_id,
      left(new.rol || case when new.motivo_rechazo is null then '' else ': ' || new.motivo_rechazo end, 400)
    );
  end if;
  return new;
end;
$$;
revoke execute on function registrar_decision_verificacion() from public, anon, authenticated;

drop trigger if exists registrar_decision_verificacion_trg on verificaciones_vendedor;
create trigger registrar_decision_verificacion_trg
  after update on verificaciones_vendedor
  for each row execute function registrar_decision_verificacion();

-- Lo que ya se había decidido antes de este trigger, con su fecha real. No duplica: la fila del trigger lleva la misma marca de tiempo que `revisada_en`.
insert into acciones_admin (admin_id, accion, objetivo_id, detalle, creado_en)
select v.revisada_por,
       case when v.motivo_rechazo is null then 'aprobar_verificacion' else 'rechazar_verificacion' end,
       v.usuario_id,
       left(v.rol || case when v.motivo_rechazo is null then '' else ': ' || v.motivo_rechazo end, 400),
       v.revisada_en
  from verificaciones_vendedor v
 where v.revisada_en is not null
   and not exists (
     select 1 from acciones_admin a
      where a.objetivo_id = v.usuario_id
        and a.accion in ('aprobar_verificacion', 'rechazar_verificacion')
        and a.creado_en = v.revisada_en
   );

create or replace function admin_listar_auditoria(p_admin uuid, p_limite integer default 100)
returns table (accion text, admin text, objetivo_id uuid, objetivo text, detalle text, creado_en timestamptz)
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
    select a.accion,
           coalesce(ua.nombre_usuario, '(cuenta eliminada)'),
           a.objetivo_id,
           uo.nombre_usuario,
           a.detalle,
           a.creado_en
      from acciones_admin a
      left join usuarios ua on ua.id = a.admin_id
      left join usuarios uo on uo.id = a.objetivo_id
     order by a.creado_en desc
     limit greatest(1, least(coalesce(p_limite, 100), 200));
end;
$$;
revoke execute on function admin_listar_auditoria(uuid, integer) from public, anon, authenticated;
grant execute on function admin_listar_auditoria(uuid, integer) to service_role;
