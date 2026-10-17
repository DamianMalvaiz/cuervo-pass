import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

// Cuervo 360 · «Publicar» solo con una función de vendedor aprobada.
//
// La pestaña se oculta, pero una ruta oculta sigue siendo alcanzable por un enlace directo o por
// una fila de otra pantalla; por eso la propia pantalla se guarda. Cuatro estados, y los cuatro
// distintos (END-11): comprobando, falló la lectura, falta la función, y puede.
//
// OJO con lo que NO es: esta guarda es de INTERFAZ. La regla que de verdad impide publicar tiene
// que vivir en la base, y llega con la verificación de vendedor.

const mockRoles = jest.fn();
jest.mock('@/hooks/queries/useRoles', () => ({ useMisRoles: (...a: unknown[]) => mockRoles(...a) }));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }),
}));

import { GuardaPublicar } from '../GuardaPublicar';

const rol = (r: string, estado: string) => ({ usuario_id: 'u1', rol: r, estado, origen: 'solicitud', desde: 'x' });
const estado = (extra: Record<string, unknown>) => ({
  roles: [], cargando: false, fallo: false, reintentar: jest.fn(), ...extra,
});

const pintar = () =>
  render(<GuardaPublicar><Text>CONTENIDO PROTEGIDO</Text></GuardaPublicar>);

beforeEach(() => {
  jest.clearAllMocks();
  mockRoles.mockReturnValue(estado({}));
});

test('con una función aprobada muestra el contenido', async () => {
  mockRoles.mockReturnValue(estado({ roles: [rol('arrendador', 'aprobado')] }));
  await pintar();
  expect(screen.getByText('CONTENIDO PROTEGIDO')).toBeTruthy();
});

test('sin función aprobada NO muestra el contenido y explica qué falta', async () => {
  await pintar();
  expect(screen.queryByText('CONTENIDO PROTEGIDO')).toBeNull();
  expect(screen.getByText(/función de arrendador o comerciante aprobada/i)).toBeTruthy();
});

test('una función sin verificar tampoco abre la puerta', async () => {
  mockRoles.mockReturnValue(estado({ roles: [rol('comerciante', 'sin_verificar')] }));
  await pintar();
  expect(screen.queryByText('CONTENIDO PROTEGIDO')).toBeNull();
});

test('el botón lleva a Mi perfil, donde se agrega la función', async () => {
  await pintar();
  await fireEvent.press(screen.getByLabelText('Ir a Mis funciones'));
  expect(mockPush).toHaveBeenCalledWith('/(tabs)/perfil');
});

// END-11: mientras se comprueba no se afirma «no puedes», y tampoco se muestra el contenido.
test('mientras comprueba no muestra el contenido ni dice que falte la función', async () => {
  mockRoles.mockReturnValue(estado({ cargando: true }));
  await pintar();
  expect(screen.queryByText('CONTENIDO PROTEGIDO')).toBeNull();
  expect(screen.queryByText(/función de arrendador o comerciante aprobada/i)).toBeNull();
});

test('si falló la lectura lo dice como fallo, NO como falta de función, y cierra el paso', async () => {
  const reintentar = jest.fn();
  mockRoles.mockReturnValue(estado({ fallo: true, reintentar }));
  await pintar();
  expect(screen.queryByText('CONTENIDO PROTEGIDO')).toBeNull();
  expect(screen.getByText(/No pudimos comprobar tu función/i)).toBeTruthy();
  expect(screen.queryByText(/función de arrendador o comerciante aprobada/i)).toBeNull();
  await fireEvent.press(screen.getByLabelText('Reintentar'));
  expect(reintentar).toHaveBeenCalledTimes(1);
});
