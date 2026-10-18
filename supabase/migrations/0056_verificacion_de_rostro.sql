-- Verificación de rostro · Cuervo 360 (fase 6).
--
-- La Edge Function `verificar-rostro` compara una selfie con la foto de la INE (ai-service, `/verificar-rostro`) y escribe AQUÍ el
-- resultado. Es una AYUDA para el admin que revisa: nada de esto aprueba una verificación por sí solo.
--
-- ── Qué se guarda y qué NO ──────────────────────────────────────────────────
-- SÍ: el estado, dos cifras (similitud de identidad y puntaje de vida), el modelo, cuántos intentos van y el consentimiento
--     expreso y aparte de la biometría (fecha y versión del aviso).
-- NO: la selfie, la imagen de la INE usada, ni el vector facial. Esos solo existen en memoria mientras dura la petición.
--
-- ── Por qué en una tabla aparte y NO en `verificaciones_vendedor` ───────────
-- La dueña puede LEER su propia fila de verificación (policy `verif_select_propia`) y RLS filtra filas, no columnas
-- (invariante 3). Si las cifras vivieran allí, quien intenta suplantar a alguien las leería tras cada intento y tendría un
-- instrumento para afinar el ataque contra los umbrales. Esta tabla no se concede a `authenticated`: solo la ve el servicio
-- (la Edge Function y el script del admin). A la persona le contestamos solo «recibida» o «repite la foto».
--
-- ── Intentos ────────────────────────────────────────────────────────────────
-- Máximo 5 por cada envío de verificación. Sin tope, la respuesta de «repite la foto» sería un oráculo repetible gratis. El
-- contador se reinicia cuando la persona REENVÍA la verificación (con otra INE, por ejemplo): el resultado anterior era de otra
-- evidencia y no debe acompañar a la nueva (trigger de abajo).
--
-- Reversión (el orden importa):
--   drop trigger if exists verif_reinicia_biometria on verificaciones_vendedor;
--   drop function if exists reiniciar_biometria();
--   drop function if exists registrar_resultado_biometria(uuid, text, text, real, real, text);
--   drop function if exists reservar_intento_biometria(uuid, text, text);
--   drop table if exists verificaciones_biometria;

create table if not exists verificaciones_biometria (
  usuario_id        uuid not null,
  rol               text not null,
  -- `pendiente_de_foto`: el intento se reservó y todavía no hay resultado (o la petición falló antes de medir).
  estado            text not null default 'pendiente_de_foto'
                    check (estado in ('pendiente_de_foto', 'coincide', 'no_coincide', 'no_vivo', 'repetir_selfie', 'sin_rostro_ine')),
  identidad         real check (identidad between -1 and 1),
  vivo              real check (vivo between 0 and 1),
  modelo            text check (char_length(modelo) <= 40),
  intentos          smallint not null default 0 check (intentos between 0 and 5),
  consentimiento_en timestamptz not null,
  version_aviso     text not null check (char_length(version_aviso) between 1 and 20),
  medida_en         timestamptz,
  primary key (usuario_id, rol),
  foreign key (usuario_id, rol) references verificaciones_vendedor(usuario_id, rol) on delete cascade
);

alter table verificaciones_biometria enable row level security;
-- Sin policy y sin concesión a authenticated: la persona NO lee esta tabla. El servicio la lee con su llave (script del admin).
revoke all on verificaciones_biometria from public, anon, authenticated;
grant select on verificaciones_biometria to service_role;

-- Reserva un intento ANTES de gastar cómputo en la comparación. Registra el consentimiento la primera vez.
create or replace function reservar_intento_biometria(p_usuario uuid, p_rol text, p_version_aviso text)
returns smallint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado text;
  v_intentos smallint;
begin
  if p_version_aviso is null or btrim(p_version_aviso) = '' then
    raise exception 'sin consentimiento biometrico' using errcode = '22023';
  end if;

  select estado into v_estado from roles_usuario where usuario_id = p_usuario and rol = p_rol;
  if v_estado is distinct from 'pendiente' then
    raise exception 'verificacion no pendiente' using errcode = 'CP005';
  end if;

  insert into verificaciones_biometria (usuario_id, rol, consentimiento_en, version_aviso)
  values (p_usuario, p_rol, now(), btrim(p_version_aviso))
  on conflict (usuario_id, rol) do nothing;

  update verificaciones_biometria
     set intentos = intentos + 1
   where usuario_id = p_usuario and rol = p_rol and intentos < 5
  returning intentos into v_intentos;

  if v_intentos is null then
    raise exception 'intentos de biometria agotados' using errcode = 'CP013';
  end if;
  return v_intentos;
end;
$$;

revoke execute on function reservar_intento_biometria(uuid, text, text) from public, anon, authenticated;
grant execute on function reservar_intento_biometria(uuid, text, text) to service_role;

create or replace function registrar_resultado_biometria(
  p_usuario uuid, p_rol text, p_estado text, p_identidad real, p_vivo real, p_modelo text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update verificaciones_biometria
     set estado = p_estado, identidad = p_identidad, vivo = p_vivo, modelo = p_modelo, medida_en = now()
   where usuario_id = p_usuario and rol = p_rol;
  if not found then
    raise exception 'no hay intento reservado' using errcode = 'CP005';
  end if;
end;
$$;

revoke execute on function registrar_resultado_biometria(uuid, text, text, real, real, text) from public, anon, authenticated;
grant execute on function registrar_resultado_biometria(uuid, text, text, real, real, text) to service_role;

-- Reenviar la verificación (otra INE, otras fotos) deja sin efecto el resultado anterior y reinicia los intentos.
-- Se dispara por las columnas de EVIDENCIA que `enviar_verificacion` reescribe, no por un cambio de `enviada_en`: dentro de una
-- misma transacción `now()` no cambia y el trigger no se enteraría. `resolver_verificacion` y el barrido no tocan esas columnas.
create or replace function reiniciar_biometria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from verificaciones_biometria where usuario_id = old.usuario_id and rol = old.rol;
  return new;
end;
$$;

revoke execute on function reiniciar_biometria() from public, anon, authenticated;

drop trigger if exists verif_reinicia_biometria on verificaciones_vendedor;
create trigger verif_reinicia_biometria
  after update of ine_frente, ine_reverso, fotos on verificaciones_vendedor
  for each row
  execute function reiniciar_biometria();
