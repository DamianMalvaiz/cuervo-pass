import { execFileSync } from 'node:child_process';

// Las cabeceras del panel de admin web (admin.cuervo360.com). Se prueba la lógica pura de `scripts/web-admin-csp.mjs` (se ejecuta con Node: es un .mjs).
// Lo que se protege: sin 'unsafe-inline' ni 'unsafe-eval' en scripts, el script en línea solo pasa por su hash, y las conexiones e imágenes solo van al
// Supabase de producción, nunca a un comodín.

const PROD = 'https://vhkblnazibvuqgabsazx.supabase.co';
const correr = (cuerpo: string) =>
  execFileSync(process.execPath, ['--no-warnings', '--input-type=module', '-e', `import * as m from './scripts/web-admin-csp.mjs'; ${cuerpo}`], { encoding: 'utf8' }).trim();

const csp = (hashes = "['\\'sha256-AAA\\'']") => correr(`console.log(m.construirCsp({ supabaseUrl: '${PROD}', hashes: new Set(${hashes}) }))`);

test('el script en línea se permite por hash; nunca unsafe-inline ni unsafe-eval en script-src', () => {
  const script = csp().split('; ').find((d) => d.startsWith('script-src'))!;
  expect(script).toContain("'self'");
  expect(script).toContain("'sha256-AAA'");
  expect(script).not.toMatch(/unsafe-inline|unsafe-eval/);
});

test('imágenes y conexiones solo hacia el Supabase de producción (sin comodines)', () => {
  const directivas = csp().split('; ');
  expect(directivas.find((d) => d.startsWith('connect-src'))).toBe(`connect-src 'self' ${PROD} wss://vhkblnazibvuqgabsazx.supabase.co`);
  expect(directivas.find((d) => d.startsWith('img-src'))).toContain(PROD);
  expect(csp()).not.toMatch(/\*|https:(?!\/\/vhkbl)(?=[ ;]|$)/);
});

test('no se deja enmarcar, no envía formularios ni fija base', () => {
  const c = csp();
  expect(c).toContain("default-src 'none'");
  expect(c).toContain("frame-ancestors 'none'");
  expect(c).toContain("form-action 'none'");
  expect(c).toContain("base-uri 'none'");
});

test('un Supabase que no es https (local) no genera cabeceras de producción', () => {
  expect(() => correr("m.construirCsp({ supabaseUrl: 'http://127.0.0.1:54321', hashes: new Set() })")).toThrow();
});

test('scriptsEnLinea toma los scripts sin src y no los externos', () => {
  const html = '<script type="module">globalThis.x=1;</script><script src="/a.js" defer></script><script></script>';
  expect(JSON.parse(correr(`console.log(JSON.stringify(m.scriptsEnLinea(${JSON.stringify(html)})))`))).toEqual(['globalThis.x=1;']);
});

test('hashDeScript es el sha256 en base64 que pide la CSP (vector conocido)', () => {
  // echo -n "abc" | openssl dgst -sha256 -binary | base64
  expect(correr("console.log(m.hashDeScript('abc'))")).toBe("'sha256-ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0='");
});

test('las cabeceras prohíben indexar y no guardan la página, pero cachean lo estático', () => {
  const h = correr(`console.log(m.construirCabeceras({ supabaseUrl: '${PROD}', hashes: new Set() }))`);
  expect(h).toContain('X-Robots-Tag: noindex, nofollow');
  expect(h).toContain('Cache-Control: no-store');
  expect(h).toMatch(/\/_expo\/static\/\*\n  Cache-Control: public, max-age=31536000, immutable/);
  expect(h).toContain('X-Frame-Options: DENY');
});
