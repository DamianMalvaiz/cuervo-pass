import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Un bloque de una fila que se envuelve (`flexWrap`) con una base ancha (`flexBasis: 300`+) y SIN `flexShrink` no se encoge en un teléfono: la caja se sale por la derecha y el ScrollView la recorta en silencio (el documento no dice que haya scroll
// horizontal, así que ni siquiera lo delata medir el ancho de la página). Medido el 03/11/2026 en Ayuda, Acuerdos y Presupuesto a 390 px. Esta guarda no sustituye mirarlo en un navegador: solo impide que vuelva por descuido.

const DIR = join(__dirname, '..', '..', 'src', 'components', 'web');
const ARCHIVOS = readdirSync(DIR).filter((f) => f.endsWith('.tsx'));

describe('los bloques de base ancha pueden encogerse', () => {
  const anchos = ARCHIVOS.flatMap((f) =>
    readFileSync(join(DIR, f), 'utf8')
      .split('\n')
      .map((linea, i) => ({ f, n: i + 1, linea }))
      .filter(({ linea }) => /flexBasis:\s*[3-9]\d\d\b/.test(linea))
  );

  it('hay bloques así (si esto da 0, la guarda dejó de mirar lo que debe)', () => {
    expect(anchos.length).toBeGreaterThanOrEqual(8);
  });

  it.each(anchos.map((a) => [`${a.f}:${a.n}`, a.linea] as const))('%s lleva flexShrink y un máximo del 100%%', (_donde, linea) => {
    expect(linea).toMatch(/flexShrink:\s*1/);
    expect(linea).toMatch(/maxWidth:\s*'100%'/);
  });
});
