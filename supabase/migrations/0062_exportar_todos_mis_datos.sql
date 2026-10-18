-- El derecho de ACCESO cubre lo nuevo. Hallazgo A2 de la auditoría del 18/10/2026.
--
-- `exportar_mis_datos` (0017) devolvía perfil, publicaciones, roomie, mensajes enviados y contactos. Desde entonces la app trata más datos de la
-- persona: funciones y su verificación, negocios y su menú, favoritos, reseñas, suscripciones y pagos. Sin esto, «Descargar mis datos» dejaba fuera
-- justo lo más sensible (nombre legal, domicilio, estado de la verificación).
--
-- Sigue siendo `security invoker`: se ejecuta con la identidad de quien llama, así que RLS limita CADA lectura a sus propias filas. No se hace
-- `security definer` a propósito: una exportación que corre con permisos de dueño es una exportación que, con un error, entrega datos ajenos.
--
-- Lo que NO incluye, y por qué:
--   · Las rutas de los archivos de la INE y de las fotos de verificación: son nombres internos de Storage, no datos de la persona (los archivos
--     mismos se borran a los 30 o 7 días).
--   · Los resultados de la verificación de rostro (`verificaciones_biometria`): son de servicio y la tabla no se concede a `authenticated`
--     (ver 0056). La biometría está apagada; cuando se encienda, el aviso (v4) y esta función deberán decidirlo juntos.
--   · Los mensajes recibidos: son de la otra persona (misma decisión de la 0017).
--
-- Reversión: volver a crear la función con el cuerpo de la 0017.

create or replace function exportar_mis_datos()
returns jsonb language sql stable security invoker as $$
  select jsonb_build_object(
    'generado_en',   now(),
    'perfil',        (select to_jsonb(u) from usuarios u where u.id = auth.uid()),
    'publicaciones', (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
                        from publicaciones p where p.usuario_id = auth.uid()),
    'roomie',        (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
                        from roomies r where r.usuario_id = auth.uid()),
    'mensajes',      (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb)
                        from mensajes m where m.remitente_id = auth.uid()),
    'contactos',     (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
                        from contactos c where c.usuario_id = auth.uid()),
    'funciones',     (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
                        from roles_usuario r where r.usuario_id = auth.uid()),
    'verificaciones', (select coalesce(jsonb_agg(jsonb_build_object(
                          'rol', v.rol, 'nombre_legal', v.nombre_legal, 'direccion', v.direccion,
                          'version_aviso', v.version_aviso, 'consentimiento_en', v.consentimiento_en,
                          'enviada_en', v.enviada_en, 'revisada_en', v.revisada_en, 'motivo_rechazo', v.motivo_rechazo,
                          'fotos_del_lugar', cardinality(v.fotos),
                          'ine_borrar_en', v.ine_borrar_en, 'ine_borrada_en', v.ine_borrada_en)), '[]'::jsonb)
                        from verificaciones_vendedor v where v.usuario_id = auth.uid()),
    'negocios',      (select coalesce(jsonb_agg(to_jsonb(n)), '[]'::jsonb)
                        from negocios n where n.usuario_id = auth.uid()),
    'menu',          (select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb)
                        from negocio_items i where exists (select 1 from negocios n where n.id = i.negocio_id and n.usuario_id = auth.uid())),
    'favoritos',     (select coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb)
                        from favoritos f where f.usuario_id = auth.uid()),
    'resenas',       (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
                        from resenas r where r.usuario_id = auth.uid()),
    'suscripciones', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
                        from suscripciones s where s.usuario_id = auth.uid()),
    'pagos',         (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
                        from pagos p where p.usuario_id = auth.uid())
  );
$$;
