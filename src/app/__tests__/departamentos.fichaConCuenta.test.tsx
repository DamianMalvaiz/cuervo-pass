import { render, screen } from '@testing-library/react-native';

// La ficha de una vivienda CON cuenta: lo que antes pedía entrar ahora funciona (contacto, dirección exacta, ajuste) y no queda ningún texto que mande a iniciar sesión estando ya dentro.

jest.mock('expo-router/head', () => ({ __esModule: true, default: () => null }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), canGoBack: () => true, back: jest.fn() }, useLocalSearchParams: () => ({ id: 'p1' }) }));
jest.mock('@/hooks/use-tamano-pantalla', () => ({ useTamanoPantalla: () => ({ ancho: 1440, alto: 900, clase: 'amplia' }) }));
const mockSesion = { valor: { user: { id: 'u1', email: 'a@b.mx', user_metadata: {} } } as null | object };
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: mockSesion.valor, cerrarSesion: jest.fn() }) }));
jest.mock('@/hooks/queries/useExplorar', () => ({
  usePublicacionPublica: () => ({
    publicacion: { id: 'p1', titulo_publico: 'Cuarto en Santa María', tipo: 'cuarto', precio_renta: 2900, recamaras: 1, amueblado: true, permite_mascotas: false, servicios_incluidos: false, zona: 'Santa María, Lerma, México', num_fotos: 0, destacado: false, calificacion: null, num_resenas: null },
    cargando: false, fallo: false, reintentar: jest.fn(),
  }),
  useFotosPublicas: () => ({ fotos: [], cargando: false, fallo: false }),
}));
jest.mock('@/hooks/queries/usePerfilActivo', () => ({ usePerfilActivo: () => ({ perfil: 'estudiante' }) }));
jest.mock('@/hooks/queries/useRoles', () => ({ useMisRoles: () => ({ roles: [] }) }));
jest.mock('@/hooks/use-guardado', () => ({ useGuardado: () => ({ guardado: false, cargando: false, alternar: jest.fn() }) }));
const texto = (t: string) => jest.requireActual('react').createElement(jest.requireActual('react-native').Text, null, t);
jest.mock('@/components/web/ContactoWeb', () => ({ ContactoWeb: () => texto('CONTACTO CON CUENTA') }));
jest.mock('@/components/web/FichaConCuentaWeb', () => ({
  AjusteConCuentaWeb: () => texto('AJUSTE CON CUENTA'),
  DescripcionConCuentaWeb: () => texto('DESCRIPCION CON CUENTA'),
  DireccionConCuentaWeb: () => texto('DIRECCION CON CUENTA'),
}));

import FichaPublica from '../departamentos/[id]';

beforeEach(() => {
  mockSesion.valor = { user: { id: 'u1', email: 'a@b.mx', user_metadata: {} } };
});

test('con cuenta: contacto, dirección, descripción y ajuste reales', async () => {
  await render(<FichaPublica />);
  expect(screen.getByText('CONTACTO CON CUENTA')).toBeTruthy();
  expect(screen.getByText('DIRECCION CON CUENTA')).toBeTruthy();
  expect(screen.getByText('DESCRIPCION CON CUENTA')).toBeTruthy();
  expect(screen.getByText('AJUSTE CON CUENTA')).toBeTruthy();
});

test('con cuenta no queda ningún texto que mande a iniciar sesión', async () => {
  await render(<FichaPublica />);
  expect(screen.queryByLabelText('Iniciar sesión para escribir')).toBeNull();
  expect(screen.queryByText(/Entra para ver tu ajuste/)).toBeNull();
  expect(screen.queryByText(/se muestra al iniciar sesión/)).toBeNull();
  expect(screen.queryByLabelText('Crear cuenta')).toBeNull();
});

test('sin cuenta sigue como siempre: pide entrar y no monta lo de con cuenta', async () => {
  mockSesion.valor = null;
  await render(<FichaPublica />);
  expect(screen.getByLabelText('Iniciar sesión para escribir')).toBeTruthy();
  expect(screen.queryByText('CONTACTO CON CUENTA')).toBeNull();
  expect(screen.queryByText('DIRECCION CON CUENTA')).toBeNull();
});
