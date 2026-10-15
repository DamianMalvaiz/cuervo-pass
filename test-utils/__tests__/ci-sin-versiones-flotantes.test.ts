import { readFileSync } from 'node:fs';

// El guardián de las versiones de herramientas en el CI.
//
// El job `edge-functions` usaba `deno-version: v2.x`, una versión FLOTANTE: cada
// corrida instala el último Deno 2. Cuando Deno 2.9 endureció la resolución de
// dependencias npm y activó la regla de lint `no-import-prefix`, el job se puso en
// rojo SIN que el repositorio cambiara una línea: no había nada que bisecar. Es el
// mismo defecto que este archivo ya condena y corrige en otros sitios —las acciones
// van fijadas por SHA y el CLI de Supabase a `2.117.0`, con el motivo escrito—.
//
// Se comprueba que la versión de Deno sea EXACTA (`2.9.7`, no `v2.x` ni `latest`).
// Subirla es una decisión: se cambia aquí, se corre el job y se ve qué rompe.

const ci = readFileSync('.github/workflows/ci.yml', 'utf8');

test('la versión de Deno es exacta, no flotante', () => {
  const versiones = [...ci.matchAll(/deno-version:\s*['"]?([^'"\s}]+)['"]?/g)].map((m) => m[1]);

  // Si esto da cero, la búsqueda está rota y el guardián pasaría sin comprobar nada.
  expect(versiones.length).toBeGreaterThan(0);

  for (const v of versiones) {
    expect(v).toMatch(/^\d+\.\d+\.\d+$/);
  }
});

// `latest`, `v2.x`, `canary`… Ninguna versión de herramienta puede escribirse así.
test('ninguna versión de herramienta del CI es flotante', () => {
  // En cualquier posición de la línea: `with: { deno-version: v2.x }` va en llaves y no
  // empieza por `version:`. Una expresión anclada al inicio no lo vería, y el guardián
  // pasaría justo en el caso que existe para atrapar.
  const flotantes = [...ci.matchAll(/[\w-]*version:\s*['"]?([^'"\s},#]+)/g)]
    .map((m) => m[1])
    .filter((v) => /^(latest|canary|stable|nightly)$/i.test(v) || /\.x$/i.test(v));
  expect(flotantes).toEqual([]);
});
