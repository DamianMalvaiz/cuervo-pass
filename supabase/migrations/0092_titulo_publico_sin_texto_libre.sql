-- 0092 · Sin cuenta no se ve el título libre de una vivienda.
--
-- La 0090 dejó el `titulo` en `explorar_publicaciones`. Pero el título lo escribe quien publica —o lo generó la migración 0010 a partir de la dirección ("Publicación en
-- Calle Reforma 253")—: puede llevar la calle, el número o un teléfono, y entonces la «zona sin calle» de la propia vista se deshacía. Es el mismo motivo por el que la
-- descripción de una vivienda ya NO sale. Medido el 26/10/2026 en producción: 103 de 113 títulos contenían la calle. (Son datos de demostración, no de personas reales.)
--
-- Sin cuenta se ve `titulo_publico`: ARMADO aquí con el tipo y la primera parte de la zona («Cuarto en Barrio Bajo»), sin texto libre. No puede llevar un número ni una calle.
--
-- Una vista no puede quitar una columna con `create or replace`: se recrea. Nada depende de ella (la leen las funciones de la app por nombre, no otras vistas).
--
-- Reversión (no se usa, pero se escribe): recrear la vista como en la 0090, con `p.titulo`.

drop view if exists explorar_publicaciones;

create view explorar_publicaciones with (security_invoker = false) as
  select p.id,
         case p.tipo when 'depa' then 'Departamento' when 'cuarto' then 'Cuarto' else 'Casa compartida' end
           || coalesce(' en ' || nullif(btrim(split_part(zona_aproximada(p.direccion), ',', 1)), ''), '') as titulo_publico,
         p.tipo, p.precio_renta, p.recamaras, p.amueblado, p.permite_mascotas, p.servicios_incluidos,
         zona_aproximada(p.direccion) as zona,
         round(p.latitud::numeric, 2)::double precision as latitud_aprox,
         round(p.longitud::numeric, 2)::double precision as longitud_aprox,
         coalesce(cardinality(p.fotos), 0) as num_fotos,
         p.destacado,
         c.calificacion, c.num_resenas,
         p.creado_en
    from publicaciones_publicas p
    left join calificacion_publicaciones c on c.publicacion_id = p.id;

revoke all on explorar_publicaciones from public, anon, authenticated;
grant select on explorar_publicaciones to anon, authenticated;
