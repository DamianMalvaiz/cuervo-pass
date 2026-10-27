// Al terminar la sesión (cerrarla o borrar la cuenta) se vuelve al login VACIANDO el historial. `router.replace` solo cambia la pantalla de arriba: debajo quedaban
// Configuración y las pestañas, y «atrás» las devolvía, vacías pero visibles (detectado el 24/10/2026 al borrar una cuenta desde el teléfono).

const orden: string[] = [];
const mockCanDismiss = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    canDismiss: (...a: unknown[]) => mockCanDismiss(...a),
    dismissAll: () => orden.push('dismissAll'),
    replace: (...a: unknown[]) => orden.push(`replace:${String(a[0])}`),
  },
}));

import { Platform } from 'react-native';

import { irAlLogin } from '../navegacion';

const plataforma = Platform.OS;
afterEach(() => {
  Platform.OS = plataforma;
});

beforeEach(() => {
  orden.length = 0;
  mockCanDismiss.mockReset();
});

test('con historial debajo: lo vacía PRIMERO y después abre el login', () => {
  mockCanDismiss.mockReturnValue(true);
  irAlLogin();
  expect(orden).toEqual(['dismissAll', 'replace:/(auth)/login']);
});

test('sin historial debajo: solo abre el login (no hay nada que vaciar)', () => {
  mockCanDismiss.mockReturnValue(false);
  irAlLogin();
  expect(orden).toEqual(['replace:/(auth)/login']);
});

// En la web la persona que sale cae en la portada pública (que se explora sin cuenta), no en un login suelto.
test('en la web: vacía el historial y vuelve a la portada', () => {
  Platform.OS = 'web';
  mockCanDismiss.mockReturnValue(true);
  irAlLogin();
  expect(orden).toEqual(['dismissAll', 'replace:/']);
});
