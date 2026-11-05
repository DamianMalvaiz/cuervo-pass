// La carpeta de capturas de respaldo de la demo: se crea con su LEEME y se REVISA (qué falta). Se prueba el CLI de verdad, en una carpeta temporal.

const { execFileSync } = require('node:child_process');
const { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const CLI = join(__dirname, '..', 'capturas-demo.mjs');
const correr = (...args) => {
  try {
    return { codigo: 0, salida: execFileSync('node', [CLI, ...args], { stdio: 'pipe' }).toString() };
  } catch (e) {
    return { codigo: e.status ?? -1, salida: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
};

let dir;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'capturas-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

it('crea la carpeta y un LEEME con las diez capturas y la grabación', () => {
  const carpeta = join(dir, 'nueva');
  const r = correr(carpeta);
  expect(r.codigo).toBe(0);
  const leeme = readFileSync(join(carpeta, 'LEEME.md'), 'utf8');
  expect(leeme).toContain('01-para-ti.png');
  expect(leeme).toContain('10-chat.png');
  expect(leeme).toContain('grabacion.mp4');
  expect(leeme).toMatch(/no las subas|no las agregues al repositorio/);
});

it('revisar una carpeta que no existe falla y dice cómo crearla', () => {
  const r = correr(join(dir, 'no-existe'), '--revisar');
  expect(r.codigo).toBe(1);
  expect(r.salida).toMatch(/No existe/);
});

it('revisar con la carpeta vacía: faltan las diez capturas y la grabación (sale con 1)', () => {
  const r = correr(dir, '--revisar');
  expect(r.codigo).toBe(1);
  expect(r.salida.match(/\[FALTA\]/g)).toHaveLength(11);
  expect(r.salida).toMatch(/Faltan 11/);
});

it('reconoce cada captura por su número, con png, jpg o webp, y la grabación por su nombre', () => {
  const nombres = ['01-para-ti.png', '02-lo-que-sea.jpg', '03.webp', '04_algo.PNG', '05-x.png', '06-x.png', '07-x.png', '08-x.png', '09-x.png', '10-x.png'];
  for (const n of nombres) writeFileSync(join(dir, n), '');
  let r = correr(dir, '--revisar');
  expect(r.codigo).toBe(1);
  expect(r.salida.match(/\[FALTA\]/g)).toHaveLength(1); // solo la grabación
  writeFileSync(join(dir, 'grabacion.webm'), '');
  r = correr(dir, '--revisar');
  expect(r.codigo).toBe(0);
  expect(r.salida).toMatch(/Completo/);
});

it('un archivo que no es imagen (ni empieza por un número de paso) no cuenta como captura', () => {
  writeFileSync(join(dir, '01-para-ti.txt'), '');
  writeFileSync(join(dir, 'captura-02.png'), '');
  const r = correr(dir, '--revisar');
  expect(r.salida).toMatch(/\[FALTA\] 01-para-ti/);
  expect(r.salida).toMatch(/\[FALTA\] 02-ficha-con-cuenta/);
  expect(existsSync(join(dir, 'LEEME.md'))).toBe(false);
});
