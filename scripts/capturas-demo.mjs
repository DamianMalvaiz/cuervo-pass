#!/usr/bin/env node
//
// Prepara (y revisa) la carpeta de CAPTURAS DE RESPALDO de la demostración (plan B: `docs/plan-b-demo.md`).
//
//   node scripts/capturas-demo.mjs [carpeta]              crea la carpeta y un LEEME con cada captura que hace falta
//   node scripts/capturas-demo.mjs [carpeta] --revisar    dice cuáles ya están y cuáles faltan (sale con 1 si falta alguna)
//
// La carpeta por omisión es `~/demo-capturas`, FUERA del repositorio: las capturas pueden llevar sesiones y datos de las cuentas de demostración y no se versionan.
// Cada captura se guarda con el nombre que dice el LEEME (el número y el nombre; la extensión puede ser png, jpg o webp). Al revisar basta con que el archivo EMPIECE por el número.

import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const PASOS = [
  ['01', 'para-ti', 'Para ti: saludo, tres cifras, atajos y el destacado grande con «Compatible contigo»'],
  ['02', 'ficha-con-cuenta', 'Una ficha con cuenta: dirección exacta, «Por qué podría encajar contigo» y la barra de anclas'],
  ['03', 'comparar', '/comparar con dos lugares: la tabla lado a lado (y «Más barato» si las rentas difieren)'],
  ['04', 'cerca-de-aqui', '/cerca: «a menos de 1 km · ~6 min a pie» y el texto de estimación'],
  ['05', 'guardados-busquedas', 'Guardados → Búsquedas con una búsqueda guardada'],
  ['06', 'perfil-de-roomie', 'El perfil de un roomie: afinidad en palabras, convivencia, «Iniciar chat»'],
  ['07', 'panel-vendedor', 'Mi panel del vendedor: verificación, cifras, plan'],
  ['08', 'vista-previa-negocio', 'Publicar negocio: el formulario con «Así se verá en Servicios» a la derecha'],
  ['09', 'vista-previa-menu', 'Menú del negocio: el editor con «Así se verá tu menú» a la derecha'],
  ['10', 'chat', 'Un chat con mensajes de las dos cuentas'],
];
const EXTENSIONES = /\.(png|jpe?g|webp)$/i;
const GRABACION = /^grabacion\.(mp4|webm|mkv|mov)$/i;

/** Qué capturas hay y cuáles faltan en `archivos` (los nombres de la carpeta). Una captura está si algún archivo con extensión de imagen EMPIEZA por su número. */
export function revisar(archivos) {
  const imagenes = archivos.filter((a) => EXTENSIONES.test(a));
  const pasos = PASOS.map(([n, nombre, texto]) => ({ n, nombre, texto, hay: imagenes.some((a) => a.startsWith(`${n}-`) || a.startsWith(`${n}.`) || a.startsWith(`${n}_`)) }));
  const grabacion = archivos.some((a) => GRABACION.test(a));
  return { pasos, grabacion, completo: grabacion && pasos.every((p) => p.hay) };
}

export function leeme() {
  const filas = PASOS.map(([n, nombre, texto]) => `| ${n} | \`${n}-${nombre}.png\` | ${texto} |`).join('\n');
  return `# Capturas de respaldo de la demostración

Guarda aquí, con el nombre indicado, una captura de cada paso del guion (\`docs/guion-demo.md\`), tomada en el ENSAYO y con las cuentas de demostración. Son el plan B si algo falla en vivo (\`docs/plan-b-demo.md\`).

| Paso | Nombre del archivo | Qué debe verse |
|---|---|---|
${filas}

Además, una **grabación de pantalla** del recorrido completo (1–2 min), guardada como \`grabacion.mp4\` (o \`.webm\`, \`.mkv\`, \`.mov\`): es el plan B si no hay internet.

Para ver qué falta: \`node scripts/capturas-demo.mjs ${'<esta carpeta>'} --revisar\`

Estas capturas pueden mostrar datos y sesiones de las cuentas de demostración: no las subas a ningún sitio ni las agregues al repositorio. Bórralas al terminar (\`rm -rf\` de esta carpeta).
`;
}

function main() {
  const args = process.argv.slice(2);
  const soloRevisar = args.includes('--revisar');
  const carpeta = args.find((a) => !a.startsWith('--')) ?? join(homedir(), 'demo-capturas');

  if (soloRevisar) {
    if (!existsSync(carpeta)) {
      console.error(`No existe ${carpeta}. Créala primero: node scripts/capturas-demo.mjs ${carpeta}`);
      process.exit(1);
    }
    const r = revisar(readdirSync(carpeta));
    for (const p of r.pasos) console.log(`${p.hay ? '[ OK ]' : '[FALTA]'} ${p.n}-${p.nombre}  ${p.hay ? '' : '· ' + p.texto}`);
    console.log(`${r.grabacion ? '[ OK ]' : '[FALTA]'} grabacion.mp4  ${r.grabacion ? '' : '· la grabación de pantalla del recorrido completo'}`);
    console.log(r.completo ? '\nCompleto: el plan B está listo.' : `\nFaltan ${r.pasos.filter((p) => !p.hay).length + (r.grabacion ? 0 : 1)} cosa(s).`);
    process.exit(r.completo ? 0 : 1);
  }

  mkdirSync(carpeta, { recursive: true });
  writeFileSync(join(carpeta, 'LEEME.md'), leeme());
  console.log(`Carpeta lista: ${carpeta}\nLEEME.md dice qué captura va con qué nombre (${PASOS.length} capturas y una grabación).\nCuando termines: node scripts/capturas-demo.mjs ${carpeta} --revisar`);
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href) main();
