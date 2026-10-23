import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';

import { clienteDePrueba } from '@pruebas/consultas';

// Entrar a /admin sin sesión (el caso normal en la web: se teclea la dirección) NO puede quedarse en «Cargando…» para siempre. Con la sesión aún
// leyéndose se espera; sin sesión se manda al login y se pide volver al panel; con sesión de alguien que no es admin, «Sin acceso».

const mockRedirect = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  Redirect: (props: unknown) => { mockRedirect(props); return null; },
}));
const mockCargar = jest.fn();
jest.mock('@/lib/supabase', () => ({ supabaseConfigurado: true, supabase: {} }));
let mockSesion: { session: { user: { id: string } } | null; cargando: boolean; cargarSesionInicial?: () => void } = { session: null, cargando: false };
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel(mockSesion) }));
jest.mock('@/hooks/queries/useRoles', () => ({
  // Como el real: sin id, la consulta está deshabilitada y «cargando» no termina nunca.
  useMisRoles: (id?: string) => ({ roles: id ? [{ rol: 'comerciante', estado: 'aprobado' }] : [], cargando: !id, fallo: false, reintentar: jest.fn() }),
}));
jest.mock('@/services/admin.service', () => ({
  obtenerResumen: jest.fn(), fijarModoDemo: jest.fn(), listarVerificaciones: jest.fn(), listarModeracion: jest.fn(), listarErrores: jest.fn(),
}));
jest.mock('@/lib/toast', () => ({ toast: { error: jest.fn(), exito: jest.fn(), info: jest.fn() } }));

import Errores from '../errores';
import Inicio from '../index';
import Moderacion from '../moderacion';
import Verificaciones from '../verificaciones';

const pintar = (Pantalla: () => React.JSX.Element) =>
  render(<QueryClientProvider client={clienteDePrueba({ queries: { retry: false } })}><Pantalla /></QueryClientProvider>);

const sesion = (sobre: { session?: { user: { id: string } } | null; cargando?: boolean } = {}) => ({ session: null, cargando: false, cargarSesionInicial: mockCargar, ...sobre });

beforeEach(() => { jest.clearAllMocks(); mockSesion = sesion(); });

describe.each([
  ['inicio', Inicio, '/admin'],
  ['verificaciones', Verificaciones, '/admin/verificaciones'],
  ['moderación', Moderacion, '/admin/moderacion'],
  ['errores', Errores, '/admin/errores'],
])('/admin · %s', (_nombre, Pantalla, ruta) => {
  test('sin sesión manda al login y pide volver a esta ruta', async () => {
    await pintar(Pantalla as () => React.JSX.Element);
    expect(mockRedirect).toHaveBeenCalledWith(expect.objectContaining({ href: { pathname: '/(auth)/login', params: { volverA: ruta } } }));
  });

  // Un enlace directo a /admin no pasa por la pantalla de inicio, que era la única que leía la sesión guardada: sin esto el panel esperaría para siempre.
  test('lee la sesión guardada al abrirse (no depende de haber pasado por la pantalla de inicio)', async () => {
    mockSesion = sesion({ cargando: true });
    await pintar(Pantalla as () => React.JSX.Element);
    expect(mockCargar).toHaveBeenCalled();
  });

  test('mientras la sesión se lee, espera: no redirige todavía', async () => {
    mockSesion = sesion({ cargando: true });
    await pintar(Pantalla as () => React.JSX.Element);
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(screen.getByText('Cargando…')).toBeTruthy();
  });

  test('con sesión de alguien que no es admin: «Sin acceso», sin redirigir', async () => {
    mockSesion = sesion({ session: { user: { id: 'u1' } } });
    await pintar(Pantalla as () => React.JSX.Element);
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(screen.getByText(/No tienes acceso/)).toBeTruthy();
  });
});
