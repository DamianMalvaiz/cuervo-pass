// Genera embeddings para las cuentas/publicaciones demo que seed-demo.mjs creó
// antes de que existiera el Nivel 2 (Semana 9) — sin esto, el reordenamiento
// por similitud no tiene nada que reordenar. Usa el microservicio LOCAL
// (gratis, sin ANTHROPIC_API_KEY) vía EXPO_PUBLIC_AI_SERVICE_URL.
//
// Uso: node --env-file=.env scripts/backfill-embeddings.mjs
// (requiere que ai-service esté corriendo: cd ai-service && .venv/bin/uvicorn main:app)
//
// Habla con el microservicio DIRECTO, no por la Edge Function `ai-proxy`: este
// script es una herramienta de mantenimiento que corre con service_role en la
// laptop de quien desarrolla, no tiene sesión de usuario, y pasar por el proxy
// consumiría la cuota diaria de alguien (§24). Por eso manda el token
// compartido a mano si está configurado.

import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const aiServiceUrl = process.env.EXPO_PUBLIC_AI_SERVICE_URL || 'http://localhost:8000';

if (!url || !serviceKey) {
  console.error('Faltan EXPO_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const tokenCompartido = process.env.AI_SHARED_TOKEN;

// v5 §9 cambió el modelo de embeddings de `all-MiniLM-L6-v2` (inglés) a
// `paraphrase-multilingual-MiniLM-L12-v2`. Tienen las mismas 384 dimensiones,
// así que el esquema no cambia y NADA truena — pero los vectores de un modelo
// NO son comparables con los del otro: la similitud de coseno entre ellos es
// ruido. Por eso hay que regenerar todo lo que se haya generado antes:
//
//   node --env-file=.env scripts/backfill-embeddings.mjs --todos
//
// Sin la bandera, solo se rellenan las filas que no tienen vector.
const regenerarTodo = process.argv.includes('--todos');

// Aplica el filtro "solo las que falten", salvo que se pida regenerar todo.
function soloFaltantes(consulta, columna) {
  return regenerarTodo ? consulta : consulta.is(columna, null);
}

async function generarEmbedding(texto) {
  const respuesta = await fetch(`${aiServiceUrl}/generar-embedding`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(tokenCompartido ? { Authorization: `Bearer ${tokenCompartido}` } : {}),
      // Clave del limitador por usuario (AUD-03): sin ella todas las peticiones
      // de este script competirían con las de la app por la misma cubeta.
      'x-usuario-id': 'script-backfill',
    },
    body: JSON.stringify({ texto }),
  });
  if (!respuesta.ok) throw new Error(`generar-embedding falló: ${respuesta.status}`);
  const datos = await respuesta.json();
  return datos.vector;
}

const DESCRIPCION_RUIDO = {
  bajo: 'Prefiere el silencio y la tranquilidad en casa.',
  medio: 'Tolera el ruido normal de convivencia.',
  alto: 'Le gusta un ambiente animado, con visitas seguido.',
};

// Espejo de src/lib/perfilTexto.ts: si las dos versiones divergen, los vectores
// del backfill dejan de ser comparables con los que genera la app.
function textoPerfil(u) {
  const partes = [];
  if (u.universidad) partes.push(`Estudia en ${u.universidad}.`);
  if (u.presupuesto_min != null && u.presupuesto_max != null) {
    partes.push(`Presupuesto de $${u.presupuesto_min} a $${u.presupuesto_max} pesos al mes.`);
  }
  partes.push(u.mascotas ? 'Tiene mascota.' : 'No tiene mascota.');
  partes.push(u.fuma ? 'Fuma.' : 'No fuma.');
  if (u.nivel_ruido && DESCRIPCION_RUIDO[u.nivel_ruido]) partes.push(DESCRIPCION_RUIDO[u.nivel_ruido]);
  if (u.perfil_texto) partes.push(u.perfil_texto);
  return partes.join(' ');
}

async function main() {
  if (regenerarTodo) {
    console.log('Modo --todos: se regeneran TODOS los vectores con el modelo multilingüe.');
  }

  const { data: usuarios, error: errorUsuarios } = await soloFaltantes(
    admin
      .from('usuarios')
      .select('id, universidad, presupuesto_min, presupuesto_max, mascotas, fuma, nivel_ruido, perfil_texto')
      // §29: solo quienes consintieron el análisis con IA. Generar el vector de
      // quien dijo que no sería exactamente lo que el consentimiento impide.
      .eq('consiente_analisis_ia', true),
    'perfil_vector'
  );
  if (errorUsuarios) throw errorUsuarios;

  console.log(`Generando embeddings para ${usuarios.length} usuarios...`);
  for (const [i, u] of usuarios.entries()) {
    try {
      const vector = await generarEmbedding(textoPerfil(u));
      const { error } = await admin.from('usuarios').update({ perfil_vector: vector }).eq('id', u.id);
      if (error) console.warn(`  [${i + 1}] update falló:`, error.message);
    } catch (e) {
      console.warn(`  [${i + 1}] embedding falló:`, e.message);
    }
    if ((i + 1) % 20 === 0) console.log(`  ${i + 1}/${usuarios.length} usuarios listos...`);
    // El microservicio limita /generar-embedding a 60/min (slowapi) — 1.1s
    // entre llamadas se queda debajo de eso sin desactivar el límite.
    await new Promise((r) => setTimeout(r, 1100));
  }

  const { data: publicaciones, error: errorPublicaciones } = await soloFaltantes(
    admin.from('publicaciones').select('id, titulo, descripcion, direccion'),
    'vector_embedding'
  );
  if (errorPublicaciones) throw errorPublicaciones;

  console.log(`Generando embeddings para ${publicaciones.length} publicaciones...`);
  for (const [i, p] of publicaciones.entries()) {
    // Espejo de textoParaEmbedding() en publicaciones.service.ts.
    const partes = [p.titulo, p.descripcion?.trim()].filter(Boolean);
    const texto = partes.length ? partes.join('. ') : `Departamento en ${p.direccion}`;
    try {
      const vector = await generarEmbedding(texto);
      const { error } = await admin.from('publicaciones').update({ vector_embedding: vector }).eq('id', p.id);
      if (error) console.warn(`  [${i + 1}] update falló:`, error.message);
    } catch (e) {
      console.warn(`  [${i + 1}] embedding falló:`, e.message);
    }
    if ((i + 1) % 20 === 0) console.log(`  ${i + 1}/${publicaciones.length} publicaciones listas...`);
    await new Promise((r) => setTimeout(r, 1100));
  }

  // Los roomies también necesitan vector: `sugerencias_roomies` compara el
  // perfil de quien busca contra `roomies.vector_busqueda`, no contra el
  // perfil_vector del otro (que la vista pública no expone, §18).
  const { data: roomies, error: errorRoomies } = await soloFaltantes(
    admin.from('roomies').select('id, descripcion_busqueda'),
    'vector_busqueda'
  );
  if (errorRoomies) throw errorRoomies;

  console.log(`Generando embeddings para ${roomies.length} roomies...`);
  for (const [i, r] of roomies.entries()) {
    try {
      const vector = await generarEmbedding(r.descripcion_busqueda);
      const { error } = await admin.from('roomies').update({ vector_busqueda: vector }).eq('id', r.id);
      if (error) console.warn(`  [${i + 1}] update falló:`, error.message);
    } catch (e) {
      console.warn(`  [${i + 1}] embedding falló:`, e.message);
    }
    if ((i + 1) % 20 === 0) console.log(`  ${i + 1}/${roomies.length} roomies listos...`);
    await new Promise((r) => setTimeout(r, 1100));
  }

  console.log('Listo.');
}

main();
