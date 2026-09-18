-- Documento maestro v5 · §9 (geocodificación con Nominatim, AUD-02),
-- §29 (derechos ARCO y retención).
--
-- Reversión:
--   drop function if exists exportar_mis_datos();
--   drop function if exists guardar_geocodificacion(text, double precision, double precision, text);
--   drop table if exists geocodificaciones;

-- ============================================================
-- 1. Caché de geocodificación · AUD-02
-- ============================================================
-- Mapbox separa geocodificación TEMPORAL (100k gratis al mes, resultados que no
-- se pueden almacenar) de PERMANENTE (la única que permite guardar en una base
-- de datos, sin capa gratuita). El esquema guarda latitud y longitud en
-- `publicaciones`: eso es uso permanente. El problema no es de costo sino de
-- licencia — se estarían almacenando datos que los términos prohíben almacenar.
--
-- Se cambia a Nominatim sobre OpenStreetMap, cuya ODbL sí permite almacenar y
-- derivar, a cambio de: atribución visible, máximo una petición por segundo con
-- User-Agent identificable, y no redistribuir la base. Las tres se cumplen
-- geocodificando desde el servidor (supabase/functions/geocodificar), nunca
-- desde el cliente.
--
-- Esta tabla es la obligación número 2 hecha código: dos publicaciones en la
-- misma calle no generan dos peticiones. Es la diferencia entre cien peticiones
-- al mes y mil.
create table if not exists geocodificaciones (
  consulta   text primary key,           -- dirección normalizada, en minúsculas
  latitud    double precision,
  longitud   double precision,
  proveedor  text not null,              -- proveedor + licencia, para saber qué vino de dónde
  creado_en  timestamptz default now()
);

alter table geocodificaciones enable row level security;

-- Lectura sí (una coordenada de una dirección pública no es dato personal);
-- escritura solo desde la Edge Function con service_role, que evade RLS.
drop policy if exists geocodificaciones_lectura on geocodificaciones;
create policy geocodificaciones_lectura on geocodificaciones
  for select to authenticated using (true);

-- ============================================================
-- 2. ARCO · §29
-- ============================================================
-- No basta con prometerlos en el aviso de privacidad. ACCESO = el usuario
-- descarga todo lo suyo, en un botón de Mi perfil.
--
-- `security invoker` a propósito: corre con los permisos del usuario, así que
-- por construcción no puede devolver datos de nadie más. Si alguien la
-- reescribiera para leer de otra fila, RLS la detendría.
create or replace function exportar_mis_datos()
returns jsonb language sql stable security invoker as $$
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
                        from contactos c where c.usuario_id = auth.uid())
  );
$$;

revoke execute on function exportar_mis_datos() from public;
grant execute on function exportar_mis_datos() to authenticated;

-- CANCELACIÓN: borrar la cuenta de Supabase Auth dispara el `on delete cascade`
-- de todo el esquema, y el trigger de 0015 limpia el almacenamiento. La llamada
-- vive en supabase/functions/eliminar-cuenta porque requiere service_role.

-- ============================================================
-- 3. Retención · §29
-- ============================================================
-- La tabla de cuotas guarda una fila por usuario, recurso y día. Sin limpieza
-- crece para siempre, y la política de retención declarada en el aviso de
-- privacidad dice noventa días. Se ejecuta con pg_cron si está disponible; si
-- no, es una tarea manual mensual (docs/bitacora-semanal.md).
create or replace function limpiar_cuotas_antiguas()
returns void language sql security definer set search_path = public as $$
  delete from cuotas_uso where dia < current_date - interval '90 days';
$$;
