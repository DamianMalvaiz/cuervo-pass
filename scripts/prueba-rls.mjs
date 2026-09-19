#!/usr/bin/env node
//
// Prueba de aislamiento entre cuentas · documento maestro v5 §33.1
//
//   node --env-file=.env scripts/prueba-rls.mjs
//
// Crea DOS cuentas temporales —A y B— y comprueba, contra la base de
// producción y con sesiones reales, que A no puede tocar nada de B. Al terminar
// las borra. Sale con código 1 si alguna barrera cede.
//
// Por qué existe además de supabase/tests/rls.test.sql:
//
//   Las 21 aserciones de pgTAP corren en LOCAL y en CI, contra un esquema
//   reconstruido desde las migraciones. Producción no es idéntica: tiene un
//   event trigger `ensure_rls` que Supabase instala y el local no, así que CI
//   valida un esquema MÁS LAXO que el real. Esta prueba pregunta en el sitio
//   donde va a ocurrir la demo.
//
//   Y pregunta por HTTP, a través de PostgREST, que es el camino de la app.
//   pgTAP habla con Postgres directamente; si una policy fuera correcta pero
//   una vista o un grant expusieran de más por PostgREST, pgTAP no lo vería.
//
// Detalle que importa al leer los resultados: RLS casi nunca da error. En un
// SELECT devuelve CERO FILAS, y en un UPDATE o DELETE afecta CERO FILAS, ambos
// sin avisar. Por eso cada comprobación afirma sobre el número de filas y no
// sobre la presencia de una excepción. Un "no hubo error" aquí no prueba nada.

import { createClient } from '@supabase/supabase-js';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const pruebas = [];
const comprobar = (nombre, pasa, detalle) => pruebas.push({ nombre, pasa, detalle });

async function crearCuenta(etiqueta) {
  const correo = `rls-${etiqueta}-${Date.now()}@ejemplo.mx`;
  const clave = `PruebaRls${Date.now()}Ok`;
  const { data, error } = await admin.auth.admin.createUser({
    email: correo, password: clave, email_confirm: true,
    user_metadata: { nombre_usuario: `rls${etiqueta}${Date.now()}`, nombre_completo: `RLS ${etiqueta}` },
  });
  if (error) throw error;
  const anon = createClient(URL, ANON, { auth: { persistSession: false } });
  const s = await anon.auth.signInWithPassword({ email: correo, password: clave });
  if (s.error) throw s.error;
  const cliente = createClient(URL, ANON, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${s.data.session.access_token}` } },
  });
  return { id: data.user.id, correo, cliente };
}

let A = null, B = null;
try {
  A = await crearCuenta('a');
  B = await crearCuenta('b');

  // B se pone datos sensibles y publica. Todo con SU sesión, por el camino normal.
  await B.cliente.from('usuarios').update({
    presupuesto_min: 2000, presupuesto_max: 7777,
    perfil_texto: 'SECRETO-DE-B-NO-DEBE-VERSE',
    universidad: 'UTVT', distancia_max_km: 10, nivel_ruido: 'bajo',
    latitud_universidad: 19.28, longitud_universidad: -99.55, cuestionario_completo: true,
  }).eq('id', B.id);

  const { data: pubB, error: ePub } = await B.cliente.from('publicaciones').insert({
    usuario_id: B.id, titulo: 'Depa de B', tipo: 'depa', direccion: 'Calle B 1',
    precio_renta: 3000, whatsapp: '5599999999', latitud: 19.29, longitud: -99.56,
  }).select().single();
  if (ePub) throw new Error('B no pudo publicar: ' + ePub.message);

  // ── 1 · la tabla usuarios ─────────────────────────────────────────────
  const { data: todos } = await A.cliente.from('usuarios').select('id');
  comprobar('A solo ve su propia fila en `usuarios`',
    todos?.length === 1 && todos[0].id === A.id,
    `devolvió ${todos?.length ?? 0} fila(s)`);

  const { data: filaB } = await A.cliente.from('usuarios').select('*').eq('id', B.id);
  comprobar('A no puede leer la fila de B ni pidiéndola por id',
    (filaB?.length ?? 0) === 0, `devolvió ${filaB?.length ?? 0} fila(s)`);

  // ── 2 · el texto libre y el presupuesto, que son lo sensible ──────────
  const { data: vistaPerfiles } = await A.cliente.from('perfiles_publicos').select('*').limit(1);
  const columnas = vistaPerfiles?.[0] ? Object.keys(vistaPerfiles[0]) : [];
  comprobar('`perfiles_publicos` no expone presupuesto ni texto libre',
    !columnas.includes('presupuesto_max') && !columnas.includes('perfil_texto'),
    columnas.length ? `columnas: ${columnas.join(', ')}` : 'la vista no devolvió filas');

  // ── 3 · el teléfono, que es el dato que se cobra ──────────────────────
  const { data: pubTabla } = await A.cliente.from('publicaciones').select('whatsapp').eq('id', pubB.id);
  comprobar('A no obtiene el teléfono de B leyendo la TABLA publicaciones',
    (pubTabla?.length ?? 0) === 0, `devolvió ${pubTabla?.length ?? 0} fila(s)`);

  const { data: vistaPub } = await A.cliente.from('publicaciones_publicas').select('*').eq('id', pubB.id);
  const colsPub = vistaPub?.[0] ? Object.keys(vistaPub[0]) : [];
  comprobar('A ve la publicación de B en la vista pública, pero SIN teléfono',
    (vistaPub?.length ?? 0) === 1 && !colsPub.includes('whatsapp'),
    `${vistaPub?.length ?? 0} fila(s)` + (colsPub.length ? `, whatsapp ${colsPub.includes('whatsapp') ? 'PRESENTE' : 'ausente'}` : ''));

  // ── 4 · escritura ajena. RLS no da error: afecta cero filas ───────────
  const { data: upd } = await A.cliente.from('publicaciones')
    .update({ precio_renta: 1 }).eq('id', pubB.id).select();
  comprobar('A no puede modificar la publicación de B',
    (upd?.length ?? 0) === 0, `filas afectadas: ${upd?.length ?? 0}`);

  const { data: del } = await A.cliente.from('publicaciones').delete().eq('id', pubB.id).select();
  comprobar('A no puede borrar la publicación de B',
    (del?.length ?? 0) === 0, `filas afectadas: ${del?.length ?? 0}`);

  const { error: eSupl } = await A.cliente.from('publicaciones').insert({
    usuario_id: B.id, titulo: 'Suplantada', tipo: 'depa', direccion: 'x', precio_renta: 1, whatsapp: '5500000000',
  });
  comprobar('A no puede publicar HACIÉNDOSE PASAR por B',
    !!eSupl, eSupl ? eSupl.message.slice(0, 58) : 'SE INSERTÓ — la policy no comprueba usuario_id');

  const { data: updPerfil } = await A.cliente.from('usuarios')
    .update({ presupuesto_max: 1 }).eq('id', B.id).select();
  comprobar('A no puede modificar el perfil de B',
    (updPerfil?.length ?? 0) === 0, `filas afectadas: ${updPerfil?.length ?? 0}`);

  // ── 5 · tablas de servicio ───────────────────────────────────────────
  const { data: cuotas } = await A.cliente.from('cuotas_uso').select('*');
  comprobar('`cuotas_uso` no es legible desde el cliente, ni la propia',
    (cuotas?.length ?? 0) === 0, `devolvió ${cuotas?.length ?? 0} fila(s)`);

  // ── 6 · mensajes ajenos ──────────────────────────────────────────────
  const conv = await B.cliente.rpc('abrir_conversacion', { p_otro: A.id });
  await B.cliente.from('mensajes').insert({ conversacion_id: conv.data, remitente_id: B.id, contenido: 'hola A' });
  const { data: mod } = await A.cliente.from('mensajes')
    .update({ contenido: 'alterado' }).eq('conversacion_id', conv.data).select();
  comprobar('A no puede alterar el contenido de un mensaje de B',
    (mod?.length ?? 0) === 0, `filas afectadas: ${mod?.length ?? 0}`);

  const C = await crearCuenta('c');
  const { data: fisgon } = await C.cliente.from('mensajes').select('*').eq('conversacion_id', conv.data);
  comprobar('Una tercera cuenta no ve los mensajes de una conversación ajena',
    (fisgon?.length ?? 0) === 0, `devolvió ${fisgon?.length ?? 0} fila(s)`);
  await admin.auth.admin.deleteUser(C.id);

  // ── 7 · sin sesión ───────────────────────────────────────────────────
  const sinSesion = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: anonUsuarios } = await sinSesion.from('usuarios').select('id');
  comprobar('Sin sesión no se lee `usuarios`',
    (anonUsuarios?.length ?? 0) === 0, `devolvió ${anonUsuarios?.length ?? 0} fila(s)`);

  // ── 8 · Storage: la carpeta de otro ──────────────────────────────────
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const { error: eAjena } = await A.cliente.storage.from('fotos')
    .upload(`publicaciones/${B.id}/intruso/0.jpg`, bytes, { contentType: 'image/jpeg' });
  comprobar('A no puede subir a la carpeta de publicaciones de B',
    !!eAjena, eAjena ? eAjena.message.slice(0, 58) : 'SE SUBIÓ — el bucket está abierto');

  const { error: ePerfilAjeno } = await A.cliente.storage.from('fotos')
    .upload(`perfiles/${B.id}.jpg`, bytes, { contentType: 'image/jpeg', upsert: true });
  comprobar('A no puede sobrescribir la foto de perfil de B',
    !!ePerfilAjeno, ePerfilAjeno ? ePerfilAjeno.message.slice(0, 58) : 'SE SUBIÓ — la policy de UPDATE no filtra por dueño');

} catch (e) {
  comprobar('La prueba se completó', false, e.message);
} finally {
  if (A) await admin.auth.admin.deleteUser(A.id).catch(() => {});
  if (B) await admin.auth.admin.deleteUser(B.id).catch(() => {});
}

console.log('\nPrueba de aislamiento entre cuentas · contra producción, por HTTP\n');
for (const p of pruebas) {
  const marca = p.pasa ? '\x1b[32m[ BLOQUEADO ]\x1b[0m' : '\x1b[31m[  EXPUESTO ]\x1b[0m';
  console.log(`  ${marca} ${p.nombre}`);
  console.log(`                 ${p.detalle}`);
}
const fallos = pruebas.filter((p) => !p.pasa).length;
console.log(`\n  ${pruebas.length - fallos} de ${pruebas.length} barreras aguantaron.\n`);
console.log('  Nota: RLS no lanza errores. En un SELECT devuelve cero filas y en un');
console.log('  UPDATE afecta cero filas, en silencio. Por eso arriba se afirma sobre');
console.log('  el NÚMERO DE FILAS: "no hubo error" no probaría nada.\n');
process.exit(fallos > 0 ? 1 : 0);
