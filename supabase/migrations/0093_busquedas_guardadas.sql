-- 0093 · Búsquedas guardadas.
--
-- Una cuenta guarda una búsqueda de la web (zona, presupuesto, tipo y los tres filtros de sí/no) para volver a ella con un toque. Es una tabla aparte y de la cuenta: nada de esto es público.
--
-- Lo que se decide a propósito:
--   · PRIVADO: solo su dueña lo lee, lo crea y lo borra. No hay UPDATE: una búsqueda guardada se borra y se vuelve a guardar (no hay nada que renombrar).
--   · `filtros` es un objeto jsonb con SOLO las seis claves que la búsqueda conoce y de tamaño acotado: la base no guarda cualquier cosa que mande el cliente. Los VALORES se validan al leer, en la app
--     (lo guardado es texto: se trata como cualquier otro texto de afuera).
--   · Tope de 20 por cuenta con bloqueo consultivo y el mismo código CP004 que los favoritos (la app ya lo traduce).
--   · `exportar_mis_datos` la incluye (derecho de acceso, ver 0062): una tabla de datos personales nueva que no entra en la exportación es el defecto A2 otra vez. Una zona escrita a mano es un dato personal.
--
-- Reversión (no se usa, pero se escribe):
--   drop trigger if exists trg_limitar_busquedas_guardadas on busquedas_guardadas;
--   drop function if exists limitar_busquedas_guardadas();
--   drop table if exists busquedas_guardadas;
--   y volver a crear `exportar_mis_datos` con el cuerpo de la 0073.

create table if not exists busquedas_guardadas (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  nombre     text not null check (char_length(nombre) between 1 and 80),
  filtros    jsonb not null
             check (jsonb_typeof(filtros) = 'object'
                    and (filtros - array['zona', 'presupuesto', 'tipo', 'amueblado', 'mascotas', 'servicios']) = '{}'::jsonb
                    and pg_column_size(filtros) <= 1000),
  creado_en  timestamptz not null default now()
);
create index if not exists busquedas_guardadas_usuario_idx on busquedas_guardadas (usuario_id, creado_en desc);

alter table busquedas_guardadas enable row level security;
revoke all on busquedas_guardadas from public, anon, authenticated;
grant select, insert, delete on busquedas_guardadas to authenticated;

drop policy if exists busquedas_guardadas_select_propias on busquedas_guardadas;
create policy busquedas_guardadas_select_propias on busquedas_guardadas
  for select to authenticated using (usuario_id = (select auth.uid()));

drop policy if exists busquedas_guardadas_insert_propias on busquedas_guardadas;
create policy busquedas_guardadas_insert_propias on busquedas_guardadas
  for insert to authenticated with check (usuario_id = (select auth.uid()));

drop policy if exists busquedas_guardadas_delete_propias on busquedas_guardadas;
create policy busquedas_guardadas_delete_propias on busquedas_guardadas
  for delete to authenticated using (usuario_id = (select auth.uid()));

create or replace function limitar_busquedas_guardadas()
returns trigger language plpgsql set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('busquedas_guardadas:' || new.usuario_id::text, 0));
  if (select count(*) from busquedas_guardadas where usuario_id = new.usuario_id) >= 20 then
    raise exception 'tope de busquedas guardadas alcanzado' using errcode = 'CP004';
  end if;
  return new;
end;
$$;
revoke execute on function limitar_busquedas_guardadas() from public, anon, authenticated;

create or replace trigger trg_limitar_busquedas_guardadas
  before insert on busquedas_guardadas
  for each row execute function limitar_busquedas_guardadas();

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
    'busquedas_guardadas', (select coalesce(jsonb_agg(to_jsonb(b)), '[]'::jsonb)
                        from busquedas_guardadas b where b.usuario_id = auth.uid()),
    'resenas',       (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
                        from resenas r where r.usuario_id = auth.uid()),
    'suscripciones', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
                        from suscripciones s where s.usuario_id = auth.uid()),
    'pagos',         (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
                        from pagos p where p.usuario_id = auth.uid())
  );
$$;
