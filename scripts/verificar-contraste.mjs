#!/usr/bin/env node
//
// Verificador de contraste · END-29
//
//   npm run verificar:contraste
//
// Por qué existe: `theme.ts` afirma en su encabezado que «todos los contrastes
// de este archivo están medidos, no supuestos». Y era verdad a medias — se
// midieron doce pares de TEXTO sobre fondo, correctamente, y ninguna superficie
// contra superficie. Que es justo la que fallaba.
//
// `tintedSurface` contra `background` en modo claro da **1.00**. El «lavado del
// sello» —que el sistema define como «el bloque que la hoja quiere destacar»—
// tiene exactamente la misma luminancia que el papel. Es un cambio de matiz con
// cero cambio de valor: desaparece bajo el sol, con reflejo, en escala de
// grises y para alguien con daltonismo. El bloque destacado no destaca.
//
// Una afirmación sin su comando es una promesa. Esto es el comando.

import { readFileSync } from 'node:fs';

// ── Medición ────────────────────────────────────────────────────────────
const canal = (v) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

function luminancia(hex) {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

export function razon(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

// ── Qué se exige, y por qué ─────────────────────────────────────────────
//
//   texto      4.5  · WCAG 1.4.3 para tamaño normal.
//   control    3.0  · WCAG 1.4.11 para bordes de componentes de interfaz.
//   superficie 1.2  · NO es de WCAG. WCAG no cubre superficie contra
//                     superficie, y por eso este par se escapó. 1.2 es el
//                     mínimo para que un bloque se distinga del fondo sin
//                     depender del matiz. Un borde de 3.0 lo sustituye: si el
//                     bloque está delineado, su relleno puede ser sutil.
const MINIMOS = { texto: 4.5, control: 3.0, superficie: 1.2 };

const PARES = [
  // Texto sobre sus fondos.
  ['texto', 'text', 'background'],
  ['texto', 'text', 'backgroundElement'],
  ['texto', 'text', 'backgroundSelected'],
  ['texto', 'text', 'tintedSurface'],
  ['texto', 'textSecondary', 'background'],
  ['texto', 'textSecondary', 'backgroundElement'],
  ['texto', 'acento', 'background'],
  ['texto', 'error', 'background'],
  ['texto', 'exito', 'background'],
  ['texto', 'errorTexto', 'error'],
  // Bordes de control.
  ['control', 'border', 'background'],
  ['control', 'border', 'backgroundElement'],
  // Superficie contra superficie: lo que nunca se midió.
  ['superficie', 'backgroundElement', 'background'],
  ['superficie', 'backgroundSelected', 'background'],
  ['superficie', 'tintedSurface', 'background'],
];

// Un relleno sutil se salva si su BORDE delinea el bloque con ≥3.0. Por eso
// estos pares se evalúan juntos y no por separado.
const RESCATES = { tintedSurface: 'tintedBorder', backgroundElement: 'border' };

// ── Lectura del tema ────────────────────────────────────────────────────
// Se lee el archivo y se extraen los literales, en vez de importarlo: theme.ts
// es TypeScript y arrastra dependencias de React Native que no existen en Node.
function leerTema() {
  const fuente = readFileSync('src/constants/theme.ts', 'utf8');
  const modos = {};
  for (const modo of ['light', 'dark']) {
    const i = fuente.indexOf(`  ${modo}: {`);
    const j = fuente.indexOf('\n  },', i);
    const bloque = fuente.slice(i, j);
    modos[modo] = Object.fromEntries(
      [...bloque.matchAll(/(\w+):\s*'(#[0-9a-fA-F]{6})'/g)].map((m) => [m[1], m[2]])
    );
  }
  return modos;
}

// El cuerpo corre SOLO al invocarlo directamente. Sin esta guarda, importar
// `razon` desde otro módulo —una prueba, por ejemplo— ejecutaba el verificador
// entero y salía con código 1, que es exactamente lo que pasó la primera vez.
export function verificar() {
  const tema = leerTema();
  const fallos = [];

  console.log('\nContraste del sistema visual\n');

  for (const [modo, colores] of Object.entries(tema)) {
    console.log(`  ── ${modo === 'light' ? 'papel (claro)' : 'lámpara (oscuro)'} ──`);
    for (const [clase, frente, fondo] of PARES) {
      if (!colores[frente] || !colores[fondo]) continue;
      const r = razon(colores[frente], colores[fondo]);
      const minimo = MINIMOS[clase];
      let pasa = r >= minimo;
      let nota = '';

      if (!pasa && clase === 'superficie' && RESCATES[frente]) {
        const rb = razon(colores[RESCATES[frente]], colores[fondo]);
        if (rb >= MINIMOS.control) {
          pasa = true;
          nota = ` (rescatado por ${RESCATES[frente]}: ${rb.toFixed(2)})`;
        }
      }

      const marca = pasa ? '\x1b[32mok   \x1b[0m' : '\x1b[31mFALLA\x1b[0m';
      console.log(`  ${marca} ${frente} / ${fondo}`.padEnd(52) +
        `${r.toFixed(2)}  (mín ${minimo})${nota}`);
      if (!pasa) fallos.push(`${modo}: ${frente}/${fondo} = ${r.toFixed(2)}, mínimo ${minimo}`);
    }
    console.log('');
  }

  if (fallos.length) {
    console.error(`  ${fallos.length} par(es) por debajo del mínimo:\n`);
    for (const f of fallos) console.error(`    · ${f}`);
    console.error('\n  Corrige moviendo el VALOR, no el matiz: el mundo visual no cambia.\n');
    process.exit(1);
  }

  console.log('  Todos los pares declarados cumplen su mínimo.\n');
}

const invocadoDirecto =
  process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (invocadoDirecto) verificar();
