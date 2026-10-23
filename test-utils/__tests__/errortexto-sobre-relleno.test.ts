import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// `theme.errorTexto` NO es un color de texto de error: es el color del texto que va SOBRE un relleno de
// `theme.error` (blanco en claro, carbón en oscuro). Usado sobre el fondo de la app queda en 1.09:1 en claro
// (`#FFFFFF` sobre `#F4F6F2`) y en 1:1 en oscuro (`#171A18` sobre `#171A18`: el mismo color) — texto invisible.
// Detectado el 22/10/2026 en cinco sitios, tres de ellos botones destructivos («Borrar mi reseña», «Quitar del
// menú», «Borrar mi negocio»); `verificar:contraste` seguía en verde porque ese par no está declarado.
//
// Un texto de error sobre el fondo usa `theme.error`. `errorTexto` solo vale con el relleno justo detrás: se exige
// `backgroundColor: theme.error` en la misma línea o en las ocho anteriores.
const VENTANA = 8;

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return nombre === '__tests__' ? [] : archivos(ruta);
    return /\.tsx?$/.test(nombre) ? [ruta] : [];
  });
}

test('`theme.errorTexto` solo se usa sobre un relleno de `theme.error`', () => {
  const raiz = join(__dirname, '..', '..');
  const sospechosos: string[] = [];

  for (const ruta of archivos(join(raiz, 'src'))) {
    if (ruta.endsWith(join('constants', 'theme.ts'))) continue;
    const lineas = readFileSync(ruta, 'utf8').split('\n');
    lineas.forEach((linea, i) => {
      if (!linea.includes('theme.errorTexto')) return;
      const contexto = lineas.slice(Math.max(0, i - VENTANA), i + 1).join('\n');
      if (!/backgroundColor:\s*theme\.error\b/.test(contexto)) {
        sospechosos.push(`${relative(raiz, ruta)}:${i + 1}`);
      }
    });
  }

  expect(sospechosos).toEqual([]);
});
