import { readFileSync } from 'node:fs';

// El paso de auditoría del CI usa la puerta con excepciones, no el comando a secas.
//
// `npm audit --audit-level=high` no se podía poner en verde (hay avisos altos sin
// corrección publicada) y tenía solo dos salidas malas: dejarlo en rojo, que entrena a
// ignorar el rojo, o bajar el umbral, que deja pasar lo nuevo. Si alguien lo
// «simplifica» de vuelta al comando original, el CI vuelve a estar en rojo sin que el
// motivo sea evidente. Ver scripts/verificar-audit.mjs.

const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
const paquete = JSON.parse(readFileSync('package.json', 'utf8'));

test('el CI corre la puerta de auditoría con excepciones', () => {
  expect(ci).toMatch(/run:\s*npm run verificar:audit\b/);
});

test('el CI no vuelve al comando a secas', () => {
  expect(ci).not.toMatch(/run:\s*npm audit\b/);
});

test('el script de npm que usa el CI existe', () => {
  expect(paquete.scripts['verificar:audit']).toMatch(/verificar-audit\.mjs/);
});
