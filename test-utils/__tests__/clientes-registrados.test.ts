import { execFileSync } from 'node:child_process';

// V.7 · El guardia que hace que esto no dependa de la memoria de nadie.
//
// Un `QueryClient` creado a mano en una prueba no queda registrado, así que el
// `afterEach` global de `jest.setup.js` no lo libera, sus temporizadores de
// recolección siguen vivos y el worker de Jest cuelga — hasta 200 s por
// archivo, medido el 26/09/2026.
//
// Se intentó que esto no hiciera falta, envolviendo el constructor de
// `QueryClient` desde `jest.setup.js`. No se puede: el espacio de nombres del
// módulo es de solo lectura y la asignación se ignora EN SILENCIO (comprobado:
// `rq.QueryClient = Envuelto` deja `rq.QueryClient === Envuelto` en `false`).
//
// Así que la alternativa a este guardia sería una nota en AGENTS.md, y este
// repositorio ya sabe lo que valen: la separación de los `.env` era un párrafo
// y se incumplió durante meses, hasta que `verificar-env.mjs` la volvió una
// compuerta.

const PROHIBIDOS = [
  // Crear el cliente a mano, además de colgar el proceso, hace que la prueba
  // deje de comprobar la configuración REAL: `staleTime`, `retry` y
  // `refetchOnWindowFocus` salen de `crearClienteConsultas`, y un cliente
  // propio los sustituye por otros sin que nadie lo note.
  'new QueryClient(',
  // El de la app, directo. Es el correcto para la app y el equivocado para una
  // prueba: no queda registrado para liberarse.
  'crearClienteConsultas(',
];

test('ninguna prueba crea su QueryClient por su cuenta', () => {
  // Se listan por git y no por glob: así no entra nada de node_modules ni de
  // una carpeta de trabajo sin versionar.
  const archivos = execFileSync('git', ['ls-files', '*.test.ts', '*.test.tsx'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    // Este archivo cita las cadenas prohibidas: es el guardia, no un infractor.
    .filter((f) => !f.endsWith('clientes-registrados.test.ts'));

  expect(archivos.length).toBeGreaterThan(0);

  const fs = require('node:fs') as typeof import('node:fs');
  const infractores = archivos.filter((f) => {
    const texto = fs.readFileSync(f, 'utf8');
    return PROHIBIDOS.some((p) => texto.includes(p));
  });

  expect(infractores).toEqual([]);
});
