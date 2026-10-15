import { existsSync, readFileSync } from 'node:fs';

// El README no describe un sistema distinto al construido.
//
// AGENTS.md lo llama el defecto más caro del proyecto, y el README lo ilustraba con sus
// propias líneas: decía «Cuántas hay lo dice el archivo — aquí no se escribe, porque un
// número escrito envejece y este ya lo hizo dos veces», y unas líneas más abajo escribía
// 296 pruebas de jest cuando eran 735, 20 de pytest cuando eran 26, «114 publicaciones»
// cuando la base tiene 115 y «treinta y ocho» hallazgos cuando son cuarenta. Una regla
// escrita en un párrafo no se cumple sola: se comprueba.
//
// Aquí solo van las comprobaciones BARATAS y que atrapan clases de deriva reales, todas
// observadas en este README el 15/10/2026:
//   · una cifra que el repositorio puede consultar sin ejecutar nada tiene que COINCIDIR;
//   · una cifra que solo se obtiene ejecutando algo (pruebas, filas, barreras) NO se copia;
//   · lo que el README manda correr o abrir tiene que EXISTIR.
// Un número que no se puede verificar estáticamente simplemente no se escribe.

const readme = readFileSync('README.md', 'utf8');
const leer = (ruta: string) => readFileSync(ruta, 'utf8');

test('las aserciones de pgTAP que dice el README son las que dice el archivo', () => {
  const plan = Number(/select plan\((\d+)\)/.exec(leer('supabase/tests/rls.test.sql'))?.[1]);
  expect(plan).toBeGreaterThan(0); // si no, la lectura del plan está rota

  const citadas = [...readme.matchAll(/(\d+) aserciones/g)].map((m) => Number(m[1]));
  expect(citadas.length).toBeGreaterThan(0);
  expect(citadas.filter((n) => n !== plan)).toEqual([]);
});

// Lo que solo se sabe ejecutando algo no se copia: envejece en el siguiente commit.
test('el README no copia cifras que solo se obtienen ejecutando algo', () => {
  const copiadas = [...readme.matchAll(/\b\d+ (pruebas|publicaciones|usuarios|barreras|migraciones)\b/g)].map((m) => m[0]);
  expect(copiadas).toEqual([]);
});

// `npx supabase test db   # 86` — el número de un comentario al final de una orden. Se
// excluye «N aserciones»: ese número SÍ se verifica, en la primera comprobación de este
// archivo, contra el `select plan(N)` del archivo de pruebas.
test('ninguna orden de prueba lleva copiado su resultado en un comentario', () => {
  const lineas = readme
    .split('\n')
    .filter((l) => /(supabase test db|npm test|prueba-rls|pytest)/.test(l) && /#\s*\d+\b(?! aserciones)/.test(l));
  expect(lineas).toEqual([]);
});

// El README decía «treinta y ocho»; el documento tiene cuarenta. Se compara el MAYOR id que
// cita el README con el mayor que tiene el documento, y se exige que el README lo cite.
test('el README cita el rango real de hallazgos END', () => {
  const enDocumento = [...leer('docs/endurecimiento-v6.md').matchAll(/^\*\*END-(\d+)/gm)].map((m) => Number(m[1]));
  expect(enDocumento.length).toBeGreaterThan(0);
  const maxDocumento = Math.max(...enDocumento);

  const enReadme = [...readme.matchAll(/END-(\d+)/g)].map((m) => Number(m[1]));
  expect(Math.max(...enReadme)).toBe(maxDocumento);
  // Y no queda ningún número en palabras que pueda contradecirlo.
  expect(readme).not.toMatch(/treinta y ocho/i);
});

test('todo `npm run X` que cita el README existe en package.json', () => {
  const scripts = JSON.parse(leer('package.json')).scripts as Record<string, string>;
  const citados = [...readme.matchAll(/npm run ([a-z][\w:-]*)/g)].map((m) => m[1]);
  expect(citados.length).toBeGreaterThan(0);
  expect(citados.filter((s) => !(s in scripts))).toEqual([]);
});

test('toda ruta del repositorio que cita el README existe', () => {
  const rutas = [
    ...readme.matchAll(/(?:docs|scripts|src|supabase|ai-service|test-utils|\.github)\/[A-Za-z0-9_./-]+\.(?:md|mjs|ts|tsx|sql|yml|json|js|py|sh)/g),
  ].map((m) => m[0]);
  expect(rutas.length).toBeGreaterThan(0);
  expect([...new Set(rutas)].filter((r) => !existsSync(r))).toEqual([]);
});

// Falso desde que producción tiene su historial completo (42 de 42, sin deriva): seguir
// esa instrucción mandaba a «reparar» un historial que no está roto.
test('el README no exige un `migration repair` previo', () => {
  expect(readme).not.toMatch(/migration repair/i);
});
