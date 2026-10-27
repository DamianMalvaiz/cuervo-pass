import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

// El marco de las pantallas de DENTRO en la web (favoritos, chats, perfil, panel…): el encabezado de la web arriba, el contenido en medio y, solo en teléfono, la barra inferior con la página actual marcada.
// Sin esto esas pantallas (hechas para el teléfono) salían con su barra de pestañas de app en medio de una pantalla de escritorio.

const mockPantalla = { ancho: 1440 };
jest.mock('@/hooks/use-tamano-pantalla', () => ({ useTamanoPantalla: () => ({ ancho: mockPantalla.ancho, alto: 900, clase: 'amplia' }) }));
const mockRuta = { valor: '/chats' };
jest.mock('expo-router', () => ({ router: { push: jest.fn() }, usePathname: () => mockRuta.valor }));
const mockEstado = { session: { user: { id: 'u1', email: 'a@b.mx', user_metadata: {} } } as unknown };
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: (sel: (s: typeof mockEstado) => unknown) => sel(mockEstado) }));
jest.mock('@/hooks/queries/usePerfilActivo', () => ({ usePerfilActivo: () => ({ perfil: 'estudiante' }) }));
jest.mock('@/hooks/queries/useRoles', () => ({ useMisRoles: () => ({ roles: [] }) }));

import { MarcoSesionWeb } from '../MarcoSesionWeb';

beforeEach(() => {
  mockPantalla.ancho = 1440;
  mockRuta.valor = '/chats';
});

describe('MarcoSesionWeb', () => {
  it('en escritorio: el encabezado de la web y el contenido, sin barra inferior', async () => {
    await render(<MarcoSesionWeb><Text>CONTENIDO</Text></MarcoSesionWeb>);
    expect(screen.getByLabelText('Ir al inicio')).toBeTruthy();
    expect(screen.getByLabelText('Menú de la cuenta')).toBeTruthy();
    expect(screen.getByText('CONTENIDO')).toBeTruthy();
    expect(screen.queryByLabelText('Navegación principal')).toBeNull();
  });

  it('en teléfono: la barra inferior, con la página actual marcada', async () => {
    mockPantalla.ancho = 390;
    await render(<MarcoSesionWeb><Text>CONTENIDO</Text></MarcoSesionWeb>);
    expect(screen.getByLabelText('Navegación principal')).toBeTruthy();
    expect(screen.getByLabelText('Chats').props['aria-current']).toBe('page');
  });

  it('el perfil se anuncia como «Mi cuenta» en la barra', async () => {
    mockPantalla.ancho = 390;
    mockRuta.valor = '/perfil';
    await render(<MarcoSesionWeb><Text>CONTENIDO</Text></MarcoSesionWeb>);
    expect(screen.getByLabelText('Mi cuenta').props['aria-current']).toBe('page');
  });
});
