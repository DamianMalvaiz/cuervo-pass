// Conjunto de evaluación etiquetado del orden de Depas · fase 1.3 del plan de excelencia.
//
// Para decir «mejoramos» hay que medir contra juicios humanos. Este script hace dos cosas:
//
//   preparar   Arma 4 personas FABRICADAS (no son cuentas reales), les genera el vector con el microservicio local de IA, calcula el orden
//              que daría cada variante del ranking sobre las publicaciones activas, junta los mejores de cada una (pooling, como en TREC) y
//              escribe `evaluacion/depas-pares.json` + `evaluacion/etiquetar.html`. La página oculta qué variante puso cada publicación.
//   evaluar    Lee `evaluacion/depas-etiquetas.json` (lo que la persona exportó desde la página) y calcula NDCG@K por variante y persona.
//
// Uso:
//   node --env-file=.env --env-file=.env.server --env-file=ai-service/.env scripts/evaluacion-depas.mjs preparar
//   node scripts/evaluacion-depas.mjs evaluar [evaluacion/depas-etiquetas.json]
//
// Las variantes replican `score_ajuste` (0031) y la mezcla de 0037/0071 en JavaScript: si el SQL cambia, esta copia hay que cambiarla con él.
// Sin favoritos (no hay historial de personas fabricadas), w = 0: se evalúa el orden base. Los favoritos se evaluarían con sesiones reales.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const K = 4; // profundidad del pool y del NDCG: los K primeros de CADA variante quedan etiquetados, así que NDCG@K es exacto
const SEMILLA = 20261018;

// ── Personas fabricadas ────────────────────────────────────────────────────────────────────────────────────────────────
const PERSONAS = [
  { id: 'P1', nombre: 'Sofía · presupuesto ajustado y silencio', presupuesto_min: 2200, presupuesto_max: 3600, distancia_max_km: 10, mascotas: false, fuma: false, nivel_ruido: 'bajo',
    perfil_texto: 'Estudio ingeniería y necesito silencio para estudiar. Prefiero vivir cerca de la universidad y gastar poco.' },
  { id: 'P2', nombre: 'Diego · con perro', presupuesto_min: 2500, presupuesto_max: 5000, distancia_max_km: 15, mascotas: true, fuma: false, nivel_ruido: 'medio',
    perfil_texto: 'Tengo un perro mediano. Busco un departamento con espacio donde acepten mascotas.' },
  { id: 'P3', nombre: 'Ana · vida social', presupuesto_min: 2200, presupuesto_max: 4000, distancia_max_km: 12, mascotas: false, fuma: false, nivel_ruido: 'alto',
    perfil_texto: 'Me gusta recibir amigos y un ambiente animado. Busco un cuarto en una casa compartida con gente sociable.' },
  { id: 'P4', nombre: 'Luis · cómodo y amueblado', presupuesto_min: 3500, presupuesto_max: 6500, distancia_max_km: 20, mascotas: false, fuma: false, nivel_ruido: 'medio',
    perfil_texto: 'Busco algo cómodo y amueblado para no comprar nada; puedo pagar un poco más por una buena ubicación.' },
];

const DESCRIPCION_RUIDO = {
  bajo: 'Prefiere el silencio y la tranquilidad en casa.',
  medio: 'Tolera el ruido normal de convivencia.',
  alto: 'Le gusta un ambiente animado, con visitas seguido.',
};
// Espejo de src/lib/perfilTexto.ts (igual que scripts/backfill-embeddings.mjs).
function textoPerfil(u, universidad) {
  const partes = [`Estudia en ${universidad}.`, `Presupuesto de $${u.presupuesto_min} a $${u.presupuesto_max} pesos al mes.`];
  partes.push(u.mascotas ? 'Tiene mascota.' : 'No tiene mascota.', u.fuma ? 'Fuma.' : 'No fuma.', DESCRIPCION_RUIDO[u.nivel_ruido], u.perfil_texto);
  return partes.join(' ');
}

// ── Matemáticas (copia de SQL) ─────────────────────────────────────────────────────────────────────────────────────────
const km = (la1, lo1, la2, lo2) => {
  if ([la1, lo1, la2, lo2].some((x) => x == null)) return null;
  const r = Math.PI / 180, dLa = (la2 - la1) * r, dLo = (lo2 - lo1) * r;
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLo / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
};
function scoreAjuste(d, p, yo, ruidoPublicador) {
  const dist = d == null ? 0.5 : Math.max(0, 1 - d / (yo.distancia_max_km ?? 5));
  const pres = yo.presupuesto_max === yo.presupuesto_min ? 1 : Math.max(0, Math.min(1, 1 - (p.precio_renta - yo.presupuesto_min) / (yo.presupuesto_max - yo.presupuesto_min)));
  const compat = 0.25 * ((yo.mascotas ? (p.permite_mascotas ? 0.5 : 0) : 0.5) + (ruidoPublicador === yo.nivel_ruido ? 0.5 : 0));
  const dias = (Date.now() - new Date(p.creado_en).getTime()) / 86400000;
  return 0.3 * dist + 0.3 * pres + compat + 0.15 * Math.max(0, 1 - dias / 30);
}
const cos = (a, b) => { let s = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { s += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; } return s / Math.sqrt(na * nb); };
const vec = (v) => (v == null ? null : typeof v === 'string' ? JSON.parse(v) : v);
const aleatorio = (semilla) => () => { semilla = (semilla * 1664525 + 1013904223) % 4294967296; return semilla / 4294967296; };

const VARIANTES = {
  filtros: (c) => c.score,
  afinidad: (c) => c.sim ?? -1,
  actual: (c) => (c.sim == null ? c.score : 0.6 * c.score + 0.4 * c.sim),
  afinidad_pesada: (c) => (c.sim == null ? c.score : 0.4 * c.score + 0.6 * c.sim),
};

// ── NDCG ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
const dcg = (rels) => rels.reduce((s, r, i) => s + r / Math.log2(i + 2), 0);
function ndcg(ordenIds, rel, k) {
  const obtenidas = ordenIds.slice(0, k).map((id) => rel.get(id) ?? 0);
  const ideales = [...rel.values()].sort((a, b) => b - a).slice(0, k);
  const idcg = dcg(ideales);
  return idcg === 0 ? null : dcg(obtenidas) / idcg;
}

// ── preparar ──────────────────────────────────────────────────────────────────────────────────────────────────────────
async function preparar() {
  const { createClient } = await import('@supabase/supabase-js');
  const admin = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const ia = process.env.AI_SERVICE_URL || 'http://localhost:8000';
  const token = process.env.AI_SHARED_TOKEN;

  const { data: uni } = await admin.from('usuarios').select('universidad, latitud_universidad, longitud_universidad').not('latitud_universidad', 'is', null).limit(1).single();
  const { data: pubs, error } = await admin.from('publicaciones')
    .select('id, usuario_id, titulo, tipo, direccion, precio_renta, descripcion, permite_mascotas, amueblado, latitud, longitud, creado_en, vector_embedding').eq('activa', true);
  if (error) throw error;
  const { data: duenos } = await admin.from('usuarios').select('id, nivel_ruido').in('id', [...new Set(pubs.map((p) => p.usuario_id))]);
  const ruidoDe = new Map(duenos.map((d) => [d.id, d.nivel_ruido]));
  console.log(`Publicaciones activas: ${pubs.length}. Universidad de referencia: ${uni.universidad}`);

  const rnd = aleatorio(SEMILLA);
  const pares = [];
  const rankings = {};
  for (const persona of PERSONAS) {
    const r = await fetch(`${ia}/generar-embedding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), 'x-usuario-id': 'script-evaluacion' },
      body: JSON.stringify({ texto: textoPerfil(persona, uni.universidad) }),
    });
    if (!r.ok) throw new Error(`generar-embedding falló: ${r.status} (¿está corriendo el microservicio?)`);
    const vp = (await r.json()).vector;

    // Filtros duros de `sugerencias_publicaciones`: presupuesto (+10 %), distancia máxima y mascotas.
    const candidatos = pubs.map((p) => {
      const d = km(p.latitud, p.longitud, uni.latitud_universidad, uni.longitud_universidad);
      const v = vec(p.vector_embedding);
      return { p, d, score: scoreAjuste(d, p, persona, ruidoDe.get(p.usuario_id)), sim: v ? cos(vp, v) : null };
    }).filter(({ p, d }) =>
      p.precio_renta <= persona.presupuesto_max * 1.1 && (d == null || d <= persona.distancia_max_km) && (!persona.mascotas || p.permite_mascotas));
    console.log(`  ${persona.id}: ${candidatos.length} publicaciones pasan los filtros duros`);

    const orden = {};
    for (const [nombre, f] of Object.entries(VARIANTES)) orden[nombre] = [...candidatos].sort((a, b) => f(b) - f(a)).map((c) => c.p.id);
    rankings[persona.id] = orden;

    const pool = new Set(Object.values(orden).flatMap((o) => o.slice(0, K)));
    // Dos al azar entre los que no entraron: sin ellos todo lo etiquetado lo eligió algún ranker y no se sabría si hay buenas que ninguno ve.
    const resto = candidatos.filter((c) => !pool.has(c.p.id)).sort(() => rnd() - 0.5).slice(0, 2);
    for (const c of resto) pool.add(c.p.id);
    for (const c of candidatos.filter((c) => pool.has(c.p.id))) {
      pares.push({
        id: `${persona.id}:${c.p.id}`, persona: persona.id, publicacion: c.p.id,
        ficha: { titulo: c.p.titulo, tipo: c.p.tipo, direccion: c.p.direccion, renta: c.p.precio_renta, descripcion: c.p.descripcion, mascotas: c.p.permite_mascotas, amueblado: c.p.amueblado, km: c.d == null ? null : Math.round(c.d * 10) / 10 },
      });
    }
  }
  // Orden barajado dentro de cada persona: la página no revela qué variante puso qué.
  const barajados = PERSONAS.flatMap((pe) => pares.filter((x) => x.persona === pe.id).sort(() => rnd() - 0.5));

  mkdirSync('evaluacion', { recursive: true });
  const salida = { generado: new Date().toISOString(), k: K, personas: PERSONAS.map(({ id, nombre, presupuesto_min, presupuesto_max, distancia_max_km, mascotas, nivel_ruido, perfil_texto }) => ({ id, nombre, presupuesto_min, presupuesto_max, distancia_max_km, mascotas, nivel_ruido, perfil_texto })), pares: barajados, rankings };
  writeFileSync('evaluacion/depas-pares.json', JSON.stringify(salida, null, 2));
  writeFileSync('evaluacion/etiquetar.html', paginaHtml({ personas: salida.personas, pares: barajados }));
  console.log(`\n${barajados.length} pares por etiquetar → evaluacion/etiquetar.html (ábrela en el navegador).`);
}

function paginaHtml(datos) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Etiquetar Depas</title>
<style>
:root{--bg:#fafaf7;--fg:#1c1c1a;--mut:#5c5c57;--card:#fff;--line:#d9d9d2;--ok:#1f6b3a}
@media(prefers-color-scheme:dark){:root{--bg:#161614;--fg:#f0f0ea;--mut:#a8a8a0;--card:#212120;--line:#3a3a36;--ok:#7ad39a}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif}main{max-width:640px;margin:0 auto;padding:16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;margin:12px 0}h1{font-size:20px;margin:8px 0}h2{font-size:17px;margin:0 0 6px}
.mut{color:var(--mut);font-size:14px}.btns{display:flex;gap:8px;margin-top:12px}button{flex:1;min-height:56px;font:inherit;font-weight:600;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--fg);cursor:pointer}
button.sel{background:var(--ok);color:#fff;border-color:var(--ok)}.nav{display:flex;justify-content:space-between;gap:8px}.nav button{flex:none;padding:0 16px;min-height:44px}
progress{width:100%}.dato{display:flex;justify-content:space-between;gap:8px;border-top:1px solid var(--line);padding:4px 0}
</style></head><body><main>
<h1>Etiquetar Depas</h1><p class="mut" id="avance"></p><progress id="barra" value="0" max="1"></progress>
<div class="card" id="persona"></div><div class="card" id="pub"></div>
<div class="btns"><button data-r="0">0 · No se la recomendaría</button><button data-r="1">1 · Podría servirle</button><button data-r="2">2 · Sí, encaja bien</button></div>
<p class="mut">Teclas 0, 1, 2 · ← → para moverte. Tu avance se guarda solo en este navegador.</p>
<div class="nav"><button id="ant">← Anterior</button><button id="sig">Siguiente →</button></div>
<div class="card"><button id="exportar" style="width:100%">Descargar mis etiquetas (JSON)</button><p class="mut" id="msg"></p></div>
</main><script>
const D=${JSON.stringify(datos)};const KEY='etiquetas-depas-v1';
let E={};try{E=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
let i=0;const $=s=>document.querySelector(s);const P=Object.fromEntries(D.personas.map(p=>[p.id,p]));
const fmt=n=>'$'+Number(n).toLocaleString('es-MX');
function guardar(){try{localStorage.setItem(KEY,JSON.stringify(E))}catch(e){}}
function pintar(){const x=D.pares[i],p=P[x.persona],f=x.ficha;
 const hechos=Object.keys(E).length;$('#avance').textContent='Par '+(i+1)+' de '+D.pares.length+' · etiquetados: '+hechos;$('#barra').max=D.pares.length;$('#barra').value=hechos;
 $('#persona').innerHTML='<h2>'+p.nombre+'</h2><div class="mut">'+p.perfil_texto+'</div><div class="dato"><span>Presupuesto</span><span>'+fmt(p.presupuesto_min)+' – '+fmt(p.presupuesto_max)+'</span></div><div class="dato"><span>Distancia máxima</span><span>'+p.distancia_max_km+' km</span></div><div class="dato"><span>Mascota</span><span>'+(p.mascotas?'Sí':'No')+'</span></div><div class="dato"><span>Ruido que tolera</span><span>'+p.nivel_ruido+'</span></div>';
 $('#pub').innerHTML='<h2>'+f.titulo+'</h2><div class="mut">'+f.tipo+' · '+f.direccion+'</div><p>'+(f.descripcion||'<span class="mut">(sin descripción)</span>')+'</p><div class="dato"><span>Renta</span><span>'+fmt(f.renta)+' al mes</span></div><div class="dato"><span>A la universidad</span><span>'+(f.km==null?'sin dato':f.km+' km')+'</span></div><div class="dato"><span>Acepta mascotas</span><span>'+(f.mascotas?'Sí':'No')+'</span></div><div class="dato"><span>Amueblado</span><span>'+(f.amueblado?'Sí':'No')+'</span></div>';
 document.querySelectorAll('[data-r]').forEach(b=>b.classList.toggle('sel',E[x.id]===Number(b.dataset.r)));}
function poner(r){E[D.pares[i].id]=r;guardar();if(i<D.pares.length-1)i++;pintar();}
document.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>poner(Number(b.dataset.r)));
$('#ant').onclick=()=>{i=Math.max(0,i-1);pintar()};$('#sig').onclick=()=>{i=Math.min(D.pares.length-1,i+1);pintar()};
addEventListener('keydown',e=>{if('012'.includes(e.key)&&e.key!=='')poner(Number(e.key));if(e.key==='ArrowLeft')$('#ant').click();if(e.key==='ArrowRight')$('#sig').click();});
$('#exportar').onclick=()=>{const falta=D.pares.length-Object.keys(E).length;
 const out={exportado:new Date().toISOString(),etiquetas:D.pares.filter(x=>x.id in E).map(x=>({id:x.id,persona:x.persona,publicacion:x.publicacion,relevancia:E[x.id]}))};
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:'application/json'}));a.download='depas-etiquetas.json';a.click();
 $('#msg').textContent=falta?('Faltan '+falta+' por etiquetar; se descargó lo que hay.'):'Listo: guarda el archivo como evaluacion/depas-etiquetas.json';};
pintar();
</script></body></html>`;
}

// ── evaluar ───────────────────────────────────────────────────────────────────────────────────────────────────────────
function evaluar(archivo) {
  const pares = JSON.parse(readFileSync('evaluacion/depas-pares.json', 'utf8'));
  const etiquetas = JSON.parse(readFileSync(archivo, 'utf8')).etiquetas;
  const total = pares.pares.length;
  if (etiquetas.length < total) console.warn(`AVISO: faltan ${total - etiquetas.length} de ${total} pares sin etiquetar; cuentan como relevancia 0 y sesgan hacia abajo.`);
  const k = pares.k;
  const variantes = Object.keys(Object.values(pares.rankings)[0]);
  const resumen = {};
  console.log(`NDCG@${k} por persona (1.00 = el orden ideal entre lo etiquetado)\n`);
  console.log(['persona', ...variantes].map((x) => x.padEnd(16)).join(''));
  for (const pe of pares.personas) {
    const rel = new Map(etiquetas.filter((e) => e.persona === pe.id).map((e) => [e.publicacion, e.relevancia]));
    const fila = variantes.map((v) => {
      const n = ndcg(pares.rankings[pe.id][v], rel, k);
      (resumen[v] ??= []).push(n);
      return n == null ? '—' : n.toFixed(3);
    });
    console.log([pe.id, ...fila].map((x) => String(x).padEnd(16)).join(''));
  }
  console.log('─'.repeat(16 * (variantes.length + 1)));
  console.log(['media', ...variantes.map((v) => { const xs = resumen[v].filter((n) => n != null); return xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(3) : '—'; })].map((x) => String(x).padEnd(16)).join(''));
  console.log(`\nCon ${pares.personas.length} personas, una diferencia menor de ~0.05 NO es evidencia: es ruido. Léelo como orientación, no como prueba.`);
}

const [orden, archivo] = process.argv.slice(2);
if (orden === 'preparar') await preparar();
else if (orden === 'evaluar') evaluar(archivo ?? 'evaluacion/depas-etiquetas.json');
else { console.error('Uso: scripts/evaluacion-depas.mjs preparar | evaluar [etiquetas.json]'); process.exit(1); }
