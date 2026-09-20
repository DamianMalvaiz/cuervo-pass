#!/usr/bin/env node
//
// Guardián del reparto de variables de entorno · ORDEN A.3
//
//   node scripts/verificar-env.mjs [archivo...]
//
// Por qué existe: `.env.example` lleva desde la v3 diciendo que mezclar cliente
// y servidor en un solo archivo «es el defecto más peligroso que tenía», y el
// proyecto lo estuvo haciendo igual durante meses. La separación era un párrafo
// en un comentario, no un mecanismo. Un párrafo no impide que mañana alguien
// escriba EXPO_PUBLIC_ANTHROPIC_API_KEY y lo publique en una tienda.
//
// Dos reglas, una por archivo:
//
//   .env         solo EXPO_PUBLIC_*. Todo lo que hay aquí se compila DENTRO del
//                bundle, donde cualquiera con el APK lo lee.
//   .env.server  NADA con EXPO_PUBLIC_*. Si algo de aquí lo necesitara el
//                cliente, es que no era secreto.
//
// Sale con código 1 si alguna se rompe. Corre en CI sobre los .example, que sí
// se versionan, y a mano sobre los reales.

import { readFileSync, existsSync } from 'node:fs';

const REGLAS = {
  '.env':                { exige: true,  etiqueta: 'CLIENTE (acaba dentro del APK)' },
  '.env.example':        { exige: true,  etiqueta: 'CLIENTE (plantilla)' },
  '.env.server':         { exige: false, etiqueta: 'SERVIDOR' },
  '.env.server.example': { exige: false, etiqueta: 'SERVIDOR (plantilla)' },
};

// Palabras que delatan una credencial. No es exhaustivo y no pretende serlo:
// la regla dura es el prefijo; esto solo atrapa el caso obvio antes.
const SOSPECHOSAS = /(SECRET|SERVICE_ROLE|PASSWORD|PRIVATE|_KEY$|API_KEY|TOKEN)/i;
// Públicas POR DISEÑO. Cada una lleva su motivo escrito: una lista de exenciones
// sin motivos se convierte en el sitio donde acaba escondiéndose la que sí era
// un secreto.
//
//   EXPO_PUBLIC_SUPABASE_ANON_KEY — la anon key existe para estar en el cliente;
//     lo que protege las filas es RLS, no que la clave sea secreta.
//   EXPO_PUBLIC_MAPBOX_TOKEN — token `pk.`, restringido por URL.
//   EXPO_PUBLIC_GOOGLE_MAPS_KEY — las claves de Maps para Android van DENTRO del
//     APK por diseño de Google, que no las protege con secreto sino con
//     restricción por nombre de paquete + huella SHA-1 de la firma. Extraerla del
//     APK no sirve de nada si está restringida; y si no lo está, el problema es
//     la restricción que falta, no el prefijo. Las instrucciones para
//     restringirla están en .env.example, junto a la variable.
const PUBLICAS_POR_DISENO = new Set([
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_MAPBOX_TOKEN',
  'EXPO_PUBLIC_GOOGLE_MAPS_KEY',
]);

const archivos = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(REGLAS);
const problemas = [];
let revisados = 0;

for (const archivo of archivos) {
  const regla = REGLAS[archivo];
  if (!regla) { problemas.push(`${archivo}: no hay regla definida para este archivo`); continue; }
  if (!existsSync(archivo)) continue;   // .env.server puede no existir en CI
  revisados += 1;

  const claves = readFileSync(archivo, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => l.split('=')[0].trim());

  for (const clave of claves) {
    const esPublica = clave.startsWith('EXPO_PUBLIC_');

    if (regla.exige && !esPublica) {
      problemas.push(`${archivo}: \`${clave}\` no lleva EXPO_PUBLIC_. Este archivo es del ${regla.etiqueta}; los secretos van en .env.server`);
    }
    if (!regla.exige && esPublica) {
      problemas.push(`${archivo}: \`${clave}\` lleva EXPO_PUBLIC_ en el archivo del SERVIDOR. Si el cliente lo necesita, no era secreto`);
    }
    if (regla.exige && esPublica && SOSPECHOSAS.test(clave) && !PUBLICAS_POR_DISENO.has(clave)) {
      problemas.push(`${archivo}: \`${clave}\` parece una credencial Y lleva EXPO_PUBLIC_. Se compila dentro del APK, donde cualquiera la lee`);
    }
  }
}

if (problemas.length) {
  console.error('\n  Reparto de variables de entorno ROTO:\n');
  for (const p of problemas) console.error(`    ✗ ${p}`);
  console.error('\n  Ver la seccion "Secretos" de AGENTS.md.\n');
  process.exit(1);
}

console.log(`\n  Reparto correcto en ${revisados} archivo(s) revisado(s).\n`);
