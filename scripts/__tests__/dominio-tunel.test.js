// V.3 · El guardia de `.tunel-actual`.
//
// Por qué existe esta prueba y no una revisión a ojo: el 19/09/2026 ese archivo
// contenía `http://127.0.0.1:8000` —la URL local, no el dominio público— y eso
// desactivó EN SILENCIO las dos comprobaciones previas a exponer la app:
//
//   · `tunel.sh` hacía `curl "$ANTERIOR/listo"`, que contra localhost responde
//     200 SIEMPRE, imprimía «sigue vivo. No se toca» y salía con 0. Nunca
//     volvía a crear un túnel.
//   · `verificar.mjs` comprobaba localhost creyendo comprobar el túnel. Su
//     propio comentario dice: «En localhost siempre se ve bien».
//
// Un verificador que da confianza falsa justo antes de exponer es peor que no
// tenerlo. Se prueba el CLI de verdad —el mismo que invoca tunel.sh— y no una
// copia de su lógica.

const { execFileSync } = require('node:child_process');
const { join } = require('node:path');

const CLI = join(__dirname, '..', 'dominio-tunel.mjs');

/** Código de salida del CLI: 0 = es un dominio de túnel, 1 = no lo es. */
function codigo(valor) {
  try {
    execFileSync('node', [CLI, valor], { stdio: 'pipe' });
    return 0;
  } catch (e) {
    return e.status ?? -1;
  }
}

describe('dominio-tunel · acepta', () => {
  it.each([
    'https://arising-lightbox-radio-analyzed.trycloudflare.com',
    'https://words-streets-resort-unavailable.trycloudflare.com',
  ])('%s', (v) => expect(codigo(v)).toBe(0));
});

describe('dominio-tunel · rechaza', () => {
  it.each([
    // EL caso. Es lo que había en el archivo el 19/09.
    ['la URL local', 'http://127.0.0.1:8000'],
    ['localhost por nombre', 'http://localhost:8000'],
    ['sin protocolo', 'arising-lightbox.trycloudflare.com'],
    // `http://` contra un túnel es degradar la conexión sin avisar.
    ['http en vez de https', 'http://arising-lightbox.trycloudflare.com'],
    ['vacío', ''],
    ['solo espacios', '   '],
    // Un dominio que solo TERMINA pareciéndose: el mismo tipo de trampa que
    // src/lib/correoUniversitario.ts ya cubre para los correos.
    ['dominio impostor', 'https://trycloudflare.com.atacante.net'],
    ['subdominio del impostor', 'https://malo.trycloudflare.com.evil.io'],
    ['ruta pegada', 'https://algo.trycloudflare.com/listo'],
  ])('%s', (_, v) => expect(codigo(v)).toBe(1));
});
