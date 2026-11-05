import { render, screen } from '@testing-library/react-native';

// La ficha de un negocio CON cuenta: la dirección exacta y «Cómo llegar» reemplazan a la invitación a entrar, y no hay barra de «Escribir» (un negocio no recibe mensajes).

jest.mock('expo-router/head', () => ({ __esModule: true, default: () => null }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), canGoBack: () => true, back: jest.fn() }, useLocalSearchParams: () => ({ id: 'n1' }) }));
const mockPantalla = { ancho: 1440 };
jest.mock('@/hooks/use-tamano-pantalla', () => ({ useTamanoPantalla: () => ({ ancho: mockPantalla.ancho, alto: 900, clase: 'amplia' }) }));
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1', email: 'a@b.mx', user_metadata: {} } }, cerrarSesion: jest.fn() }) }));
jest.mock('@/hooks/queries/useExplorar', () => ({
  useNegocioPublico: () => ({ negocio: { id: 'n1', nombre: 'Café La Parada', descripcion: null, zona: 'Centro, Lerma, México', num_fotos: 0, calificacion: null, num_resenas: null, abierto_ahora: true }, cargando: false, fallo: false, reintentar: jest.fn() }),
  useProductosPublicos: () => ({ productos: [], cargando: false, fallo: false, reintentar: jest.fn() }),
  useHorarioPublico: () => ({ horario: [], cargando: false, fallo: false, reintentar: jest.fn() }),
  useFotosPublicas: () => ({ fotos: [], cargando: false, fallo: false }),
}));
jest.mock('@/hooks/queries/usePerfilActivo', () => ({ usePerfilActivo: () => ({ perfil: 'estudiante' }) }));
jest.mock('@/hooks/queries/useRoles', () => ({ useMisRoles: () => ({ roles: [] }) }));
jest.mock('@/hooks/use-guardado', () => ({ useGuardado: () => ({ guardado: false, cargando: false, alternar: jest.fn() }) }));
jest.mock('@/components/web/FichaConCuentaWeb', () => ({ UbicacionNegocioConCuentaWeb: () => jest.requireActual('react').createElement(jest.requireActual('react-native').Text, null, 'UBICACION CON CUENTA') }));

import FichaNegocio from '../servicios/[id]';

beforeEach(() => {
  mockPantalla.ancho = 1440;
});

test('con cuenta: la dirección exacta en lugar de la invitación a entrar', async () => {
  await render(<FichaNegocio />);
  expect(screen.getByText('UBICACION CON CUENTA')).toBeTruthy();
  expect(screen.queryByLabelText('Entrar para ver la dirección exacta')).toBeNull();
  expect(screen.queryByLabelText('Iniciar sesión para escribir')).toBeNull();
});

test('en teléfono con cuenta no hay barra de «Escribir» (un negocio no recibe mensajes)', async () => {
  mockPantalla.ancho = 390;
  await render(<FichaNegocio />);
  expect(screen.queryByLabelText('Contactar')).toBeNull();
  expect(screen.getByText('UBICACION CON CUENTA')).toBeTruthy();
});
