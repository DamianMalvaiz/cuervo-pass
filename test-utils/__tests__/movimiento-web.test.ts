import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// El movimiento de la web vive en `src/global.css` y solo se enciende cuando la persona NO pidió reducir movimiento. Lo que se fija: cada `animation`/`@keyframes` está DENTRO del bloque
// `@media (prefers-reduced-motion: no-preference)` (con «reducir movimiento» no se anima nada, pero el contenido sigue visible: las animaciones solo parten de un estado oculto con `both`, y sin ellas el estado
// natural es el visible), y la capa de movimiento no usa `will-change` permanente.

const css = readFileSync(join(__dirname, '..', '..', 'src', 'global.css'), 'utf8');

/** El texto del bloque `@media (prefers-reduced-motion: no-preference) { ... }`, con sus llaves balanceadas. */
function bloqueSinPreferencia(): string {
  const inicio = css.indexOf('@media (prefers-reduced-motion: no-preference)');
  if (inicio < 0) return '';
  let nivel = 0;
  for (let i = css.indexOf('{', inicio); i < css.length; i++) {
    if (css[i] === '{') nivel++;
    if (css[i] === '}' && --nivel === 0) return css.slice(inicio, i + 1);
  }
  return css.slice(inicio);
}

describe('movimiento de la web', () => {
  it('existe el bloque que lo enciende solo sin preferencia de reducir movimiento', () => {
    expect(bloqueSinPreferencia()).not.toBe('');
  });

  it('ninguna animación ni @keyframes vive fuera de ese bloque', () => {
    const fuera = css.replace(bloqueSinPreferencia(), '');
    expect(fuera).not.toMatch(/@keyframes/);
    expect(fuera).not.toMatch(/animation\s*:/);
  });

  it('dentro hay animaciones de verdad (el bloque no está vacío)', () => {
    expect(bloqueSinPreferencia()).toMatch(/@keyframes/);
    expect(bloqueSinPreferencia()).toMatch(/animation\s*:/);
  });

  it('no deja `will-change` permanente (cuesta memoria en cada elemento)', () => {
    expect(css).not.toMatch(/will-change/);
  });
});
