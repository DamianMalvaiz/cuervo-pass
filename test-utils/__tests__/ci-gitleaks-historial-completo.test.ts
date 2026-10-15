import { readFileSync } from 'node:fs';

// El job `secretos` necesita el historial COMPLETO.
//
// La acción de gitleaks escanea, en un push, el rango `<primer commit del push>^..<último>`.
// Con el `checkout` por defecto (profundidad 1) ese padre no existe y gitleaks falla con
// «fatal: ambiguous argument …^..…: unknown revision» y «0 commits scanned», lo que pone
// el job en rojo SIN haber encontrado ningún secreto. Antes no se notaba porque los pushes
// eran de un commit, y la acción trata ese caso aparte; el primer push de varios commits
// lo rompió. Reproducido con un clon `--depth 1`: mismo error. Con el clon completo, el
// rango resuelve.
//
// Peor que el rojo es lo que implica: un escáner de secretos que no escanea nada, en un
// proyecto cuyo tema central es el manejo de credenciales.

const ci = readFileSync('.github/workflows/ci.yml', 'utf8');

/** El texto de un job: desde `  nombre:` hasta el siguiente job de primer nivel. */
function job(nombre: string): string {
  const inicio = ci.indexOf(`\n  ${nombre}:`);
  expect(inicio).toBeGreaterThan(-1);
  const resto = ci.slice(inicio + 1);
  const siguiente = resto.slice(1).search(/\n  [a-z][\w-]*:\s*\n/);
  return siguiente === -1 ? resto : resto.slice(0, siguiente + 1);
}

test('el job secretos hace checkout con el historial completo', () => {
  const secretos = job('secretos');
  expect(secretos).toMatch(/gitleaks\/gitleaks-action/); // si no, la búsqueda del job está rota
  expect(secretos).toMatch(/actions\/checkout@[0-9a-f]{40}[^\n]*\n\s*with:\s*\{\s*fetch-depth:\s*0\s*\}/);
});
