import { act, fireEvent, render, screen } from '@testing-library/react-native';

// Cuervo 360 · Inicio reúne los módulos.
//
// Roomies dejó de ser una pestaña (el menú es de cinco accesos) y vive dentro de Inicio, detrás de
// un selector. Lo que se fija: Depas es lo que se ve al entrar, el selector cambia de módulo,
// ningún módulo deja a la persona sin forma de volver, y el módulo elegido desde fuera (Mi perfil)
// se respeta.

const mockSugerencias = jest.fn();
const mockNuevas = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}));
jest.mock('@/hooks/queries/usePublicaciones', () => ({
  useSugerencias: (...a: unknown[]) => mockSugerencias(...a),
  useNuevas: (...a: unknown[]) => mockNuevas(...a),
}));
jest.mock('@/hooks/use-fotos-firmadas', () => ({ useFotosFirmadas: () => ({ urls: new Map(), fallo: null }) }));
jest.mock('@/store/usePerfilStore', () => ({
  usePerfilStore: (sel?: (s: unknown) => unknown) => {
    const estado = { perfil: { id: 'u1', presupuesto_max: 4000, distancia_max_km: 10, universidad: 'UTVT' }, error: null, cargarPerfil: jest.fn() };
    return sel ? sel(estado) : estado;
  },
}));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }),
}));
jest.mock('@/lib/tacto', () => ({ toque: jest.fn(), sello: jest.fn() }));
// El corazón de Favoritos tiene sus propias pruebas (necesita un cliente de consultas); aquí solo importa la lista.
jest.mock('@/components/BotonFavorito', () => ({ BotonFavorito: () => null }));
jest.mock('@/lib/registro', () => ({ aviso: jest.fn(), fallo: jest.fn() }));
// La vista de Roomies tiene sus propias pruebas; aquí solo importa que Inicio la monte y le pase el selector.
jest.mock('@/components/vistas/VistaRoomies', () => ({
  VistaRoomies: ({ selector }: { selector?: React.ReactNode }) => {
    const { Text, View } = require('react-native');
    return <View>{selector}<Text>VISTA ROOMIES</Text></View>;
  },
}));

// La vista de Servicios tiene sus propias pruebas; aquí solo importa que Inicio la monte y le pase el selector.
jest.mock('@/components/vistas/VistaServicios', () => ({
  VistaServicios: ({ selector }: { selector?: React.ReactNode }) => {
    const { Text, View } = require('react-native');
    return <View>{selector}<Text>VISTA SERVICIOS</Text></View>;
  },
}));

import { useModuloStore } from '@/store/useModuloStore';
import InicioScreen from '../inicio';

beforeEach(() => {
  jest.clearAllMocks();
  useModuloStore.setState({ modulo: 'depas' });
  mockSugerencias.mockReturnValue({
    datos: [], conAfinidad: 0, total: 0, cargando: false, refrescando: false, fallo: null, refrescar: jest.fn(), emitido: null,
  });
  mockNuevas.mockReturnValue({ datos: [], cargando: false });
});

test('al entrar se ve Depas, con el selector arriba', async () => {
  await render(<InicioScreen />);
  expect(screen.getByRole('tab', { name: 'Depas' }).props.accessibilityState?.selected).toBe(true);
  expect(await screen.findByText('Sugerencias')).toBeTruthy();
  expect(screen.queryByText('VISTA ROOMIES')).toBeNull();
});

test('el selector lleva a Roomies', async () => {
  await render(<InicioScreen />);
  await fireEvent.press(screen.getByRole('tab', { name: 'Roomies' }));
  expect(await screen.findByText('VISTA ROOMIES')).toBeTruthy();
  expect(screen.queryByText('Sugerencias')).toBeNull();
});

// Una vista sin selector sería una pestaña sin salida.
test('desde Roomies el selector sigue ahí y permite volver a Depas', async () => {
  await render(<InicioScreen />);
  await fireEvent.press(screen.getByRole('tab', { name: 'Roomies' }));
  expect(screen.getByRole('tab', { name: 'Roomies' }).props.accessibilityState?.selected).toBe(true);
  await fireEvent.press(screen.getByRole('tab', { name: 'Depas' }));
  expect(await screen.findByText('Sugerencias')).toBeTruthy();
});

test('si otra pantalla eligió Roomies (Mi perfil), Inicio abre en Roomies', async () => {
  await act(async () => useModuloStore.setState({ modulo: 'roomies' }));
  await render(<InicioScreen />);
  expect(await screen.findByText('VISTA ROOMIES')).toBeTruthy();
});

test('el selector lleva a Servicios y desde ahí se puede volver a Depas', async () => {
  await render(<InicioScreen />);
  await fireEvent.press(screen.getByRole('tab', { name: 'Servicios' }));
  expect(await screen.findByText('VISTA SERVICIOS')).toBeTruthy();
  expect(screen.queryByText('Sugerencias')).toBeNull();
  await fireEvent.press(screen.getByRole('tab', { name: 'Depas' }));
  expect(await screen.findByText('Sugerencias')).toBeTruthy();
});
