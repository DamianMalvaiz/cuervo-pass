import { execFileSync } from 'node:child_process';

// El guardián de los mensajes de validación en español.
//
// La configuración de Zod que los traduce es GLOBAL, pero hay que cargarla: un
// archivo que define un esquema sin importarla vuelve a mostrar el mensaje en
// inglés a quien deje un campo sin tocar. Es un olvido fácil —un formulario nuevo
// copiado de otro, con su esquema— y no falla ninguna prueba por sí solo.
//
// Mismo remedio que `clientes-registrados`: que el repositorio lo compruebe, en
// vez de que dependa de que alguien se acuerde.

test('todo archivo que define un esquema de Zod carga los mensajes en español', () => {
  const archivos = execFileSync('git', ['ls-files', 'src/*.ts', 'src/*.tsx'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .filter((f) => !f.includes('__tests__') && !f.endsWith('.d.ts'))
    // La propia configuración importa `zod` para configurarlo: es el origen.
    .filter((f) => !f.endsWith('src/lib/zodEs.ts'));

  const fs = require('node:fs') as typeof import('node:fs');
  const conEsquema = archivos.filter((f) => /from 'zod'/.test(fs.readFileSync(f, 'utf8')));

  // Si esto da cero, la búsqueda está rota y el guardián pasaría sin comprobar nada.
  expect(conEsquema.length).toBeGreaterThan(0);

  const sinCargar = conEsquema.filter((f) => !/import '@\/lib\/zodEs'/.test(fs.readFileSync(f, 'utf8')));
  expect(sinCargar).toEqual([]);
});
