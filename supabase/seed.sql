-- Cuervo Pass — datos de prueba para la demo. Documento maestro v5 · §36.
--
-- No registres usuarios en vivo frente a la maestra: carga esto con antelación.
--
-- CAMBIO IMPORTANTE frente a v3: las publicaciones ya NO se pueden insertar sin
-- dueño. `publicaciones.usuario_id` es NOT NULL desde la migración 0010, porque
-- una publicación huérfana no puede aparecer en sugerencias (la consulta une
-- con `perfiles_publicos`) ni revelar contacto. Antes ese `null` permitía un
-- seed de una sola línea y un catálogo que el motor nunca iba a devolver.
--
-- Cómo usar:
--   1) Crea las 3 cuentas demo UNA vez, desde la app o desde el panel de
--      Supabase (Authentication > Users > Add user):
--        perfil-a@demo.cuervopass.com
--        perfil-b@demo.cuervopass.com
--        perfil-c@demo.cuervopass.com
--      El trigger handle_new_user (§12, migración 0009) crea su fila en
--      `usuarios` automáticamente.
--   2) Corre este archivo completo en el SQL Editor.
--
-- Para un catálogo grande y realista, usa scripts/seed-demo.mjs (100 cuentas
-- alrededor de la UTVT) en vez de esto.

-- ============================================================
-- Perfiles de ejemplo
-- ============================================================
-- UTVT — coordenadas reales, no aproximadas: la distancia que se muestra en la
-- demo tiene que corresponder con la dirección de verdad.
update usuarios set
  nombre_completo = 'Perfil A (demo)',
  presupuesto_min = 2000, presupuesto_max = 3000,
  distancia_max_km = 10,
  mascotas = false, fuma = false, nivel_ruido = 'bajo', horario_predominante = 'nocturno',
  biografia = 'Soy tranquilo, estudio en las noches, no fumo',
  perfil_texto = 'Prefiero el silencio para estudiar. No fumo y no tengo mascotas.',
  universidad = 'Universidad Tecnológica del Valle de Toluca (UTVT)',
  latitud_universidad = 19.32568, longitud_universidad = -99.458244,
  cuestionario_completo = true,
  acepto_aviso_privacidad_en = now(),
  consiente_analisis_ia = true
where id = (select id from auth.users where email = 'perfil-a@demo.cuervopass.com');

update usuarios set
  nombre_completo = 'Perfil B (demo)',
  presupuesto_min = 3000, presupuesto_max = 4500,
  distancia_max_km = 15,
  mascotas = true, fuma = false, nivel_ruido = 'medio', horario_predominante = 'mixto',
  biografia = 'Trabajo medio tiempo, tengo mascota, soy sociable',
  perfil_texto = 'Tengo un perro pequeño y trabajo medio tiempo. Me gusta convivir.',
  universidad = 'Universidad Tecnológica del Valle de Toluca (UTVT)',
  latitud_universidad = 19.32568, longitud_universidad = -99.458244,
  cuestionario_completo = true,
  acepto_aviso_privacidad_en = now(),
  consiente_analisis_ia = true
where id = (select id from auth.users where email = 'perfil-b@demo.cuervopass.com');

update usuarios set
  nombre_completo = 'Perfil C (demo)',
  presupuesto_min = 1500, presupuesto_max = 2200,
  distancia_max_km = 5,
  mascotas = false, fuma = false, nivel_ruido = 'bajo', horario_predominante = 'diurno',
  biografia = 'Busco algo económico, silencioso, cerca de la escuela',
  perfil_texto = 'Busco algo barato y silencioso, lo más cerca posible del campus.',
  universidad = 'Universidad Tecnológica del Valle de Toluca (UTVT)',
  latitud_universidad = 19.32568, longitud_universidad = -99.458244,
  cuestionario_completo = true,
  acepto_aviso_privacidad_en = now(),
  consiente_analisis_ia = true
where id = (select id from auth.users where email = 'perfil-c@demo.cuervopass.com');

-- ============================================================
-- Publicaciones de ejemplo
-- ============================================================
-- Coordenadas verificadas a mano contra colonias reales del valle de Toluca.
-- §9 y §36: geocodificar el catálogo de demo una sola vez, a mano, es el
-- respaldo correcto aunque el geocoding en vivo funcione — y aquí queda
-- declarado en `geocodificado_por`, que es lo que AUD-02 pide.
--
-- Los atributos van EXPLÍCITOS (permite_mascotas, amueblado...). v3 los dejaba
-- escondidos en la descripción y el motor los adivinaba con `ilike '%mascota%'`,
-- que hace que "no mascotas" cuente como que sí.
with dueno as (
  select id from auth.users where email = 'perfil-b@demo.cuervopass.com'
)
insert into publicaciones (
  usuario_id, titulo, tipo, direccion, latitud, longitud, geocodificado_por,
  precio_renta, descripcion, permite_mascotas, amueblado, servicios_incluidos,
  recamaras, whatsapp, activa
)
select d.id, v.titulo, v.tipo, v.direccion, v.lat, v.lng, 'catalogo-demo-verificado-a-mano',
       v.precio, v.descripcion, v.mascotas, v.amueblado, v.servicios, v.recamaras, v.whatsapp, true
from dueno d
cross join (values
  ('Depa de 1 recámara amueblado', 'depa',
   'Av. Solidaridad 120, Santa María Atarasquillo, Lerma, México, CP 52044',
   19.325679, -99.458243, 2800, 'Una recámara, amueblado, listo para entrar.',
   false, true, false, 1, '7221000001'),
  ('Depa de 2 recámaras pet friendly', 'depa',
   'Calle Reforma 45, San Pedro Tultepec, Lerma, México, CP 52072',
   19.266388, -99.5088, 4200, 'Dos recámaras, acepta mascotas, cerca del transporte.',
   true, false, false, 2, '7221000002'),
  ('Cuarto en casa compartida tranquila', 'cuarto',
   'Privada Hidalgo 8, Lerma de Villada Centro, Lerma, México, CP 52000',
   19.286393, -99.510969, 1800, 'Ambiente tranquilo, ideal para estudiar.',
   false, true, true, 1, '7221000003'),
  ('Depa cerca del centro de San Mateo', 'depa',
   'Av. Independencia 210, San Mateo Atenco Centro, San Mateo Atenco, México, CP 50100',
   19.26372, -99.52952, 3500, 'Una recámara, no fumadores.',
   false, true, false, 1, '7221000004'),
  ('Loft pequeño para una persona', 'depa',
   'Calle Morelos 33, Metepec Centro, Metepec, México, CP 52140',
   19.252617, -99.60566, 2200, 'Loft de un ambiente, ideal para una persona.',
   false, true, true, 1, '7221000005'),
  ('Casa compartida por habitación', 'casa_compartida',
   'Camino Real 77, San Miguel Totocuitlapilco, Metepec, México, CP 52166',
   19.235, -99.59, 2000, 'Habitación en casa compartida, permite mascotas.',
   true, false, false, 3, '7221000006')
) as v(titulo, tipo, direccion, lat, lng, precio, descripcion,
       mascotas, amueblado, servicios, recamaras, whatsapp)
on conflict do nothing;

-- Los vectores (perfil_vector y vector_embedding) NO se cargan aquí: se generan
-- con scripts/backfill-embeddings.mjs, que llama al microservicio. Sin ellos la
-- app funciona en Nivel 1, que es justamente la degradación que §18 describe.
