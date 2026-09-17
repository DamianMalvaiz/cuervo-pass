-- Semana 8, sección 18: cifra el texto libre del perfil con pgcrypto antes de
-- guardarlo. La clave vive SOLO en la configuración de la base (nunca en el
-- cliente, nunca como parámetro de la función que el cliente puede llamar) —
-- si el cliente pudiera pasar la clave, cifrar no protegería nada.
--
-- Paso manual, UNA sola vez, antes de que esta función funcione (reemplaza la
-- clave por una tuya, cualquier cadena larga y aleatoria):
--   alter database postgres set app.perfil_encryption_key = 'pon-aqui-una-clave-larga-y-aleatoria';
--
-- Nota: esto es independiente del PERFIL_ENCRYPTION_KEY del microservicio de
-- IA (.env) — ese es para cuando el microservicio necesite leer/descifrar
-- directo desde Postgres en el futuro; por ahora nada descifra este campo.
create or replace function guardar_perfil_texto(texto text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update usuarios
  set perfil_texto_cifrado = pgp_sym_encrypt(texto, current_setting('app.perfil_encryption_key'))
  where id = auth.uid();
end;
$$;

grant execute on function guardar_perfil_texto(text) to authenticated;
