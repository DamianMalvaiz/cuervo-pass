import { render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

// `/perfil` en la web: quien busca ve el perfil de página; un vendedor sigue viendo el suyo; y en la app (teléfono) nada cambia.

const mockPerfilActivo = { valor: 'estudiante' as 'estudiante' | 'vendedor' };
jest.mock('@/hooks/queries/usePerfilActivo', () => ({ usePerfilActivo: () => ({ perfil: mockPerfilActivo.valor, cambiar: jest.fn() }) }));
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }) }));
jest.mock('@/store/usePerfilStore', () => ({ usePerfilStore: () => ({ cargarPerfil: jest.fn(), perfil: null, cargando: false, error: null }) }));
const texto = (t: string) => jest.requireActual('react').createElement(jest.requireActual('react-native').Text, null, t);
jest.mock('@/components/web/PerfilWeb', () => ({ PerfilWeb: () => texto('PERFIL WEB') }));
jest.mock('@/components/perfil/PerfilVendedor', () => ({ PerfilVendedor: () => texto('PERFIL VENDEDOR') }));
jest.mock('@/components/perfil/TarjetaIdentidad', () => ({ TarjetaIdentidad: () => texto('IDENTIDAD APP') }));
jest.mock('@/components/perfil/EncabezadoPerfil', () => ({ EncabezadoPerfil: () => null }));
jest.mock('@/hooks/queries/useRoomies', () => ({ useMiRoomie: () => ({ miRoomie: null }) }));
jest.mock('@/hooks/queries/usePublicaciones', () => ({ useMisPublicaciones: () => ({ datos: [], cargando: false }) }));
jest.mock('@/hooks/queries/useRoles', () => ({ useMisRoles: () => ({ roles: [], fallo: false, reintentar: jest.fn() }) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));

import PerfilScreen from '../perfil';

const plataforma = Platform.OS;
afterEach(() => {
  Platform.OS = plataforma;
  mockPerfilActivo.valor = 'estudiante';
});

test('en la web, quien busca ve el perfil de página', async () => {
  Platform.OS = 'web';
  await render(<PerfilScreen />);
  expect(screen.getByText('PERFIL WEB')).toBeTruthy();
  expect(screen.queryByText('IDENTIDAD APP')).toBeNull();
});

test('en la web, un vendedor sigue con el suyo', async () => {
  Platform.OS = 'web';
  mockPerfilActivo.valor = 'vendedor';
  await render(<PerfilScreen />);
  expect(screen.getByText('PERFIL VENDEDOR')).toBeTruthy();
  expect(screen.queryByText('PERFIL WEB')).toBeNull();
});

test('en la app el perfil de siempre', async () => {
  Platform.OS = 'ios';
  await render(<PerfilScreen />);
  expect(screen.queryByText('PERFIL WEB')).toBeNull();
  expect(screen.getByText('IDENTIDAD APP')).toBeTruthy();
});
