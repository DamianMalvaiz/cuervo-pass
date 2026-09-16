-- Cuervo de Paz — datos de prueba para la demo (sección 19 del doc maestro).
-- No registres usuarios en vivo frente a la maestra: carga esto con antelación.
--
-- Cómo usar:
-- 1) Las publicaciones de abajo no requieren dueño (usuario_id nullable) — corren tal cual.
-- 2) Los 3 perfiles de ejemplo SÍ necesitan una cuenta real de Supabase Auth (usuarios.id
--    referencia auth.users). Créalas UNA VEZ, desde la app (pantalla de registro) o desde
--    el dashboard de Supabase (Authentication > Users > Add user), con estos correos:
--      perfil-a@demo.cuervodepaz.com
--      perfil-b@demo.cuervodepaz.com
--      perfil-c@demo.cuervodepaz.com
--    Al registrarte desde la app se crea la fila en `usuarios` automáticamente (ver
--    src/app/(auth)/registro.tsx). Luego corre los UPDATE de abajo para completar
--    presupuesto/mascotas/ruido de cada perfil.

-- ============================================================
-- Publicaciones de ejemplo (ajusta a tu zona real, ej. cerca de tu universidad)
-- ============================================================
insert into publicaciones (direccion, precio_renta, descripcion, whatsapp, activa) values
  ('San Mateo Atenco, Edo. Méx.', 2800, '1 recámara, amueblado, no mascotas', '5215500000001', true),
  ('Metepec, Edo. Méx.', 4200, '2 recámaras, permite mascotas, cerca de transporte', '5215500000002', true),
  ('Toluca centro, Edo. Méx.', 1800, 'Cuarto en casa compartida, ambiente tranquilo', '5215500000003', true),
  ('Santa Fe, CDMX', 6500, '1 recámara, cerca de oficinas corporativas', '5215500000004', true),
  ('San Mateo Atenco, Edo. Méx.', 3500, '2 recámaras, no fumadores', '5215500000005', true),
  ('Toluca, Edo. Méx.', 2200, 'Loft pequeño, ideal para una persona', '5215500000006', true),
  ('Metepec, Edo. Méx.', 2000, 'Casa compartida 3 recámaras por habitación, permite mascotas', '5215500000007', true),
  ('Cerca de UTVT', 3000, 'Depa amueblado, incluye servicios', '5215500000008', true),
  ('San Mateo Atenco, Edo. Méx.', 2500, '1 recámara, recién remodelado', '5215500000009', true),
  ('Toluca, Edo. Méx.', 1500, 'Cuarto en depa compartido, ambiente de estudiantes', '5215500000010', true);

-- ============================================================
-- Perfiles de ejemplo — corre esto DESPUÉS de registrar las 3 cuentas demo (ver arriba)
-- ============================================================
-- Perfil A: presupuesto $2,000-$3,000, no mascotas, ruido bajo
update usuarios set
  presupuesto_min = 2000, presupuesto_max = 3000,
  mascotas = false, fuma = false, nivel_ruido = 'bajo',
  biografia = 'Soy tranquilo, estudio en las noches, no fumo'
where nombre_usuario = 'perfil-a';

-- Perfil B: presupuesto $3,000-$4,500, tiene un perro pequeño, ruido medio
update usuarios set
  presupuesto_min = 3000, presupuesto_max = 4500,
  mascotas = true, fuma = false, nivel_ruido = 'medio',
  biografia = 'Trabajo medio tiempo, tengo mascota, soy sociable'
where nombre_usuario = 'perfil-b';

-- Perfil C: presupuesto $1,500-$2,200, sin mascotas, ruido bajo
update usuarios set
  presupuesto_min = 1500, presupuesto_max = 2200,
  mascotas = false, fuma = false, nivel_ruido = 'bajo',
  biografia = 'Busco algo económico, silencioso, cerca de la escuela'
where nombre_usuario = 'perfil-c';
