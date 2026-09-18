-- Documento maestro v5 · §11. `roomings` pasa a llamarse `roomies`.
--
-- §33.4 regla 2 prescribe expandir-y-contraer para un renombrado: agregar lo
-- nuevo, escribir en ambos, migrar datos, cambiar lectores, borrar lo viejo.
-- Aquí se aplica la versión corta y honesta del patrón —renombrar y dejar una
-- VISTA con el nombre anterior— porque el único lector viejo posible es un APK
-- de pruebas instalado en un celular, y una vista lo mantiene funcionando sin
-- el costo de cuatro migraciones. La vista se retira en la semana 12.
--
-- Reversión:
--   drop view if exists roomings;
--   alter table roomies rename to roomings;
--   alter table roomings rename column vector_busqueda to perfil_busqueda_vector;

do $$
begin
  if exists (select 1 from information_schema.tables
              where table_schema = 'public' and table_name = 'roomings') then
    alter table roomings rename to roomies;
    alter table roomies rename column perfil_busqueda_vector to vector_busqueda;
    alter table roomies rename constraint roomings_usuario_id_key to roomies_usuario_id_key;
  end if;
end $$;

alter table roomies
  add column if not exists presupuesto_aportacion int;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'roomies_aportacion_no_negativa') then
    alter table roomies add constraint roomies_aportacion_no_negativa
      check (presupuesto_aportacion is null or presupuesto_aportacion >= 0);
  end if;
end $$;

-- `descripcion_busqueda` pasa a NOT NULL: un rooming sin descripción no tiene
-- de dónde sacar un vector, así que nunca podría ordenarse por afinidad — que
-- es lo único que esta tabla existe para hacer.
update roomies set descripcion_busqueda = 'Busco roomie.'
 where descripcion_busqueda is null or trim(descripcion_busqueda) = '';
alter table roomies alter column descripcion_busqueda set not null;

alter table roomies alter column usuario_id set not null;

-- Compatibilidad hacia atrás para clientes viejos. Se retira en la semana 12.
create or replace view roomings with (security_invoker = true) as
  select id, usuario_id, descripcion_busqueda,
         vector_busqueda as perfil_busqueda_vector,
         estado, creado_en
  from roomies;

comment on view roomings is
  'Alias temporal de `roomies` para APKs anteriores a v5 (§33.4). Retirar en la semana 12.';
