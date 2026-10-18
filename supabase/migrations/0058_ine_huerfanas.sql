-- Archivos de INE que ninguna verificación apunta (huérfanos).
--
-- ── El hueco ────────────────────────────────────────────────────────────────
-- La app sube la evidencia ANTES de llamar a `enviar_verificacion` (si fuera al revés, una subida fallida dejaría una verificación
-- pendiente apuntando a archivos inexistentes). Los nombres son únicos y no se sobrescriben. Consecuencias:
--   · Si una subida falla a medias, lo ya subido queda sin referencia.
--   · Si la persona REENVÍA tras un rechazo, la fila pasa a apuntar a archivos nuevos y los de la entrega anterior quedan sin referencia.
-- El barrido de la INE (0050) solo borra las rutas que la fila nombra, así que esos archivos —documentos de identidad— se conservaban para siempre.
--
-- ── Qué hace esto ───────────────────────────────────────────────────────────
-- `ine_huerfanas` LISTA (no borra) los archivos `<usuario>/<rol>/ine-frente|ine-reverso-….jpg` del bucket `verificacion` que ninguna fila de
-- `verificaciones_vendedor` referencia y que tienen más de 1 día. El día de gracia evita borrar una subida en curso: la app sube la INE y
-- enseguida llama a `enviar_verificacion`. La Edge Function `barrer-verificaciones` los borra con la API de Storage (borrar las filas de
-- `storage.objects` por SQL deja el archivo en el almacenamiento), tras revalidar cada ruta.
--
-- Solo INE: las fotos del local o del inmueble no son documentos de identidad y no se tocan.
--
-- Reversión:
--   drop function if exists ine_huerfanas(integer);

create or replace function ine_huerfanas(p_limite integer default 100)
returns table (ruta text)
language sql
stable
security definer
set search_path = public
as $$
  select o.name
    from storage.objects o
   where o.bucket_id = 'verificacion'
     and o.name ~ '^[0-9a-f-]{36}/(comerciante|arrendador)/ine-(frente|reverso)-[^/]+$'
     and o.created_at < now() - interval '1 day'
     and not exists (
       select 1 from verificaciones_vendedor v where o.name in (v.ine_frente, v.ine_reverso)
     )
   order by o.created_at
   limit least(greatest(coalesce(p_limite, 100), 1), 500);
$$;

revoke execute on function ine_huerfanas(integer) from public, anon, authenticated;
grant execute on function ine_huerfanas(integer) to service_role;
