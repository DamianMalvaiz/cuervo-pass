-- Semana 11: notificaciones push, vía el servicio propio de Expo (no FCM/
-- Firebase directo — el doc original apuntaba a FCM_SERVER_KEY, pero esa API
-- legacy de Firebase ya no existe; Expo Push Service internamente entrega por
-- FCM/APNs sin que este proyecto tenga que configurar Firebase para nada).
--
-- El token push va en una tabla APARTE de `usuarios` (no una columna más ahí)
-- a propósito: `usuarios` es de lectura pública para cualquier autenticado
-- (sección 8, para poder ver perfiles de roomies), y un token push no debe
-- ser legible por nadie más que su dueño — alguien con el token de otra
-- persona podría mandarle notificaciones falsas vía el servicio de Expo.
create extension if not exists pg_net;

create table push_tokens (
  usuario_id uuid primary key references usuarios(id) on delete cascade,
  token text not null,
  actualizado_en timestamptz default now()
);

alter table push_tokens enable row level security;

create policy "solo el dueno ve su token push" on push_tokens
  for select to authenticated using (auth.uid() = usuario_id);
create policy "solo el dueno registra su token push" on push_tokens
  for insert to authenticated with check (auth.uid() = usuario_id);
create policy "solo el dueno actualiza su token push" on push_tokens
  for update to authenticated using (auth.uid() = usuario_id);

-- security definer: lee el token del destinatario sin que el cliente que
-- llama a esta función lo vea nunca (ni siquiera el remitente del mensaje
-- que dispara el push) — solo Postgres lo toca, para mandarlo al servicio
-- de Expo. Falla en silencio (no hay destino, no hay token) para nunca
-- tumbar el insert del mensaje que la dispara.
create or replace function enviar_notificacion_push(destinatario_id uuid, titulo text, cuerpo text, datos jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  token_destino text;
begin
  select token into token_destino from push_tokens where usuario_id = destinatario_id;
  if token_destino is null then
    return;
  end if;

  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb,
    body := jsonb_build_object(
      'to', token_destino,
      'title', titulo,
      'body', cuerpo,
      'data', datos,
      'sound', 'default'
    )
  );
end;
$$;

grant execute on function enviar_notificacion_push(uuid, text, text, jsonb) to authenticated;

-- Extiende el trigger de nuevo mensaje (migración 0001) para también mandar
-- el push, no solo la fila en `notificaciones` (in-app) — mismo evento,
-- ambos caminos.
create or replace function crear_notificacion_mensaje()
returns trigger as $$
begin
  insert into notificaciones (usuario_id, tipo, contenido)
  values (new.destinatario_id, 'nuevo_mensaje', left(new.contenido, 80));

  perform enviar_notificacion_push(
    new.destinatario_id,
    'Nuevo mensaje',
    left(new.contenido, 100),
    jsonb_build_object('tipo', 'nuevo_mensaje', 'remitente_id', new.remitente_id)
  );

  return new;
end;
$$ language plpgsql security definer set search_path = public;
