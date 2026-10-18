-- Cierra DOS huecos de privilegios que RLS no cubre. Hallazgo de la auditoría del 18/10/2026.
--
-- ── 1 · Las vistas «públicas» se podían ESCRIBIR (grave) ────────────────────
-- `publicaciones_publicas` y `roomies_publicos` son vistas simples de una sola tabla, y por eso PostgreSQL las hace actualizables. Se crearon
-- `security_invoker = false`, que es lo que les permite leer filas que RLS ocultaría a quien consulta… y que también hace que una escritura a
-- través de ellas se ejecute con los permisos de SU DUEÑO (postgres), que se salta RLS.
-- Las migraciones 0014 y 0024 hicieron `revoke all … from public; revoke all … from anon; grant select … to authenticated`. Faltaba la
-- cuarta línea: Supabase concede por omisión TODOS los privilegios a `authenticated` en cada objeto nuevo, y `grant select` no quita los demás.
-- Resultado, reproducido en una base local con las mismas migraciones: una cuenta autenticada cualquiera podía ACTUALIZAR y BORRAR las
-- publicaciones y los anuncios de roomie de OTRA cuenta (1 fila afectada en cada caso) llamando a la vista en vez de a la tabla.
-- Las pruebas de RLS no lo vieron porque ejercitaban las tablas, no las vistas.
--
-- ── 2 · `anon` conservaba privilegios sobre tablas viejas (defensa en profundidad) ──
-- `anon` tenía todos los privilegios sobre 14 tablas de las primeras migraciones. Hoy RLS lo frena (no hay ninguna policy para `anon`), pero
-- RLS no cubre TRUNCATE, y un `grant` mal escrito mañana las abriría. La app nunca usa `anon` contra tablas: solo para la API de autenticación.
-- También se quita TRUNCATE, REFERENCES y TRIGGER a `authenticated` en las tablas: no los necesita ninguna pantalla y RLS no los filtra.
--
-- ── Lo que NO toca ──────────────────────────────────────────────────────────
-- `select/insert/update/delete` de `authenticated` sobre TABLAS se queda como está: cada tabla lo restringe con sus policies y, donde se
-- hizo, con privilegios por columna. `service_role` no se toca.
--
-- ── Para que no vuelva a pasar ──────────────────────────────────────────────
-- `alter default privileges` quita lo que Supabase concede a `anon` y `authenticated` en los objetos NUEVOS del esquema. Una migración nueva
-- tiene que escribir sus `grant` explícitos (como ya hacen las recientes); lo que olvide falla cerrado («permission denied») en vez de abierto.
--
-- Reversión: no se recomienda (reabre el hueco). Si hiciera falta, `grant` explícito por objeto.

-- 1 · Vistas: solo lectura, y solo `authenticated`. (`planes_efectivos` es interna y no se concede a nadie.)
do $$
declare v record;
begin
  for v in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('v', 'm') loop
    execute format('revoke all on public.%I from public, anon, authenticated', v.relname);
  end loop;
end $$;

grant select on
  calificacion_publicaciones, negocio_items_publicos, negocios_publicos, perfiles_publicos,
  publicaciones_publicas, resenas_publicas, roomies_publicos, roomings
to authenticated;

-- 2 · `anon` no necesita nada de las tablas ni de las secuencias de `public`.
do $$
declare t record;
begin
  for t in select c.relname, c.relkind from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind in ('r', 'p', 'S') loop
    if t.relkind = 'S' then
      execute format('revoke all on sequence public.%I from anon', t.relname);
    else
      execute format('revoke all on public.%I from anon', t.relname);
      execute format('revoke truncate, references, trigger on public.%I from authenticated', t.relname);
    end if;
  end loop;
end $$;

-- 3 · Los objetos NUEVOS no nacen abiertos.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
