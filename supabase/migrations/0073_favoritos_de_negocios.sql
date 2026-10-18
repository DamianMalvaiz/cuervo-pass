-- Favoritos de negocios · Fase 1.6 del plan de excelencia.
--
-- Una cuenta guarda los negocios de Servicios que le interesan, igual que ya hacía con las publicaciones (0044). Es una tabla aparte y no una columna
-- nueva en `favoritos`: `favoritos.publicacion_id` es clave primaria y tiene clave foránea; mezclar dos clases de objeto en una columna obligaría a
-- quitar las dos garantías.
--
-- Lo que se hereda de la 0044, a propósito:
--   · PRIVADO: solo su dueña lo lee. No hay conteo para el dueño del negocio (si hace falta, será una decisión del panel de vendedor, 2.2).
--   · Solo se guarda lo VISIBLE (`negocios_publicos`). Un negocio oculto y uno que no existe dan el mismo 42501: guardar no sirve de sonda.
--   · Tope de 200 por cuenta con bloqueo consultivo y el mismo código CP004 (la app ya lo traduce).
--   · La fila se CONSERVA si el negocio deja de ser visible; la app dice cuántos ya no están disponibles.
--
-- `exportar_mis_datos` los incluye (derecho de acceso, ver 0062): una tabla de datos personales nueva que no entra en la exportación es el defecto A2 otra vez.
--
-- Reversión:
--   drop trigger if exists trg_limitar_favoritos_negocios on favoritos_negocios;
--   drop function if exists limitar_favoritos_negocios();
--   drop table if exists favoritos_negocios;
--   y volver a crear `exportar_mis_datos` con el cuerpo de la 0062.

create table if not exists favoritos_negocios (
  usuario_id uuid not null references usuarios(id) on delete cascade,
  negocio_id uuid not null references negocios(id) on delete cascade,
  creado_en  timestamptz not null default now(),
  primary key (usuario_id, negocio_id)
);
create index if not exists favoritos_negocios_negocio_idx on favoritos_negocios (negocio_id);

alter table favoritos_negocios enable row level security;
revoke all on favoritos_negocios from public, anon, authenticated;
grant select, insert, delete on favoritos_negocios to authenticated;

drop policy if exists favoritos_negocios_select_propios on favoritos_negocios;
create policy favoritos_negocios_select_propios on favoritos_negocios
  for select to authenticated using (usuario_id = (select auth.uid()));

drop policy if exists favoritos_negocios_insert_propios on favoritos_negocios;
create policy favoritos_negocios_insert_propios on favoritos_negocios
  for insert to authenticated
  with check (usuario_id = (select auth.uid()) and exists (select 1 from negocios_publicos n where n.id = negocio_id));

drop policy if exists favoritos_negocios_delete_propios on favoritos_negocios;
create policy favoritos_negocios_delete_propios on favoritos_negocios
  for delete to authenticated using (usuario_id = (select auth.uid()));

create or replace function limitar_favoritos_negocios()
returns trigger language plpgsql set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('favoritos_negocios:' || new.usuario_id::text, 0));
  if (select count(*) from favoritos_negocios where usuario_id = new.usuario_id) >= 200 then
    raise exception 'tope de favoritos alcanzado' using errcode = 'CP004';
  end if;
  return new;
end;
$$;
revoke execute on function limitar_favoritos_negocios() from public, anon, authenticated;

create or replace trigger trg_limitar_favoritos_negocios
  before insert on favoritos_negocios
  for each row execute function limitar_favoritos_negocios();

-- ── Derecho de acceso ───────────────────────────────────────────────────────
create or replace function exportar_mis_datos()
returns jsonb language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'generado_en',   now(),
    'perfil',        (select to_jsonb(u) from usuarios u where u.id = auth.uid()),
    'publicaciones', (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
                        from publicaciones p where p.usuario_id = auth.uid()),
    'roomie',        (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
                        from roomies r where r.usuario_id = auth.uid()),
    'mensajes',      (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb)
                        from mensajes m where m.remitente_id = auth.uid()),
    'contactos',     (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
                        from contactos c where c.usuario_id = auth.uid()),
    'funciones',     (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
                        from roles_usuario r where r.usuario_id = auth.uid()),
    'verificaciones', (select coalesce(jsonb_agg(jsonb_build_object(
                          'rol', v.rol, 'nombre_legal', v.nombre_legal, 'direccion', v.direccion,
                          'version_aviso', v.version_aviso, 'consentimiento_en', v.consentimiento_en,
                          'enviada_en', v.enviada_en, 'revisada_en', v.revisada_en, 'motivo_rechazo', v.motivo_rechazo,
                          'fotos_del_lugar', cardinality(v.fotos),
                          'ine_borrar_en', v.ine_borrar_en, 'ine_borrada_en', v.ine_borrada_en)), '[]'::jsonb)
                        from verificaciones_vendedor v where v.usuario_id = auth.uid()),
    'negocios',      (select coalesce(jsonb_agg(to_jsonb(n)), '[]'::jsonb)
                        from negocios n where n.usuario_id = auth.uid()),
    'menu',          (select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb)
                        from negocio_items i where exists (select 1 from negocios n where n.id = i.negocio_id and n.usuario_id = auth.uid())),
    'favoritos',     (select coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb)
                        from favoritos f where f.usuario_id = auth.uid()),
    'favoritos_negocios', (select coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb)
                        from favoritos_negocios f where f.usuario_id = auth.uid()),
    'resenas',       (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
                        from resenas r where r.usuario_id = auth.uid()),
    'suscripciones', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
                        from suscripciones s where s.usuario_id = auth.uid()),
    'pagos',         (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
                        from pagos p where p.usuario_id = auth.uid())
  );
$$;
