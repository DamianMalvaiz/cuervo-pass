-- Semana 6: chat en vivo + roomings.
-- 1) Habilita Realtime (postgres_changes) para `mensajes` — sin esto el cliente
--    puede insertar/leer mensajes bien, pero nunca le llegan los eventos en
--    vivo (la app funcionaría como "refrescar para ver mensajes nuevos", no chat).
--    RLS sigue aplicando por suscriptor: cada quien solo recibe los mensajes donde
--    participa (policy "solo participantes ven sus mensajes", migración 0001).
alter publication supabase_realtime add table mensajes;

-- 2) Un usuario tiene a lo más un rooming propio — permite upsert por
--    usuario_id en vez de tener que buscar-luego-insertar-o-actualizar a mano.
alter table roomings add constraint roomings_usuario_id_key unique (usuario_id);
