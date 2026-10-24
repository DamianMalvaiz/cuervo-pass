import { readFileSync } from 'node:fs';

// El hook `useRestaurarSesion` solo sirve si el layout RAÍZ lo usa: es lo único que se monta en TODAS las rutas. Y tiene que llamarse antes del `return null` que espera a las
// tipografías: un hook después de un `return` condicional rompe las reglas de React (cambia el orden de los hooks entre renders).

const layout = readFileSync('src/app/_layout.tsx', 'utf8');

test('el layout raíz importa y llama a useRestaurarSesion', () => {
  expect(layout).toMatch(/import \{ useRestaurarSesion \} from '@\/hooks\/use-restaurar-sesion'/);
  expect(layout).toContain('useRestaurarSesion();');
});

test('se llama ANTES del return que espera a las tipografías', () => {
  const iLlamada = layout.indexOf('useRestaurarSesion();');
  const iEspera = layout.indexOf('if (!fuentesListas && !errorFuentes) return null;');
  expect(iLlamada).toBeGreaterThan(-1);
  expect(iEspera).toBeGreaterThan(-1);
  expect(iLlamada).toBeLessThan(iEspera);
});
