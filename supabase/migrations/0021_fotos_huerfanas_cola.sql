-- El trigger de limpieza de fotos tumbaba el derecho de cancelación.
--
-- La migración 0016 creó `trg_limpiar_fotos`, que al borrar una publicación
-- hacía `delete from storage.objects`. Supabase añadió después una barrera que
-- lo prohíbe:
--
--   "Direct deletion from storage tables is not allowed. Use the Storage API
--    instead. This prevents accidental data loss from orphaned objects."
--
-- El trigger revienta, la transacción entera se cae, y con ella TODO lo que
-- dependiera de borrar esa publicación: borrar la publicación desde la app, y
-- —porque va en cascada desde auth.users— borrar la cuenta entera.
--
-- Comprobado contra producción el 19/09/2026 con una cuenta de prueba que tenía
-- una publicación con una foto: `eliminar-cuenta` devolvió un no-2xx y la cuenta
-- siguió existiendo. El aviso de privacidad promete esa pantalla en la tabla de
-- derechos ARCO, así que esto no era una molestia de interfaz: era un
-- incumplimiento de la LFPDPPP.
--
-- La barrera bloquea la SENTENCIA, no las filas: también falla cuando no hay
-- ningún objeto que coincida. No hay forma de esquivarla desde SQL.
--
-- ============================================================
-- 1. La cola
-- ============================================================
-- Un trigger ya no puede borrar del almacenamiento, pero sí puede DEJAR
-- CONSTANCIA de lo que hay que borrar. La promesa de AUD-10 —no dejar archivos
-- que se pagan para siempre y que el usuario creyó eliminados— pasa de ser
-- invisible a ser una fila que alguien puede contar.
--
-- El cambio tiene un coste y conviene nombrarlo: encolar no borra. Si nadie
-- vacía esta tabla, los archivos siguen ahí. Se cambia un fallo ruidoso por una
-- deuda visible. Por eso `scripts/verificar.mjs` la mira antes de cada demo.
create table if not exists fotos_huerfanas (
  ruta           text primary key,
  publicacion_id uuid,
  usuario_id     uuid,
  encolada_en    timestamptz not null default now()
);

-- Sin policy a propósito, igual que `cuotas_uso`: es una tabla de servicio. Con
-- RLS activo y cero policies nadie la lee desde el cliente, ni su propio dueño.
-- Que no sea legible importa: son rutas de almacenamiento de otras personas.
alter table fotos_huerfanas enable row level security;

-- Las rutas NO se guardan con clave foránea a publicaciones: la fila de la
-- publicación ya no existe cuando esto corre. El uuid queda solo como rastro.

-- ============================================================
-- 2. El trigger, que ahora encola en vez de borrar
-- ============================================================
create or replace function limpiar_fotos_publicacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.fotos is null or array_length(old.fotos, 1) is null then
    return old;
  end if;

  -- Las publicaciones sembradas guardan URLs de Unsplash, no rutas del bucket.
  -- Encolarlas haría que el barredor pidiera a Storage borrar algo que nunca
  -- estuvo ahí, y ensuciaría el recuento con trabajo que no existe.
  insert into fotos_huerfanas (ruta, publicacion_id, usuario_id)
  select r, old.id, old.usuario_id
    from unnest(old.fotos) as r
   where r not like 'http%'
  on conflict (ruta) do nothing;

  return old;
end;
$$;

-- El trigger en sí no cambia; se recrea para dejarlo explícito en esta migración.
drop trigger if exists trg_limpiar_fotos on publicaciones;
create trigger trg_limpiar_fotos
  after delete on publicaciones
  for each row execute function limpiar_fotos_publicacion();
