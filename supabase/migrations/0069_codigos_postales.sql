-- Códigos postales de México en la base, para sacarlos del paquete de la app. Plan de excelencia 0.6.
--
-- ── Lo que se midió ─────────────────────────────────────────────────────────
-- El APK de la primera prueba pesaba 119.9 MB. El paquete de JavaScript era el 15.4 MB de ese APK, y **el 72 % del JavaScript (9.6 MB) era una sola
-- librería de datos, `@webrek/mx-cp`** (el catálogo completo de SEPOMEX: 32 mil códigos postales y ~145 mil colonias), usada para UNA función: rellenar estado,
-- municipio y colonias en el formulario de una publicación cuando se escribe el código postal. React Native no parte el paquete en trozos: cada instalación
-- cargaba el catálogo entero, lo usara o no.
--
-- ── Qué hace esto ──────────────────────────────────────────────────────────
-- El catálogo vive aquí (`codigos_postales`, solo de servicio) y la app lo consulta por una RPC (`buscar_codigo_postal`), que devuelve estado, municipio, ciudad y
-- la lista de colonias de UN código. Sin red, el formulario sigue como siempre: nunca bloquea, se llena a mano.
--
-- Datos de referencia públicos (SEPOMEX / INEGI): no hay nada personal. La tabla no se concede a ningún cliente; se llena con
-- `scripts/cargar-codigos-postales.mjs` (que lee el mismo paquete, ahora solo como herramienta de desarrollo).
--
-- Reversión:
--   drop function if exists buscar_codigo_postal(text);
--   drop table if exists codigos_postales;
--   -- y volver a importar `@webrek/mx-cp` desde `src/lib/direccionMx.ts`.

create table if not exists codigos_postales (
  cp           text not null check (cp ~ '^[0-9]{5}$'),
  estado       text not null check (char_length(estado) between 1 and 80),
  municipio    text not null check (char_length(municipio) between 1 and 120),
  ciudad       text check (char_length(ciudad) <= 120),
  asentamiento text not null check (char_length(asentamiento) between 1 and 160),
  tipo         text check (char_length(tipo) <= 60),
  primary key (cp, asentamiento)
);

alter table codigos_postales enable row level security;
revoke all on codigos_postales from public, anon, authenticated;
grant select, insert, update, delete on codigos_postales to service_role;

-- Una fila por código (estado, municipio, ciudad y todas las colonias), o ninguna si no existe. `security definer` porque la tabla no se concede al cliente.
create or replace function buscar_codigo_postal(p_cp text)
returns table (estado text, municipio text, ciudad text, colonias text[])
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cp text := btrim(coalesce(p_cp, ''));
begin
  if auth.uid() is null then
    raise exception 'sin sesion' using errcode = '28000';
  end if;
  if v_cp !~ '^[0-9]{5}$' then
    raise exception 'codigo postal invalido' using errcode = '22023';
  end if;
  return query
    select min(c.estado), min(c.municipio), min(c.ciudad), array_agg(c.asentamiento order by c.asentamiento)
      from codigos_postales c
     where c.cp = v_cp
    having count(*) > 0;
end;
$$;
revoke execute on function buscar_codigo_postal(text) from public, anon, authenticated;
grant execute on function buscar_codigo_postal(text) to authenticated;
