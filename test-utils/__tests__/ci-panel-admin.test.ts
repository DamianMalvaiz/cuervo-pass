import { existsSync, readFileSync } from 'node:fs';

// El panel de admin web (`panel-admin/`) es lo más grande que se ha añadido al proyecto y decide quién aprueba vendedores y quién ve documentos de identidad. Un proyecto aparte con su propio
// `package.json` NO lo cubre el job `frontend` (que mira la app de estudiantes): sin un job propio, un cambio que rompa su tipado, sus pruebas o su construcción llegaría a producción sin que ningún
// CI lo dijera. Estas pruebas fijan que el job existe, que instala EXACTAMENTE el lock, y que las versiones de sus dependencias no flotan.

const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
const paquete = JSON.parse(readFileSync('panel-admin/package.json', 'utf8'));

// El bloque del job: desde su nombre hasta el siguiente job (una línea de dos espacios con nombre y dos puntos) o el final.
const trabajo = (() => {
  const i = ci.indexOf('\n  panel-admin:');
  if (i === -1) return '';
  const resto = ci.slice(i + 1);
  const sig = resto.slice(1).search(/\n  [a-z][\w-]*:\n/);
  return sig === -1 ? resto : resto.slice(0, sig + 1);
})();

test('el CI tiene un job propio para el panel de admin', () => {
  expect(trabajo.length).toBeGreaterThan(100);
});

test('corre dentro de panel-admin/ e instala exactamente el lock (npm ci, no npm install)', () => {
  expect(trabajo).toMatch(/working-directory:\s*panel-admin/);
  expect(trabajo).toMatch(/run:\s*npm ci\b/);
  expect(trabajo).not.toMatch(/run:\s*npm install\b/);
});

test.each(['npm run typecheck', 'npm test', 'npm run build', 'npm run verificar:audit'])('ejecuta «%s»', (comando) => {
  expect(trabajo).toContain(`run: ${comando}`);
});

test('el Node es el mismo que en el resto del CI (24) y la caché apunta al lock del panel', () => {
  expect(trabajo).toMatch(/node-version:\s*24/);
  expect(trabajo).toMatch(/cache-dependency-path:\s*panel-admin\/package-lock\.json/);
});

test('todas las acciones del archivo van fijadas por SHA, también la del panel', () => {
  const usos = [...ci.matchAll(/uses:\s*(\S+)/g)].map((m) => m[1]);
  expect(usos.length).toBeGreaterThan(0);
  for (const u of usos) expect(u).toMatch(/@[0-9a-f]{40}$/);
  expect(trabajo).toMatch(/uses:\s*actions\/checkout@[0-9a-f]{40}/);
  expect(trabajo).toMatch(/uses:\s*actions\/setup-node@[0-9a-f]{40}/);
});

test('los scripts que usa el CI existen en el paquete del panel', () => {
  for (const s of ['typecheck', 'test', 'build', 'verificar:audit']) expect(paquete.scripts[s]).toBeTruthy();
});

test('la auditoría del panel falla ante avisos altos (el panel hoy tiene cero; si aparece uno, hay que decidir)', () => {
  expect(paquete.scripts['verificar:audit']).toMatch(/npm audit .*--audit-level=high/);
});

test('el lock existe y ninguna dependencia flota (ni ^, ni ~, ni *, ni latest)', () => {
  expect(existsSync('panel-admin/package-lock.json')).toBe(true);
  const deps = { ...paquete.dependencies, ...paquete.devDependencies } as Record<string, string>;
  expect(Object.keys(deps).length).toBeGreaterThan(0);
  for (const [nombre, version] of Object.entries(deps)) {
    expect([nombre, version]).toEqual([nombre, expect.stringMatching(/^\d+\.\d+\.\d+$/)]);
  }
});
