-- La marca de consentimiento la escribe el servidor al crear la cuenta · Cuervo 360.
--
-- Hasta ahora el cliente actualizaba `usuarios.acepto_aviso_privacidad_en` DESPUÉS del registro, con la
-- sesión que `signUp` devolvía. Con «Confirm email» activo `signUp` no devuelve sesión, así que ese
-- `update` correría sin identidad (RLS: cero filas, sin error) y la cuenta quedaría sin evidencia de
-- consentimiento. La marca pasa al trigger del alta: el cliente manda `acepto_aviso: true` en los
-- metadatos y el trigger escribe `now()`.
--
-- El valor lo pone el SERVIDOR (`now()`), no el cliente: el cliente solo dice «aceptó», no «cuándo».
-- Un metadato ausente o distinto de 'true' deja la columna nula, y el registro no se tumba.
--
-- `create or replace` conserva los privilegios de la función; no hay grants que repetir (la ejecuta el
-- trigger, no el cliente).
--
-- Reversión (no se usa, pero se escribe): volver a crear `handle_new_user` como en 0009.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into usuarios (id, nombre_usuario, nombre_completo, acepto_aviso_privacidad_en)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'nombre_usuario', ''),
      'usuario_' || substr(new.id::text, 1, 8)
    ),
    coalesce(new.raw_user_meta_data->>'nombre_completo', ''),
    case when new.raw_user_meta_data->>'acepto_aviso' = 'true' then now() end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
