import { fireEvent, render, screen } from '@testing-library/react-native';

// El renglón del panel en el perfil. Solo aparece para un admin APROBADO; es comodidad (el servidor vuelve a comprobarlo).

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
let mockAdmin = { admin: true, cargando: false };
jest.mock('@/hooks/queries/useAdmin', () => ({ useEsAdmin: () => mockAdmin }));

import { EntradaAdmin } from '../EntradaAdmin';

beforeEach(() => {
  jest.clearAllMocks();
  mockAdmin = { admin: true, cargando: false };
});

test('un admin ve el renglón y abre el panel', async () => {
  await render(<EntradaAdmin />);
  await fireEvent.press(screen.getByLabelText(/Panel de administración/));
  expect(mockPush).toHaveBeenCalledWith('/admin');
});

test('quien no es admin no ve nada', async () => {
  mockAdmin = { admin: false, cargando: false };
  await render(<EntradaAdmin />);
  expect(screen.queryByText(/Panel de administración/)).toBeNull();
});

test('mientras se sabe, tampoco se enseña', async () => {
  mockAdmin = { admin: false, cargando: true };
  await render(<EntradaAdmin />);
  expect(screen.queryByText(/Panel de administración/)).toBeNull();
});
