-- Roles de usuario · Cuervo 360.
--
-- La app pasa de «estudiantes que buscan depa» a una plataforma con tres módulos
-- (servicios, depas, roomies) y vendedores. Una cuenta puede tener varias funciones:
-- estudiante, comerciante, arrendador y admin.
--
-- ── Por qué «estudiante» NO está en la tabla ────────────────────────────────
-- Todo usuario es estudiante por defecto, y «estudiante verificado» ya se DERIVA del
-- correo confirmado (0026). Guardarlo aquí sería copiar un dato que se puede consultar
-- —el mismo defecto que la 0026 evitó a propósito—, con su ventana de desincronización:
-- una insignia que miente es peor que no tenerla. La tabla guarda solo lo que se AGREGA:
-- comerciante, arrendador y admin.
--
-- ── Quién escribe qué ───────────────────────────────────────────────────────
-- Quien se beneficia de un rol no se lo escribe. El cliente solo LEE sus propias filas.
--
--   · Agregarse una función pasa por `agregar_funcion(rol)`, que solo crea
--     `comerciante` o `arrendador`, siempre en `sin_verificar`. Repetir la llamada no
--     duplica ni degrada: si el servidor ya la aprobó, volver a pedirla no la devuelve a
--     sin_verificar (sería quitarle una aprobación a alguien pulsando un botón).
--   · Cambiar el estado (aprobar, rechazar) o crear un `admin` es cosa del servidor
--     (service_role). Nadie se asigna admin ni se aprueba solo.
--
-- La tabla no tiene `insert`, `update` ni `delete` para `anon` ni `authenticated`: con
-- la RLS no basta, porque Supabase concede todo por defecto (0036) y una policy mal
-- escrita después lo reabriría. Los privilegios se cierran aquí y la prueba lo comprueba.
--
-- ── Estados ─────────────────────────────────────────────────────────────────
-- sin_verificar → pendiente → aprobado | rechazado. «pendiente» llega con la verificación
-- de vendedor (INE, fotos), que es la siguiente fase; las columnas de revisión (quién,
-- cuándo, motivo) se añaden entonces, en otra migración, no a ciegas ahora.
--
-- ── El backfill ─────────────────────────────────────────────────────────────
-- Quien ya es dueño de una publicación se migra como `arrendador` en estado `aprobado`
-- y con origen `migracion`. NO es una verificación: es no dejar sin poder publicar a
-- quien ya publica el día que se exija verificación. El origen lo deja escrito para que
-- una aprobación heredada no pase nunca por una revisada. Al aplicarla se midió cuántas
-- cuentas tocaría (ver el reporte del paso, no esta cabecera: una cifra copiada aquí
-- sería otro dato que se desactualiza).
--
-- ── Lo que NO cambia ────────────────────────────────────────────────────────
-- Ninguna policy ni vista existente. Todavía NADA exige un rol para publicar: eso llega
-- en su propia migración, con su propia prueba, para que cada paso se pueda revertir solo.
-- `eliminar-cuenta` borra `auth.users` y todo cae en cascada, roles incluidos.
--
-- Código de error propio: CP003 (función no permitida), junto a CP001 y CP002. La falta
-- de sesión usa el estándar 28000. La app los lee por código (END-27), no por texto.
--
-- Reversión:
--   drop function if exists agregar_funcion(text);
--   drop table if exists roles_usuario;

create table if not exists roles_usuario (
  usuario_id uuid not null references usuarios(id) on delete cascade,
  rol        text not null check (rol in ('comerciante', 'arrendador', 'admin')),
  estado     text not null default 'sin_verificar'
             check (estado in ('sin_verificar', 'pendiente', 'aprobado', 'rechazado')),
  origen     text not null default 'solicitud'
             check (origen in ('solicitud', 'migracion', 'sembrado')),
  desde      timestamptz not null default now(),
  primary key (usuario_id, rol)
);

alter table roles_usuario enable row level security;

-- Privilegios cerrados: solo lectura para quien tiene sesión. Supabase concede todo a
-- anon y authenticated por defecto, y `revoke ... from public` no lo quitaría (0036).
revoke all on roles_usuario from public, anon, authenticated;
grant select on roles_usuario to authenticated;

drop policy if exists roles_select_propios on roles_usuario;
create policy roles_select_propios on roles_usuario
  for select to authenticated
  using (usuario_id = (select auth.uid()));

-- Agregarse una función. `security definer` porque el cliente no puede escribir la tabla;
-- por eso mismo la función hace sola todas las comprobaciones y solo ve a quien llama.
create or replace function agregar_funcion(p_rol text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'sin sesion' using errcode = '28000';
  end if;

  -- admin no se pide, y estudiante no se agrega: es implícito.
  if p_rol is null or p_rol not in ('comerciante', 'arrendador') then
    raise exception 'funcion no permitida' using errcode = 'CP003';
  end if;

  -- `do nothing`: repetir no duplica y, sobre todo, no degrada una aprobación.
  insert into roles_usuario (usuario_id, rol)
  values (auth.uid(), p_rol)
  on conflict do nothing;
end;
$$;

-- Explícito sobre las TRES concesiones por defecto (0036): anon no tiene nada que hacer aquí.
revoke execute on function agregar_funcion(text) from public, anon;
grant execute on function agregar_funcion(text) to authenticated;

-- Backfill: ver la cabecera. Idempotente por la clave primaria.
insert into roles_usuario (usuario_id, rol, estado, origen)
select distinct usuario_id, 'arrendador', 'aprobado', 'migracion'
  from publicaciones
on conflict do nothing;
