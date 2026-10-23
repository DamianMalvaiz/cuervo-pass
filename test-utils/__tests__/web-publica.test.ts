import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { SECCIONES } from '../../src/lib/avisoPrivacidad';

// La web pública (cuervo360.com) es estática y se construye con `scripts/construir-web-publica.mjs`. Lo que se protege aquí:
//   · el aviso que se publica es el MISMO de la app (todas sus secciones), no una copia que se desfase;
//   · cero scripts y cero direcciones de desarrollo: es lo que fija el Site URL de producción;
//   · las cabeceras de seguridad existen y la página de destino de los correos no se indexa.

const leer = (n: string) => readFileSync(`web-publica/dist/${n}`, 'utf8');

beforeAll(() => {
  execFileSync(process.execPath, ['--no-warnings', 'scripts/construir-web-publica.mjs'], { stdio: 'pipe' });
});

test('el aviso publicado trae todas las secciones del de la app', () => {
  const html = leer('privacidad.html');
  expect(html.match(/<h2>/g)).toHaveLength(SECCIONES.length);
  for (const s of SECCIONES) expect(html).toContain(s.titulo.replace(/&/g, '&amp;'));
});

test.each(['index.html', 'privacidad.html', 'abrir-app.html', '404.html'])('%s: sin scripts ni direcciones de desarrollo', (n) => {
  const html = leer(n);
  expect(html).not.toMatch(/<script|localhost|127\.0\.0\.1|javascript:/i);
});

test('cabeceras de seguridad: CSP sin scripts, sin sniffing, sin marcos', () => {
  const h = leer('_headers');
  expect(h).toMatch(/Content-Security-Policy: default-src 'none'/);
  expect(h).not.toMatch(/script-src/);
  expect(h).toContain("frame-ancestors 'none'");
  expect(h).toContain('X-Content-Type-Options: nosniff');
});

test('la página de destino de los correos no se indexa y no procesa nada', () => {
  const html = leer('abrir-app.html');
  expect(html).toContain('<meta name="robots" content="noindex">');
  expect(html).not.toMatch(/<form|<input/i);
  expect(leer('robots.txt')).toContain('Disallow: /abrir-app');
});
