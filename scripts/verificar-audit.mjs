#!/usr/bin/env node
//
// Puerta de `npm audit` con excepciones
//
//   npm run verificar:audit
//
// Falla ante cualquier aviso ALTO o CRÍTICO que no esté en `audit-excepciones.json`, y
// también cuando una excepción deja de ser válida. Reemplaza a `npm audit
// --audit-level=high` en el CI. Por qué, y qué prueba cada caso, está en
// scripts/__tests__/verificar-audit.test.js.
//
// ── Por qué no `npm audit --audit-level=high` ────────────────────────────────────
// Ese paso estaba en rojo y no se podía poner en verde subiendo dependencias: `braces`
// y `node-forge` ya están en su última versión publicada y el aviso cubre esa versión,
// es decir, NO EXISTE una corrección. Dejarlo en rojo entrena a ignorar el rojo, y
// bajar el umbral a `critical` deja pasar cualquier aviso alto futuro. Aquí lo
// conocido se permite POR NOMBRE y con un motivo escrito, y lo nuevo falla.
//
// ── Cuándo una excepción deja de valer ───────────────────────────────────────────
//   · el aviso YA NO APARECE → se quita, para que la lista diga la verdad;
//   · YA HAY una versión corregida publicada → hay que subir la dependencia;
//   · VENCIÓ su fecha de revisión → hay que volver a mirarla, no heredarla;
//   · le falta el motivo o la fecha → no es una excepción, es un silencio.
//
// ── Excepciones por COPIA (`copias` y `linea`, opcionales) ───────────────────────
// Para cuando una copia NO se puede corregir actualizando (la trae una herramienta que fija una línea vieja de versiones) pero otra copia del mismo paquete sí. `copias` lista las rutas
// exactas (`node_modules/…`) que cubre: si el aviso aparece en otra, falla. `linea` es la versión mayor de la copia cubierta: se comprueba contra lo instalado y solo las correcciones
// de esa línea cuentan como «ya hay corrección». Sin esto, una excepción por nombre dejaría pasar también a la copia directa de la app. Caso real: zod (23/10/2026).
//
// ── Cómo se cuenta ───────────────────────────────────────────────────────────────
// Un mismo aviso aparece una vez por cada paquete de la cadena que lo arrastra: 68
// paquetes afectados eran 7 avisos. Se cuenta por AVISO (el id GHSA), no por paquete;
// si no, haría falta una excepción por cada eslabón.
//
// ── Fuentes de datos ─────────────────────────────────────────────────────────────
// Por omisión corre `npm audit --json` y consulta el registro de npm. Los flags
// `--auditoria`, `--versiones` y `--hoy` las sustituyen por archivos y por una fecha:
// existen para que las pruebas ejerciten ESTE código y no una copia de su lógica.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const GRAVES = new Set(['high', 'critical']);

// ── argumentos ────────────────────────────────────────────────────────────────────
function leerArgumentos(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i += 2) {
    const clave = argv[i];
    if (!clave.startsWith('--') || argv[i + 1] === undefined) {
      console.error(`Uso: verificar-audit.mjs [--auditoria f.json] [--excepciones f.json] [--versiones f.json] [--hoy AAAA-MM-DD] [--raiz carpeta]`);
      process.exit(2);
    }
    a[clave.slice(2)] = argv[i + 1];
  }
  return a;
}

const leerJson = (ruta) => JSON.parse(readFileSync(ruta, 'utf8'));

// ── versiones ─────────────────────────────────────────────────────────────────────
const triple = (v) => v.split('.').map((n) => Number.parseInt(n, 10));

function comparar(a, b) {
  const [x, y] = [triple(a), triple(b)];
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
}

const esEstable = (v) => /^\d+\.\d+\.\d+$/.test(v);

/**
 * ¿`version` cae en el rango vulnerable? Solo entiende los rangos que publica el
 * registro de avisos (`<=3.0.3`, `>=1.8.4 <1.11.0`, alternativas con `||`). Ante uno
 * que no reconoce LANZA: decir «no está en el rango» por no entenderlo sería declarar
 * corregido algo que no se sabe.
 */
function enRango(version, rango) {
  return rango.split('||').some((alternativa) =>
    alternativa
      .trim()
      .split(/\s+/)
      .every((token) => {
        const m = /^(<=|>=|<|>|=)?(\d+\.\d+\.\d+)$/.exec(token);
        if (!m) throw new Error(`rango de aviso no reconocido: «${rango}»`);
        const c = comparar(version, m[2]);
        switch (m[1] ?? '=') {
          case '<=': return c <= 0;
          case '>=': return c >= 0;
          case '<': return c < 0;
          case '>': return c > 0;
          default: return c === 0;
        }
      })
  );
}

/** La menor versión estable POSTERIOR a todas las vulnerables y fuera del rango, o null. */
function primeraCorreccion(publicadas, rango) {
  const estables = publicadas.filter(esEstable).sort(comparar);
  const vulnerables = estables.filter((v) => enRango(v, rango));
  if (vulnerables.length === 0) return null;
  const tope = vulnerables[vulnerables.length - 1];
  return estables.find((v) => comparar(v, tope) > 0 && !enRango(v, rango)) ?? null;
}

// ── la auditoría ──────────────────────────────────────────────────────────────────
function obtenerAuditoria(ruta) {
  if (ruta) return leerJson(ruta);
  // `npm audit` sale con código 1 cuando hay avisos: lo que importa es su salida.
  const r = spawnSync('npm', ['audit', '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  try {
    return JSON.parse(r.stdout);
  } catch {
    console.error(`No se pudo leer la salida de «npm audit --json».\n${r.stderr ?? ''}`);
    process.exit(2);
  }
}

/** Avisos altos y críticos, UNO por id: el mismo aviso lo arrastran muchos paquetes. */
function avisosGraves(auditoria) {
  const porId = new Map();
  for (const entrada of Object.values(auditoria.vulnerabilities ?? {})) {
    for (const via of entrada.via ?? []) {
      if (typeof via !== 'object' || !GRAVES.has(via.severity)) continue;
      const id = via.url?.split('/').pop() ?? `fuente-${via.source}`;
      if (!porId.has(id)) {
        porId.set(id, { id, paquete: via.name, severidad: via.severity, rango: via.range, titulo: via.title, nodos: new Set() });
      }
      // Las COPIAS instaladas en las que aparece (`node_modules/…`): una excepción puede limitarse a ellas.
      for (const nodo of entrada.nodes ?? []) porId.get(id).nodos.add(nodo);
    }
  }
  return porId;
}

// ── las excepciones ───────────────────────────────────────────────────────────────
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const fechaValida = (s) => typeof s === 'string' && FECHA.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** Lo que le falta a una excepción para serlo, o null. */
function defecto(e) {
  if (typeof e.motivo !== 'string' || e.motivo.trim() === '') return 'le falta el motivo: sin él es un silencio, no una excepción';
  if (!fechaValida(e.revisar)) return 'le falta una fecha de revisión válida (AAAA-MM-DD) en `revisar`';
  return null;
}

const mayor = (v) => String(Number.parseInt(String(v).split('.')[0], 10));

/** La versión instalada de una copia (`node_modules/…`), o null si no se puede leer. */
function versionInstalada(raiz, ruta) {
  try {
    return JSON.parse(readFileSync(join(raiz, ruta, 'package.json'), 'utf8')).version ?? null;
  } catch {
    return null;
  }
}

/**
 * Las excepciones POR COPIA (`copias` y `linea`). Devuelve el problema, o null si la excepción cubre el aviso.
 * Existen para el caso de una copia que NO se puede corregir actualizando (la trae una herramienta que fija una línea vieja) mientras otra copia del mismo paquete sí:
 * sin esto, la excepción por nombre dejaba pasar a las dos, y «ya hay corrección» se cumplía con una versión que la copia no puede tomar.
 */
function problemaDeCopias(excepcion, aviso, raiz) {
  if (!Array.isArray(excepcion.copias)) return null;
  if (aviso.nodos.size === 0) return 'la auditoría no dice en qué copias aparece el aviso: no se puede comprobar que la excepción lo cubra';
  const ajenas = [...aviso.nodos].filter((n) => !excepcion.copias.includes(n));
  if (ajenas.length > 0) return `el aviso afecta a una copia que la excepción no cubre: ${ajenas.join(', ')}`;
  if (excepcion.linea === undefined) return null;
  for (const copia of excepcion.copias.filter((c) => aviso.nodos.has(c))) {
    const version = versionInstalada(raiz, copia);
    if (!version) return `no se pudo leer la versión instalada de ${copia}: no se declara cubierta lo que no se vio`;
    if (mayor(version) !== String(excepcion.linea)) {
      return `${copia} ya no es de la línea ${excepcion.linea}.x (instalada ${version}): vuelve a mirar la excepción`;
    }
  }
  return null;
}

// ── principal ─────────────────────────────────────────────────────────────────────
const args = leerArgumentos(process.argv.slice(2));
const hoy = args.hoy ?? new Date().toISOString().slice(0, 10);
const raiz = args.raiz ?? join(AQUI, '..');
const excepciones = leerJson(args.excepciones ?? join(AQUI, 'audit-excepciones.json'));
const graves = avisosGraves(obtenerAuditoria(args.auditoria));

// El archivo de versiones se lee UNA vez: leerlo por cada aviso fallaba si no era un
// archivo normal (una redirección de proceso solo se puede leer una vez).
const versionesDePrueba = args.versiones ? leerJson(args.versiones) : null;

function publicadas(paquete) {
  if (versionesDePrueba) return versionesDePrueba[paquete] ?? [];
  const r = spawnSync('npm', ['view', paquete, 'versions', '--json'], { encoding: 'utf8' });
  try {
    const v = JSON.parse(r.stdout);
    return Array.isArray(v) ? v : [v];
  } catch {
    return [];
  }
}

const porAviso = new Map(excepciones.map((e) => [e.advisory, e]));
const lineas = [];
let fallos = 0;
const falla = (texto) => {
  fallos += 1;
  lineas.push(`  FALLA      ${texto}`);
};

for (const aviso of [...graves.values()].sort((a, b) => a.id.localeCompare(b.id))) {
  const nombre = `${aviso.id}  ${aviso.paquete} (${aviso.severidad})`;
  const excepcion = porAviso.get(aviso.id);

  if (!excepcion) {
    falla(`${nombre} — aviso NUEVO sin excepción. ${aviso.titulo}`);
    continue;
  }
  const malo = defecto(excepcion);
  if (malo) {
    falla(`${nombre} — la excepción ${malo}`);
    continue;
  }
  if (hoy > excepcion.revisar) {
    falla(`${nombre} — la excepción venció el ${excepcion.revisar}: hay que volver a mirarla, no heredarla`);
    continue;
  }
  const problema = problemaDeCopias(excepcion, aviso, raiz);
  if (problema) {
    falla(`${nombre} — ${problema}`);
    continue;
  }
  // Con `linea`, solo cuentan como corrección las versiones de ESA línea: la copia cubierta no puede tomar las de otra.
  const candidatas = excepcion.linea === undefined ? publicadas(aviso.paquete) : publicadas(aviso.paquete).filter((v) => mayor(v) === String(excepcion.linea));
  const correccion = primeraCorreccion(candidatas, aviso.rango);
  if (correccion) {
    falla(`${nombre} — ya hay corrección publicada (${correccion}): sube la dependencia y quita la excepción`);
    continue;
  }
  lineas.push(`  permitido  ${nombre} — revisar antes del ${excepcion.revisar}`);
}

// Una excepción que sobrevive a su aviso es una deuda invisible.
for (const e of excepciones) {
  if (!graves.has(e.advisory)) {
    falla(`${e.advisory}  ${e.paquete ?? '?'} — la excepción ya no aparece en la auditoría: quítala`);
  }
}

console.log('\nnpm audit · puerta con excepciones\n');
if (graves.size === 0 && excepciones.length === 0) console.log('  Sin avisos altos ni críticos.');
else console.log(lineas.join('\n'));
console.log(
  fallos === 0
    ? `\n  OK. ${graves.size === 0 ? 'Sin avisos altos ni críticos.' : `${graves.size} aviso(s) alto(s)/crítico(s), todos con excepción vigente.`}\n`
    : `\n  ${fallos} problema(s). Detalle arriba.\n`
);
process.exit(fallos === 0 ? 0 : 1);
