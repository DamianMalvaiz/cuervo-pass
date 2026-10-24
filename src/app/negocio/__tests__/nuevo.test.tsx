import { render, screen } from '@testing-library/react-native';

// Publicar un negocio exige la verificación hecha: la puerta de «Nuevo negocio» es la misma guarda que la pestaña «Publicar». Antes la pantalla se podía abrir
// con un enlace directo y solo la base la rechazaba al guardar, después de que la persona llenara todo el formulario.

const mockRoles = jest.fn();
jest.mock('@/hooks/queries/useRoles', () => ({ useMisRoles: (...a: unknown[]) => mockRoles(...a) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }),
}));
jest.mock('@/components/FormularioNegocio', () => ({
  FormularioNegocio: () => { const { Text } = require('react-native'); return <Text>FORMULARIO DE NEGOCIO</Text>; },
}));

import NuevoNegocioScreen from '../nuevo';

const rol = (estado: string) => ({ usuario_id: 'u1', rol: 'comerciante', estado, origen: 'solicitud', desde: 'x' });
const con = (...roles: unknown[]) => mockRoles.mockReturnValue({ roles, cargando: false, fallo: false, reintentar: jest.fn() });

test('sin verificar no se ve el formulario', async () => {
  con(rol('sin_verificar'));
  await render(<NuevoNegocioScreen />);
  expect(screen.queryByText('FORMULARIO DE NEGOCIO')).toBeNull();
  expect(screen.getByText(/Verifica tu identidad para publicar/)).toBeTruthy();
});

test('con la función aprobada sí', async () => {
  con(rol('aprobado'));
  await render(<NuevoNegocioScreen />);
  expect(screen.getByText('FORMULARIO DE NEGOCIO')).toBeTruthy();
});
