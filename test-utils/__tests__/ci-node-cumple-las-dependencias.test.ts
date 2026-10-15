import { readFileSync } from 'node:fs';

// La versión de Node del CI cumple lo que EXIGEN las dependencias.
//
// El CI fijaba `node-version: 20` y `@supabase/supabase-js@2.116.0` declara
// `engines.node >= 22.0.0`: necesita el WebSocket nativo de Node 22. Con Node 20,
// `createClient` lanza «Node.js detected but native WebSocket not found» y las seis
// suites que importan el cliente real (sin doble) ni siquiera arrancan: 66 pruebas sin
// ejecutarse. En la máquina de desarrollo (Node 24) pasaban todas, y por eso el defecto
// llevaba esperando: el job `frontend` fallaba antes, en `npm audit`, y nunca llegaba
// a las pruebas.
//
// El mínimo se LEE del `package.json` instalado y no se copia aquí: si mañana una
// dependencia sube su mínimo, esta prueba lo sabe sin que nadie edite un número.

const ci = readFileSync('.github/workflows/ci.yml', 'utf8');

/** El mayor mínimo `>=N` que declaran las dependencias directas que se importan en la app. */
function minimoDeNode(): { paquete: string; minimo: number } {
  let peor = { paquete: '', minimo: 0 };
  for (const paquete of ['@supabase/supabase-js', '@supabase/realtime-js']) {
    const engines = JSON.parse(readFileSync(`node_modules/${paquete}/package.json`, 'utf8')).engines?.node as string | undefined;
    const m = engines && /^>=\s*(\d+)/.exec(engines);
    if (m && Number(m[1]) > peor.minimo) peor = { paquete, minimo: Number(m[1]) };
  }
  return peor;
}

test('hay un mínimo que comprobar (si no, la lectura está rota)', () => {
  expect(minimoDeNode().minimo).toBeGreaterThan(0);
});

test('todo node-version del CI es al menos el que exigen las dependencias', () => {
  const { paquete, minimo } = minimoDeNode();
  const versiones = [...ci.matchAll(/node-version:\s*['"]?(\d+)/g)].map((m) => Number(m[1]));

  expect(versiones.length).toBeGreaterThan(0);

  // Al fallar, el diff nombra al paquete que lo exige y las versiones que se quedan cortas.
  const exige = `${paquete} exige Node >=${minimo}`;
  expect({ exige, versionesDelCiPorDebajo: versiones.filter((v) => v < minimo) }).toEqual({
    exige,
    versionesDelCiPorDebajo: [],
  });
});
