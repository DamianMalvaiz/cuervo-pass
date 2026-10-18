-- Tope a las subidas del bucket `verificacion` y barrido de TODA la evidencia sin referencia. Hallazgo A3 de la auditoría del 18/10/2026.
--
-- ── El hueco ────────────────────────────────────────────────────────────────
-- La política `verificacion: subir lo propio` (0049) deja a CUALQUIER cuenta autenticada subir imágenes a su carpeta: sin exigir una función de
-- vendedor, sin límite de cantidad y con cualquier nombre. El barrido de huérfanas (0058) solo recogía los `ine-frente|ine-reverso-…`, así que lo
-- demás (con nombre libre) se quedaba para siempre. No es una fuga: es una forma barata de llenar el almacenamiento.
--
-- ── Lo que hace ─────────────────────────────────────────────────────────────
-- 1 · Subir exige TRES cosas, en la propia policy (es lo que la base impone, no la pantalla):
--       · la ruta tiene la forma exacta que sube la app: `<usuario>/<rol>/{ine-frente|ine-reverso|lugar-N}-<algo>.jpg`;
--       · la cuenta tiene esa función de vendedor y su verificación está en estado `sin_verificar` o `rechazado` (puede enviar). Con la
--         verificación pendiente o aprobada ya no hay nada que subir;
--       · hay menos de 24 archivos en esa carpeta de rol (un envío completo son hasta 8; sobra para reintentos y entregas fallidas).
-- 2 · `evidencia_huerfana` sustituye a `ine_huerfanas`: lista TODA la evidencia con esa forma, de más de un día y que ninguna verificación
--     referencia (INE, reverso o fotos del lugar). La Edge Function `barrer-verificaciones` la borra con la API de Storage. Lo que SÍ está referenciado
--     (las fotos del lugar de una verificación enviada) no se toca.
--
-- Lo que NO resuelve: 24 archivos por rol y por cuenta siguen siendo posibles hasta que el barrido los recoja (≤ 1 día + 1 hora). Es un tope, no una
-- garantía de cero. Y una cuenta puede crear varias cuentas: el límite es por cuenta.
--
-- Reversión:
--   drop function if exists puede_subir_evidencia(text), evidencia_huerfana(integer);
--   -- y restaurar la policy de la 0049; recrear ine_huerfanas con el cuerpo de la 0058.

-- El conteo vive AQUÍ, en una función `security definer`, y no como subconsulta dentro de la policy: una policy de `storage.objects` que lee
-- `storage.objects` hace que PostgreSQL evalúe las policies de lectura dentro de la de escritura y falla con «infinite recursion detected in policy»
-- (comprobado: rompía también las subidas de fotos de negocios, que comparten la tabla).
create or replace function puede_subir_evidencia(p_rol text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from roles_usuario
     where usuario_id = (select auth.uid()) and rol = p_rol and estado in ('sin_verificar', 'rechazado')
  )
  and (
    select count(*) from storage.objects o
     where o.bucket_id = 'verificacion'
       and (storage.foldername(o.name))[1] = (select auth.uid())::text
       and (storage.foldername(o.name))[2] = p_rol
  ) < 24;
$$;
revoke execute on function puede_subir_evidencia(text) from public, anon, authenticated;
grant execute on function puede_subir_evidencia(text) to authenticated;

drop policy if exists "verificacion: subir lo propio" on storage.objects;
create policy "verificacion: subir lo propio" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'verificacion'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (storage.foldername(name))[2] in ('comerciante', 'arrendador')
    and name ~ '^[0-9a-f-]{36}/(comerciante|arrendador)/(ine-frente|ine-reverso|lugar-[0-9]+)-[^/]+\.jpg$'
    and puede_subir_evidencia((storage.foldername(name))[2])
  );

create or replace function evidencia_huerfana(p_limite integer default 100)
returns table (ruta text)
language sql
stable
security definer
set search_path = public
as $$
  select o.name
    from storage.objects o
   where o.bucket_id = 'verificacion'
     and o.name ~ '^[0-9a-f-]{36}/(comerciante|arrendador)/(ine-frente|ine-reverso|lugar-[0-9]+)-[^/]+$'
     and o.created_at < now() - interval '1 day'
     and not exists (
       select 1 from verificaciones_vendedor v
        where o.name in (v.ine_frente, v.ine_reverso) or o.name = any (v.fotos)
     )
   order by o.created_at
   limit least(greatest(coalesce(p_limite, 100), 1), 500);
$$;
revoke execute on function evidencia_huerfana(integer) from public, anon, authenticated;
grant execute on function evidencia_huerfana(integer) to service_role;

drop function if exists ine_huerfanas(integer);
