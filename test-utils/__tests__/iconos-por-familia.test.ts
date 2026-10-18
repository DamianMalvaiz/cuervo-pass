import { execSync } from 'node:child_process';
import { join } from 'node:path';

// `import { Ionicons } from '@expo/vector-icons'` trae TODAS las familias de iconos y Metro no las poda: medido el 18/10/2026, 6.09 MB de fuentes (de las cuales la app usa
// una, Ionicons) dentro de cada instalación. Importar por familia (`@expo/vector-icons/Ionicons`) deja solo la que se usa.
test('nada en src/ importa el paquete entero de iconos', () => {
  const raiz = join(__dirname, '..', '..');
  let salida = '';
  try {
    salida = execSync(`grep -rnE "from '@expo/vector-icons'" src --include=*.ts --include=*.tsx`, { cwd: raiz, encoding: 'utf8' });
  } catch {
    salida = ''; // grep sale con 1 cuando no encuentra nada: es lo que se quiere
  }
  expect(salida).toBe('');
});
