import { render, screen } from '@testing-library/react-native';

// `/roomies` con cuenta: la página de personas reales reemplaza al teaser (que habla de ejemplos y de «iniciar sesión»); sin cuenta, el teaser sigue como estaba.

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('expo-router/head', () => ({ __esModule: true, default: () => null }));
jest.mock('@/hooks/use-tamano-pantalla', () => ({ useTamanoPantalla: () => ({ ancho: 1280, alto: 900, clase: 'amplia' }) }));
const mockSesion = { valor: { user: { id: 'u1' } } as null | object };
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: mockSesion.valor, cerrarSesion: jest.fn() }) }));
jest.mock('@/components/web/RoomiesConCuentaWeb', () => ({ RoomiesConCuentaWeb: () => jest.requireActual('react').createElement(jest.requireActual('react-native').Text, null, 'ROOMIES CON CUENTA') }));

import Roomies from '../roomies';

test('con cuenta: la página de personas reales, sin el teaser de ejemplos', async () => {
  mockSesion.valor = { user: { id: 'u1' } };
  await render(<Roomies />);
  expect(screen.getByText('ROOMIES CON CUENTA')).toBeTruthy();
  expect(screen.queryByText(/se ven al iniciar sesión/)).toBeNull();
});

test('sin cuenta: el teaser de siempre', async () => {
  mockSesion.valor = null;
  await render(<Roomies />);
  expect(screen.queryByText('ROOMIES CON CUENTA')).toBeNull();
  expect(screen.getByText(/se ven al iniciar sesión/)).toBeTruthy();
});
