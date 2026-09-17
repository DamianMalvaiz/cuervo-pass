// Genera embeddings para las cuentas/publicaciones demo que seed-demo.mjs creó
// antes de que existiera el Nivel 2 (Semana 9) — sin esto, el reordenamiento
// por similitud no tiene nada que reordenar. Usa el microservicio LOCAL
// (gratis, sin ANTHROPIC_API_KEY) vía EXPO_PUBLIC_AI_SERVICE_URL.
//
// Uso: node --env-file=.env scripts/backfill-embeddings.mjs
// (requiere que ai-service esté corriendo: cd ai-service && .venv/bin/uvicorn main:app)

import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const aiServiceUrl = process.env.EXPO_PUBLIC_AI_SERVICE_URL || 'http://localhost:8000';

if (!url || !serviceKey) {
  console.error('Faltan EXPO_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function generarEmbedding(texto) {
  const respuesta = await fetch(`${aiServiceUrl}/generar-embedding`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texto }),
  });
  if (!respuesta.ok) throw new Error(`generar-embedding falló: ${respuesta.status}`);
  const datos = await respuesta.json();
  return datos.vector;
}

function textoPerfil(u) {
  const partes = [];
  if (u.universidad) partes.push(`Estudia en ${u.universidad}.`);
  if (u.presupuesto_min != null && u.presupuesto_max != null) {
    partes.push(`Presupuesto de $${u.presupuesto_min} a $${u.presupuesto_max} pesos al mes.`);
  }
  partes.push(u.mascotas ? 'Tiene mascota.' : 'No tiene mascota.');
  partes.push(u.fuma ? 'Fuma.' : 'No fuma.');
  return partes.join(' ');
}

async function main() {
  const { data: usuarios, error: errorUsuarios } = await admin
    .from('usuarios')
    .select('id, universidad, presupuesto_min, presupuesto_max, mascotas, fuma')
    .is('perfil_vector', null);
  if (errorUsuarios) throw errorUsuarios;

  console.log(`Generando embeddings para ${usuarios.length} usuarios sin perfil_vector...`);
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

  const { data: publicaciones, error: errorPublicaciones } = await admin
    .from('publicaciones')
    .select('id, descripcion, direccion')
    .is('vector_embedding', null);
  if (errorPublicaciones) throw errorPublicaciones;

  console.log(`Generando embeddings para ${publicaciones.length} publicaciones sin vector_embedding...`);
  for (const [i, p] of publicaciones.entries()) {
    const texto = p.descripcion?.trim() ? p.descripcion : `Departamento en ${p.direccion}`;
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

  console.log('Listo.');
}

main();
