// Deja la base lista para la DEMO EN VIVO: tres cuentas fabricadas (@cuervopass-demo.test), con estados distintos a propósito.
//
//   demo.estudiante  estudiante con perfil completo. Es quien busca (Depas, Servicios, reseña, chat).
//   demo.vendedor    comerciante SIN verificar: con ella se enseña el flujo COMPLETO en vivo (subir documentos de muestra →
//                    el admin aprueba en la terminal → empieza la prueba gratis → publicar un negocio).
//   demo.comerciante comerciante YA verificada, con su negocio publicado: para enseñar planes, menú y reseñas sin esperar.
//
// NO inventa reseñas ni calificaciones: un negocio sin reseñas se ve sin estrellas, y la reseña se escribe EN VIVO desde la cuenta del
// estudiante. Las imágenes de verificación son de MUESTRA (scripts/generar-muestras-demo.py): nunca un documento verdadero.
//
// Por omisión solo MUESTRA lo que haría. Para ejecutarlo: --aplicar. Para quitar las tres cuentas y todo lo suyo (cascada): --limpiar.
//   node --env-file=.env --env-file=.env.server scripts/preparar-demo.mjs [--aplicar | --limpiar]
//
// Escribe en PRODUCCIÓN (usa la llave de servicio): lee el plan antes de pasar --aplicar. Idempotente: lo que ya existe se reutiliza.

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const servicioKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anon || !servicioKey) {
  console.error('Faltan EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const aplicar = process.argv.includes('--aplicar');
const limpiar = process.argv.includes('--limpiar');

const admin = createClient(url, servicioKey, { auth: { autoRefreshToken: false, persistSession: false } });
const PASSWORD_DEMO = 'Prueba123!'; // la misma de las 100 cuentas de seed-demo.mjs: es de demostración, no protege nada real
const UTVT = { lat: 19.32568, lng: -99.458244 };
const UNIVERSIDAD = 'Universidad Tecnológica del Valle de Toluca (UTVT)';

const CUENTAS = [
  { email: 'demo.estudiante@cuervopass-demo.test', usuario: 'demo_estudiante', nombre: 'Estudiante de Demo', rol: null },
  { email: 'demo.vendedor@cuervopass-demo.test', usuario: 'demo_vendedor', nombre: 'Vendedor de Demo', rol: 'comerciante' },
  { email: 'demo.comerciante@cuervopass-demo.test', usuario: 'demo_comerciante', nombre: 'Comerciante de Demo', rol: 'comerciante' },
];

async function idDe(email) {
  // Sin endpoint por correo en el cliente admin: se recorre la lista (pocas páginas) y se compara exacto.
  for (let pagina = 1; pagina <= 20; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => x.email === email);
    if (u) return u.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

if (limpiar) {
  for (const c of CUENTAS) {
    const id = await idDe(c.email);
    if (!id) { console.log(`${c.email}: no existe`); continue; }
    if (aplicar) {
      // La evidencia vive en Storage y no se borra en cascada: se quita primero.
      for (const carpeta of [`${id}/comerciante`, `${id}`]) {
        const { data: archivos } = await admin.storage.from('verificacion').list(carpeta, { limit: 100 });
        const rutas = (archivos ?? []).filter((f) => f.id).map((f) => `${carpeta}/${f.name}`);
        if (rutas.length) await admin.storage.from('verificacion').remove(rutas);
      }
      const { error } = await admin.auth.admin.deleteUser(id);
      console.log(error ? `${c.email}: ERROR ${error.message}` : `${c.email}: borrada`);
    } else console.log(`${c.email}: se borraría (con --aplicar)`);
  }
  process.exit(0);
}

console.log(aplicar ? 'APLICANDO en producción:\n' : 'PLAN (no se escribe nada; usa --aplicar):\n');
for (const c of CUENTAS) console.log(`  · ${c.email}  (${c.nombre}${c.rol ? `, función ${c.rol}` : ', estudiante'})`);
console.log('  · demo.vendedor    → comerciante SIN verificar (la verificación se hace en vivo)');
console.log('  · demo.comerciante → verificación enviada con imágenes de MUESTRA y APROBADA por el admin; un negocio publicado (sin reseñas)');
if (!aplicar) process.exit(0);

const admins = (await admin.from('roles_usuario').select('usuario_id').eq('rol', 'admin').eq('estado', 'aprobado')).data ?? [];
if (admins.length !== 1) { console.error(`Se esperaba exactamente 1 admin aprobado y hay ${admins.length}.`); process.exit(1); }
const adminId = admins[0].usuario_id;

const ids = {};
for (const c of CUENTAS) {
  let id = await idDe(c.email);
  if (!id) {
    const { data, error } = await admin.auth.admin.createUser({ email: c.email, password: PASSWORD_DEMO, email_confirm: true });
    if (error || !data?.user) { console.error(`${c.email}: ${error?.message}`); process.exit(1); }
    id = data.user.id;
    console.log(`${c.email}: creada`);
  } else console.log(`${c.email}: ya existía`);
  ids[c.email] = id;

  const { error: eU } = await admin.from('usuarios').update({
    nombre_usuario: c.usuario, nombre_completo: c.nombre,
    biografia: 'Cuenta de demostración de Cuervo 360. No es una persona real.',
    perfil_texto: 'Estudiante tranquilo, busco depa cerca de la UTVT, sin mascotas y sin fumar.',
    presupuesto_min: 2000, presupuesto_max: 3500, distancia_max_km: 5, mascotas: false, fuma: false,
    nivel_ruido: 'bajo', horario_predominante: 'diurno', busca_roomie: c.rol === null,
    cuestionario_completo: true, acepto_aviso_privacidad_en: new Date().toISOString(), consiente_analisis_ia: true,
    universidad: UNIVERSIDAD, latitud_universidad: UTVT.lat, longitud_universidad: UTVT.lng, activo: true,
  }).eq('id', id);
  if (eU) { console.error(`${c.email}: perfil: ${eU.message}`); process.exit(1); }

  if (c.rol) {
    const { error } = await admin.from('roles_usuario').upsert({ usuario_id: id, rol: c.rol }, { onConflict: 'usuario_id,rol', ignoreDuplicates: true });
    if (error) { console.error(`${c.email}: rol: ${error.message}`); process.exit(1); }
  }
}

// demo.comerciante: enviar la verificación COMO ELLA (la RPC usa auth.uid()), con imágenes de muestra, y aprobarla con el admin.
const emailC = 'demo.comerciante@cuervopass-demo.test';
const idC = ids[emailC];
const { data: estadoC } = await admin.from('roles_usuario').select('estado').eq('usuario_id', idC).eq('rol', 'comerciante').single();
if (estadoC.estado === 'sin_verificar' || estadoC.estado === 'rechazado') {
  const sesion = createClient(url, anon, { auth: { persistSession: false } });
  const { error: eLogin } = await sesion.auth.signInWithPassword({ email: emailC, password: PASSWORD_DEMO });
  if (eLogin) { console.error(`login demo.comerciante: ${eLogin.message}`); process.exit(1); }
  const subir = async (archivo, etiqueta) => {
    const ruta = `${idC}/comerciante/${etiqueta}-${Date.now()}-demo.jpg`;
    const { error } = await sesion.storage.from('verificacion').upload(ruta, readFileSync(`demo-material/${archivo}`), { contentType: 'image/jpeg' });
    if (error) throw new Error(`subir ${archivo}: ${error.message}`);
    return ruta;
  };
  const frente = await subir('muestra-ine-frente.jpg', 'ine-frente');
  const reverso = await subir('muestra-ine-reverso.jpg', 'ine-reverso');
  const lugar = await subir('muestra-local-1.jpg', 'lugar-1');
  const { error: eEnv } = await sesion.rpc('enviar_verificacion', {
    p_rol: 'comerciante', p_nombre_legal: 'Persona De Muestra', p_direccion: 'Calle Ejemplo 1, Lerma',
    p_ine_frente: frente, p_ine_reverso: reverso, p_fotos: [lugar], p_version_aviso: 'v2',
  });
  if (eEnv) { console.error(`enviar_verificacion: ${eEnv.code} ${eEnv.message}`); process.exit(1); }
  const { error: eRes } = await admin.rpc('resolver_verificacion', { p_usuario: idC, p_rol: 'comerciante', p_aprobar: true, p_motivo: null, p_admin: adminId });
  if (eRes) { console.error(`resolver_verificacion: ${eRes.code} ${eRes.message}`); process.exit(1); }
  await sesion.auth.signOut();
  console.log('demo.comerciante: verificada (con imágenes de muestra) y en periodo de prueba');
}

const { count } = await admin.from('negocios').select('id', { count: 'exact', head: true }).eq('usuario_id', idC);
if (!count) {
  const { error } = await admin.from('negocios').insert({
    usuario_id: idC, categoria_id: 'comida', nombre: 'Taquería Demo 360', direccion: 'Calle Ejemplo 1, Lerma',
    descripcion: 'Negocio de demostración de Cuervo 360. No existe.', rango_precio: 1, horario: 'Lun a sáb · 9 am a 6 pm',
    latitud: 19.3262, longitud: -99.4575, fotos: [],
  });
  if (error) { console.error(`negocio: ${error.message}`); process.exit(1); }
  console.log('demo.comerciante: negocio «Taquería Demo 360» publicado, sin reseñas');
}
console.log('\nListo. Contraseña de las tres cuentas (solo de demostración):', PASSWORD_DEMO);
console.log('Falta: node --env-file=.env --env-file=.env.server --env-file=ai-service/.env scripts/backfill-embeddings.mjs (vectores de afinidad)');
