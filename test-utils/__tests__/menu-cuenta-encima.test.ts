import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// El menú de la cuenta cuelga de la barra de arriba. En react-native-web cada View es su propio contexto de apilamiento (z-index 0), así que una barra SIN `zIndex` queda al mismo nivel que el contenido que le sigue y ese
// contenido (que se pinta después) cubre el menú y se queda con sus clics: «Perfil», «Notificaciones», «Configuración» y «Cerrar sesión» no respondían. Medido en el navegador: el clic caía en la página, no en el menú.
// Esta guarda no sustituye mirarlo en el navegador: solo impide que alguien quite el `zIndex` de una barra con cuenta sin darse cuenta.

const DIR = join(__dirname, '..', '..', 'src', 'components', 'web');
const ARCHIVOS = readdirSync(DIR).filter((f) => f.endsWith('.tsx'));

describe('las barras que llevan el menú de la cuenta van por encima del contenido', () => {
  const conCuenta = ARCHIVOS.filter((f) => readFileSync(join(DIR, f), 'utf8').includes('<CuentaWeb'));

  it('hay barras con cuenta (si esto da 0, la guarda dejó de mirar lo que debe)', () => {
    expect(conCuenta.length).toBeGreaterThanOrEqual(3);
  });

  it.each(conCuenta)('%s tiene un zIndex en su estilo', (archivo) => {
    expect(readFileSync(join(DIR, archivo), 'utf8')).toMatch(/zIndex:\s*\d+/);
  });

  it('el marco de sesión, que aloja la barra, también', () => {
    expect(readFileSync(join(DIR, 'MarcoSesionWeb.tsx'), 'utf8')).toMatch(/zIndex:\s*\d+/);
  });
});
