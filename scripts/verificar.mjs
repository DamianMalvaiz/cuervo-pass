#!/usr/bin/env node
//
// Verificación pre-demo.
//
// Por qué existe: los tres fallos del 18/09/2026 —el perfil_vector borrado por
// un hipo de red, revelar_contacto muriendo con 42P10, y el secret AI_SERVICE_URL
// apuntando a un túnel muerto— tenían una cosa en común: NINGUNO se anunció.
// Los tres se encontraron de casualidad, y los tres habrían aparecido en vivo.
//
// Este script no arregla nada ni borra nada. Solo pregunta, en diez segundos,
// las cosas que duelen delante del profesor.
//
//   node scripts/verificar.mjs
//
// Sale con código 1 si algo está roto, 0 si solo hay avisos.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

try { process.loadEnvFile('.env'); } catch { /* las variables ya pueden venir del entorno */ }

const URL_SB = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICIO = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_SB || !ANON || !SERVICIO) {
  console.error('Faltan EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}

const admin = createClient(URL_SB, SERVICIO, { auth: { persistSession: false } });
const resultados = [];
const anotar = (nombre, estado, detalle) => resultados.push({ nombre, estado, detalle });

// ═══════════════════════════════════════════════════════════════════
// 1 · Los secrets de las Edge Functions
// ═══════════════════════════════════════════════════════════════════
// AI_SERVICE_URL apuntando al sitio equivocado ya costó una noche entera: la
// función respondía, el microservicio estaba vivo, y aun así todo caía a Nivel 1.
function revisarSecrets() {
  let nombres;
  try {
    // El CLI intercala avisos ("A new version is available", mensajes de npx)
    // ANTES del JSON, asi que no se puede parsear la salida entera. Se busca el
    // primer objeto.
    const salida = execFileSync('npx', ['supabase', 'secrets', 'list'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 });
    const inicio = salida.indexOf('{');
    if (inicio === -1) throw new Error(`sin JSON en la salida: ${salida.trim().slice(0, 70)}`);
    nombres = new Set(JSON.parse(salida.slice(inicio)).secrets.map((s) => s.name));
  } catch (e) {
    // El motivo real y no una conjetura. La version anterior decia "¿sesion de
    // supabase caducada?", que sonaba a diagnostico y era invencion: cuando
    // fallo de verdad, la sesion estaba perfectamente viva. Un diagnostico
    // inventado manda a quien lo lee a buscar donde no es.
    const detalle = (e.stderr || e.message || '').toString().trim().split('\n')[0].slice(0, 80);
    anotar('Secrets de Edge Functions', 'aviso', `no se pudieron listar — ${detalle || 'sin detalle'}`);
    return;
  }
  const obligatorios = ['AI_SERVICE_URL', 'AI_SHARED_TOKEN'];
  const faltan = obligatorios.filter((n) => !nombres.has(n));
  if (faltan.length) anotar('Secrets de Edge Functions', 'fallo', `faltan: ${faltan.join(', ')}`);
  else anotar('Secrets de Edge Functions', 'ok', `${obligatorios.length} obligatorios presentes`);

  // ANTHROPIC_API_KEY NO se comprueba aquí. Una versión anterior la buscaba en
  // esta lista y avisaba de que faltaba — pero esa clave vive en
  // ai-service/.env, no en los secrets de las Edge Functions, porque quien
  // llama al modelo es el microservicio. La comprobación era una falsa alarma
  // por construcción: habría avisado igual con la clave perfectamente puesta.
  // Se pregunta en revisarTunel(), leyendo `api_llm_configurada` de /listo, que
  // es el propio servicio diciendo si la tiene.
}

// ═══════════════════════════════════════════════════════════════════
// 2 · El túnel, comprobado POR FUERA
// ═══════════════════════════════════════════════════════════════════
// En localhost siempre se ve bien. Lo que importa es el camino que recorre la
// Edge Function, así que se pregunta por el dominio público.
async function revisarTunel() {
  let dominio;
  try { dominio = readFileSync('.tunel-actual', 'utf8').trim(); }
  catch { anotar('Túnel a Cloudflare', 'aviso', 'no hay .tunel-actual (¿corriste scripts/tunel.sh?)'); return; }
  try {
    const t0 = Date.now();
    const r = await fetch(`${dominio}/listo`, { signal: AbortSignal.timeout(10_000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const salud = await r.json().catch(() => ({}));
    anotar('Túnel a Cloudflare', 'ok', `${dominio} · /listo en ${Date.now() - t0} ms`);

    // El propio microservicio dice si tiene la clave. No es un fallo: es una
    // DECISIÓN pendiente. Sin ella /parsear-perfil devuelve valores neutros y
    // horario_predominante nunca se infiere — un campo del perfil público, que
    // ya degrada a "Variable". No toca el ranking ni el embedding.
    if (salud.api_llm_configurada === true) {
      anotar('Análisis con LLM (Anthropic)', 'ok', `clave presente · modelo ${salud.modelo_llm ?? 'por omisión'}`);
    } else {
      anotar('Análisis con LLM (Anthropic)', 'aviso',
        'sin ANTHROPIC_API_KEY: /parsear-perfil siempre degradado. Su sitio es ai-service/.env; hoy tunel.sh la carga desde el .env de la raiz. El Nivel 2 (embeddings) NO depende de esto');
    }
  } catch (e) {
    anotar('Túnel a Cloudflare', 'fallo', `${dominio} no responde (${e.message}) · corre scripts/tunel.sh`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// 3 · Estado de los datos que alimentan el motor
// ═══════════════════════════════════════════════════════════════════
async function revisarDatos() {
  const { data: us, error: e1 } = await admin
    .from('usuarios').select('nombre_usuario, consiente_analisis_ia, perfil_vector');
  if (e1) { anotar('Vectores de perfil', 'fallo', e1.message); return; }

  // El fallo del 18/09: consentimiento puesto y vector nulo. Esas cuentas creen
  // estar en Nivel 2 y están en Nivel 1.
  const rotos = us.filter((u) => u.consiente_analisis_ia && !u.perfil_vector);
  if (rotos.length) {
    anotar('Vectores de perfil', 'fallo',
      `${rotos.length} cuenta(s) con consentimiento y SIN vector → caen a Nivel 1: ${rotos.map((r) => r.nombre_usuario).join(', ')}`);
  } else {
    const con = us.filter((u) => u.consiente_analisis_ia).length;
    anotar('Vectores de perfil', 'ok', `${con} cuenta(s) consienten, todas con vector`);
  }

  const { data: pub, error: e2 } = await admin
    .from('publicaciones').select('titulo, activa, vector_embedding, latitud, longitud').eq('activa', true);
  if (e2) { anotar('Publicaciones activas', 'fallo', e2.message); return; }

  const sinVector = pub.filter((p) => !p.vector_embedding);
  if (sinVector.length) {
    anotar('Vectores de publicaciones', 'fallo',
      `${sinVector.length} de ${pub.length} activas sin vector → invisibles para el Nivel 2`);
  } else {
    anotar('Vectores de publicaciones', 'ok', `${pub.length}/${pub.length} activas con vector`);
  }

  // La cola de la 0021. Mientras tenga filas hay archivos que alguien creyo
  // borrados y siguen ocupando espacio que se paga. No es un fallo —el borrado
  // de la cuenta si funciono— pero es deuda que conviene ver antes que despues.
  const { count: enCola, error: e3 } = await admin
    .from('fotos_huerfanas').select('ruta', { count: 'exact', head: true });
  if (e3) {
    anotar('Cola de fotos huérfanas', 'fallo', e3.message);
  } else if (enCola > 0) {
    anotar('Cola de fotos huérfanas', 'aviso',
      `${enCola} archivo(s) pendientes de barrer → node --env-file=.env scripts/limpiar-fotos-huerfanas.mjs`);
  } else {
    anotar('Cola de fotos huérfanas', 'ok', 'vacía');
  }

  // Caja generosa sobre el centro de México. No es un fallo —una publicación
  // legítima podría estar lejos— pero una geocodificada en Tabasco a 600 km de
  // la UTVT es datos de prueba que nadie limpió.
  const raras = pub.filter((p) =>
    p.latitud == null || p.longitud == null ||
    p.latitud < 18.5 || p.latitud > 20.5 || p.longitud < -100.5 || p.longitud > -98.0);
  if (raras.length) {
    anotar('Geocodificación', 'aviso',
      `${raras.length} activa(s) con coordenadas nulas o fuera del centro de México: ` +
      raras.map((p) => p.titulo.slice(0, 32)).join(' · '));
  } else {
    anotar('Geocodificación', 'ok', `${pub.length} activas dentro del rango esperado`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// 4 · Las funciones que la app llama de verdad
// ═══════════════════════════════════════════════════════════════════
// La lección del 42P10: las pruebas cubrían consumir_cuota por separado y
// pasaban en verde, pero nadie llamaba a revelar_contacto de punta a punta.
// Probar las piezas no prueba que la función que las usa corra.
//
// Hace falta una sesión real, así que se crea una cuenta temporal y se borra
// al final. Las claves foráneas de conversaciones, mensajes y contactos son
// ON DELETE CASCADE, así que no queda rastro.
async function revisarFunciones() {
  const anon = createClient(URL_SB, ANON, { auth: { persistSession: false } });
  const correo = `verif-${Date.now()}@ejemplo.mx`;
  const clave = `Verificacion${Date.now()}Ok`;
  let creado = null;

  try {
    const alta = await admin.auth.admin.createUser({
      email: correo, password: clave, email_confirm: true,
      user_metadata: { nombre_usuario: `verif${Date.now()}`, nombre_completo: 'Verificacion Temporal' },
    });
    if (alta.error) throw alta.error;
    creado = alta.data.user.id;

    const sesion = await anon.auth.signInWithPassword({ email: correo, password: clave });
    if (sesion.error) throw sesion.error;
    const token = sesion.data.session.access_token;
    const cli = createClient(URL_SB, ANON, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // 4a · la cadena completa: app → Edge Function → túnel → contenedor
    const t0 = Date.now();
    const { data: emb, error: eEmb } = await cli.functions.invoke('ai-proxy', {
      body: { ruta: 'generar-embedding', texto: 'estudiante tranquilo cerca de la UTVT' },
    });
    const ms = Date.now() - t0;
    if (eEmb) {
      anotar('Cadena de IA (Nivel 2)', 'fallo', `ai-proxy falló en ${ms} ms: ${eEmb.message}`);
    } else if (emb?.degradado) {
      anotar('Cadena de IA (Nivel 2)', 'fallo', `degradado en ${ms} ms · motivo: ${emb.motivo}`);
    } else if (!Array.isArray(emb?.vector) || emb.vector.length !== 384) {
      anotar('Cadena de IA (Nivel 2)', 'fallo', `respuesta inesperada: ${JSON.stringify(emb).slice(0, 80)}`);
    } else {
      anotar('Cadena de IA (Nivel 2)', 'ok', `app → ai-proxy → túnel → microservicio en ${ms} ms · 384 dims`);
    }

    // 4b · revelar_contacto, llamada de verdad y dos veces
    const { data: unaPub } = await admin.from('publicaciones')
      .select('id').eq('activa', true).not('whatsapp', 'is', null).limit(1).single();
    if (!unaPub) {
      anotar('revelar_contacto', 'aviso', 'no hay publicación activa con whatsapp para probar');
    } else {
      const r1 = await cli.rpc('revelar_contacto', { p_publicacion_id: unaPub.id, p_score: 0.9 });
      const r2 = await cli.rpc('revelar_contacto', { p_publicacion_id: unaPub.id, p_score: 0.9 });
      const { count } = await admin.from('contactos')
        .select('id', { count: 'exact', head: true }).eq('usuario_id', creado);
      if (r1.error) anotar('revelar_contacto', 'fallo', r1.error.message);
      else if (r2.error) anotar('revelar_contacto', 'fallo', `la segunda llamada falla: ${r2.error.message}`);
      else if (count !== 1) anotar('revelar_contacto', 'fallo', `duplica el registro (${count} filas) → infla la métrica`);
      else anotar('revelar_contacto', 'ok', 'devuelve el teléfono y no duplica al repetir');
    }

    // 4c · abrir_conversacion, que es la puerta del chat
    const { data: otro } = await admin.from('usuarios')
      .select('id').neq('id', creado).limit(1).single();
    if (!otro) {
      anotar('abrir_conversacion', 'aviso', 'no hay otra cuenta para probar');
    } else {
      const c1 = await cli.rpc('abrir_conversacion', { p_otro: otro.id });
      const c2 = await cli.rpc('abrir_conversacion', { p_otro: otro.id });
      if (c1.error) anotar('abrir_conversacion', 'fallo', c1.error.message);
      else if (c2.error) anotar('abrir_conversacion', 'fallo', `la segunda llamada falla: ${c2.error.message}`);
      else if (c1.data !== c2.data) anotar('abrir_conversacion', 'fallo', 'no es idempotente: abre dos conversaciones');
      else anotar('abrir_conversacion', 'ok', 'idempotente: el mismo id en dos llamadas');
    }
  } catch (e) {
    anotar('Funciones con sesión real', 'fallo', e.message);
  } finally {
    // Pase lo que pase. Una cuenta de verificación olvidada en la base es
    // exactamente la clase de basura que este script existe para denunciar.
    if (creado) await admin.auth.admin.deleteUser(creado).catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════════════════
const COLOR = { ok: '\x1b[32m', aviso: '\x1b[33m', fallo: '\x1b[31m' };
const MARCA = { ok: '  OK  ', aviso: 'AVISO ', fallo: 'FALLO ' };

console.log('\nVerificación pre-demo · Cuervo Pass\n');
revisarSecrets();
await revisarTunel();
await revisarDatos();
await revisarFunciones();

for (const r of resultados) {
  console.log(`  ${COLOR[r.estado]}[${MARCA[r.estado]}]\x1b[0m ${r.nombre.padEnd(34)} ${r.detalle}`);
}

const fallos = resultados.filter((r) => r.estado === 'fallo').length;
const avisos = resultados.filter((r) => r.estado === 'aviso').length;
console.log(`\n  ${resultados.length - fallos - avisos} correctos · ${avisos} avisos · ${fallos} fallos`);

// Honestidad sobre el alcance: decir qué NO mira es tan útil como lo que mira.
console.log('\n  No cubre: las policies de RLS (eso es `supabase test db`, 21 aserciones),');
console.log('  ni que la app compile (`npx tsc --noEmit` y `npx expo lint`).\n');

process.exit(fallos > 0 ? 1 : 0);
