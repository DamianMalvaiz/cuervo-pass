#!/usr/bin/env node
//
// Verificador de objetivos táctiles · END-35
//
//   npm run verificar:toques
//
// El invariante 8 de AGENTS.md dice «objetivo táctil mínimo 44×44 pt, contando
// hitSlop. Sin excepciones». Lo decía desde hacía semanas y había cinco
// controles por debajo: 30, 32, 36, 38 y 40 pt. Una regla que solo vive en un
// documento depende de que alguien la recuerde al escribir cada estilo.
//
// 44 pt no es un número arbitrario: es el mínimo de Apple, y Android pide 48 dp.
// Por debajo, el dedo de una persona con menos pulso —o con el teléfono en una
// mano y el café en la otra— falla el toque y la app parece rota.
//
// ── Lo que este script NO puede ver ──
//
// `hitSlop` se declara en el COMPONENTE y la altura en el ESTILO, así que
// correlacionarlos estáticamente no es fiable. En vez de adivinar, se permite
// una exención EXPLÍCITA en la línea anterior:
//
//     // toque-ok: hitSlop de 8 a cada lado lo lleva a 46
//     chipCompacto: { minHeight: 30 },
//
// Una exención que obliga a escribir el motivo es una decisión; una que se
// activa sola es un agujero.

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const MINIMO = 44;
// Nombres de estilo que denotan algo que se toca. No se revisa todo estilo con
// altura: una tarjeta de 40 px de alto no es un problema, un botón sí.
const TOCABLE = /chip|boton|botón|accion|acción|atajo|control|toggle|casilla|pastilla|tab|icono|cerrar|quitar/i;
const EXENCION = /\/\/\s*toque-ok:/;

const archivos = execFileSync(
  'sh',
  ['-c', "find src -name '*.tsx' -not -path '*__tests__*' | sort"],
  { encoding: 'utf8' }
).trim().split('\n').filter(Boolean);

const hallazgos = [];

for (const ruta of archivos) {
  const lineas = readFileSync(ruta, 'utf8').split('\n');
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    // `minHeight: 30` / `height: 32` con literal numérico, en cualquier parte
    // de la línea: los estilos de una sola línea son el caso común.
    const alto = linea.match(/\b(?:minHeight|height)\s*:\s*(\d+)\b/);
    if (!alto) continue;
    const valor = Number(alto[1]);
    if (valor >= MINIMO) continue;

    // El nombre del estilo. Tres formas, de la más específica a la más general:
    // el estilo declarado en línea (`{ botonX: { minHeight: 30 } }`), el que
    // abre la línea (`botonX: {`), o el bloque que empieza más arriba.
    const enLinea = [...linea.slice(0, alto.index).matchAll(/(\w+)\s*:\s*\{/g)].pop();
    let nombre = enLinea?.[1] ?? (linea.match(/^\s*(\w+)\s*:/) ?? [])[1] ?? '';
    if (!TOCABLE.test(nombre)) {
      for (let j = i - 1; j >= 0 && j > i - 12; j--) {
        const abre = lineas[j].match(/^\s*(\w+)\s*:\s*\{\s*$/);
        if (abre) { nombre = abre[1]; break; }
      }
    }
    if (!TOCABLE.test(nombre)) continue;

    // La exención se busca en TODO el bloque de comentario que precede, no solo
    // en la línea inmediata: un motivo que merece explicarse rara vez cabe en
    // un renglón, y exigirlo empujaría a escribir justificaciones telegráficas.
    let exento = EXENCION.test(linea);
    for (let j = i - 1; j >= 0 && /^\s*(\/\/|\*|\/\*)/.test(lineas[j] ?? ''); j--) {
      if (EXENCION.test(lineas[j])) { exento = true; break; }
    }
    if (exento) continue;

    hallazgos.push({ ruta, linea: i + 1, nombre, valor, texto: linea.trim() });
  }
}

console.log('\nObjetivos táctiles\n');

if (hallazgos.length === 0) {
  console.log(`  Ningún control declarado por debajo de ${MINIMO} pt.\n`);
  process.exit(0);
}

for (const h of hallazgos) {
  console.log(`  \x1b[31mFALLA\x1b[0m ${h.ruta}:${h.linea}`);
  console.log(`        ${h.nombre} = ${h.valor} pt  (mínimo ${MINIMO})`);
  console.log(`        ${h.texto.slice(0, 76)}`);
}

console.error(`\n  ${hallazgos.length} control(es) por debajo de ${MINIMO} pt.`);
console.error('  Súbelos, o justifica la exención en la línea anterior con');
console.error('  `// toque-ok: <por qué el área real sí llega a 44>`.\n');
process.exit(1);
