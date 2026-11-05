import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// `FilaAjuste` NO lleva margen lateral: se lo da `GrupoAjustes`, que además separa los renglones con un filete. Detectado el 24/10/2026 en el teléfono: el
// Perfil, el Perfil de vendedor y el Panel armaban su propia tarjeta con un `View` y el recuadro del icono quedaba pegado al borde izquierdo.
//
// Regla: una pantalla o componente que pinta un `<FilaAjuste` lo hace dentro de un `<GrupoAjustes`. Si alguna vez hace falta otra cosa, se cambia
// `GrupoAjustes`, no se vuelve a copiar su tarjeta.
function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return nombre === '__tests__' ? [] : archivos(ruta);
    return /\.tsx$/.test(nombre) ? [ruta] : [];
  });
}

// Excepción: el cuestionario pinta sus interruptores directo sobre la página, dentro de `Seccion` y sin tarjeta con borde: no hay borde contra el que pegarse.
const SIN_TARJETA = [join('components', 'FormularioCuestionario.tsx')];

test('toda fila de ajustes vive dentro de un GrupoAjustes', () => {
  const raiz = join(__dirname, '..', '..');
  const sueltas: string[] = [];
  for (const ruta of archivos(join(raiz, 'src'))) {
    if (ruta.endsWith(join('ficha', 'FilaAjuste.tsx')) || SIN_TARJETA.some((e) => ruta.endsWith(e))) continue;
    const texto = readFileSync(ruta, 'utf8');
    if (texto.includes('<FilaAjuste') && !texto.includes('<GrupoAjustes')) sueltas.push(relative(raiz, ruta));
  }
  expect(sueltas).toEqual([]);
});
