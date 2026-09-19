-- Documento maestro v5 · §14 · corrige un fallo de la 0016.
--
-- EL FALLO: cualquier cuenta lee CUALQUIER foto del bucket.
--
-- La 0016 se titula "storage privado" y su encabezado dice que v3 era
-- vulnerable porque «cualquiera en internet con la URL —o adivinando el patrón
-- perfiles/<uuid>.jpg— lee las fotos de perfil de todo el padrón, sin sesión».
-- Lo que dejó escrito fue:
--
--   create policy "leer fotos con sesion" on storage.objects
--     for select to authenticated using (bucket_id = 'fotos');
--
-- Sin ninguna restricción de ruta. Eso no cerró el agujero: cambió «cualquiera
-- en internet» por «cualquiera con una cuenta». Y como el registro es abierto y
-- `enable_confirmations = false`, esas dos poblaciones se separan por treinta
-- segundos de trámite.
--
-- Las URLs firmadas tampoco protegían: firmar no es autorizar. Quien tiene
-- sesión pide la firma él mismo con `createSignedUrl(ruta)`, o descarga
-- directo. La caducidad de una hora solo limita a quien recibe una URL ajena,
-- no a quien puede generarla.
--
-- Qué quedaba expuesto, en concreto:
--   · la foto de perfil de un usuario desactivado (`activo = false`),
--   · las fotos de una publicación oculta por reportes,
--   · las fotos de una publicación desactivada por su dueño,
--   · y, hasta que el barredor de `fotos_huerfanas` corra, las de una
--     publicación ya BORRADA, que su dueño cree eliminadas (0021).
--
-- LA CORRECCIÓN: la visibilidad de un objeto se deriva de la visibilidad de la
-- fila que lo referencia, y esa ya está decidida en las vistas públicas. No se
-- duplica la regla de negocio: se consulta. Si mañana `publicaciones_publicas`
-- cambia su criterio, estas policies lo heredan sin tocarse.
--
-- Por qué las vistas y no las tablas: las policies se evalúan con el rol
-- `authenticated`, así que un `exists` contra `publicaciones` devolvería solo
-- las propias (policy publicaciones_select_propias) y ocultaría las fotos de
-- todo el mundo — el síntoma de AUD-01, ahora en Storage. Las vistas llevan
-- `security_invoker = false` a propósito y sí ven el catálogo completo.
--
-- El dueño conserva acceso SIEMPRE, aunque su contenido no sea visible para
-- nadie más: necesita ver sus propias fotos en "Mis publicaciones" y en su
-- perfil aunque la publicación esté desactivada o su cuenta dada de baja.
--
-- Verificado por las aserciones 22 a 25 de supabase/tests/rls.test.sql, que se
-- escribieron antes que esta migración y fallaban con `have: 1, want: 0`.
--
-- Reversión (reabre la fuga; no hay razón para hacerlo):
--   drop policy if exists "leer foto de perfil visible" on storage.objects;
--   drop policy if exists "leer foto de publicacion visible o propia" on storage.objects;
--   create policy "leer fotos con sesion" on storage.objects
--     for select to authenticated using (bucket_id = 'fotos');

drop policy if exists "leer fotos con sesion" on storage.objects;

-- ============================================================
-- Fotos de perfil:  perfiles/<usuario>.jpg
-- ============================================================
drop policy if exists "leer foto de perfil visible" on storage.objects;
create policy "leer foto de perfil visible" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'fotos'
    and (storage.foldername(name))[1] = 'perfiles'
    and (
      -- La propia, siempre: el dueño no pierde su foto por desactivarse.
      name = 'perfiles/' || auth.uid()::text || '.jpg'
      -- La ajena, solo si esa persona aparece en la vista pública, que ya
      -- filtra por `activo = true`.
      or exists (
        select 1 from public.perfiles_publicos p
         where storage.objects.name = 'perfiles/' || p.id::text || '.jpg'
      )
    )
  );

-- ============================================================
-- Fotos de publicación:  publicaciones/<usuario>/<publicacion>/<n>.jpg
-- ============================================================
-- El layout viene de 0002 y lo conservó 0016 a propósito (renombrar filas de
-- storage.objects no mueve el objeto subyacente). `storage.foldername` lo
-- descompone igual que en la policy de UPDATE de la 0019.
drop policy if exists "leer foto de publicacion visible o propia" on storage.objects;
create policy "leer foto de publicacion visible o propia" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'fotos'
    and (storage.foldername(name))[1] = 'publicaciones'
    and (
      -- Propia: el segundo segmento de la ruta es el dueño.
      (storage.foldername(name))[2] = auth.uid()::text
      -- Ajena: solo si la publicación está en la vista, que ya exige
      -- `activa = true and oculta_por_reportes = false`.
      or exists (
        select 1 from public.publicaciones_publicas pp
         where (storage.foldername(storage.objects.name))[3] = pp.id::text
      )
    )
  );

comment on policy "leer foto de publicacion visible o propia" on storage.objects is
  'La visibilidad del objeto se deriva de publicaciones_publicas, no se reescribe. '
  'Duplicar la regla en dos sitios garantiza que algun dia se cambie en uno solo.';
