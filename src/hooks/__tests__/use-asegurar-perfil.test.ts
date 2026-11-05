import { renderHook } from '@testing-library/react-native';

// El perfil lo cargaban solo Inicio y las pantallas de perfil. Al recargar la web en `/perfil/preferencias` (o entrar por un enlace) esas pantallas no se montaban: Preferencias
// se quedaba en «Consultando tu ficha» para siempre, y Personalización decía «Desactivada» aunque estuviera activa. El hook carga el perfil si la pantalla lo necesita y no está.

const mockCargarPerfil = jest.fn();
let mockSesion: { user: { id: string } } | null = { user: { id: 'u1' } };
let mockEstado: { perfil: unknown; cargando: boolean; cargarPerfil: jest.Mock } = { perfil: null, cargando: false, cargarPerfil: mockCargarPerfil };

jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: mockSesion }),
}));
jest.mock('@/store/usePerfilStore', () => ({
  usePerfilStore: (sel: (s: unknown) => unknown) => sel(mockEstado),
}));

import { useAsegurarMiPerfil } from '../use-asegurar-perfil';

beforeEach(() => {
  jest.clearAllMocks();
  mockSesion = { user: { id: 'u1' } };
  mockEstado = { perfil: null, cargando: false, cargarPerfil: mockCargarPerfil };
});

test('sin perfil cargado, lo pide con el id de la sesión', async () => {
  await renderHook(() => useAsegurarMiPerfil());
  expect(mockCargarPerfil).toHaveBeenCalledWith('u1');
});

test('con el perfil ya cargado no lo vuelve a pedir', async () => {
  mockEstado = { ...mockEstado, perfil: { id: 'u1' } };
  await renderHook(() => useAsegurarMiPerfil());
  expect(mockCargarPerfil).not.toHaveBeenCalled();
});

test('si ya se está cargando, no lanza otra carga', async () => {
  mockEstado = { ...mockEstado, cargando: true };
  await renderHook(() => useAsegurarMiPerfil());
  expect(mockCargarPerfil).not.toHaveBeenCalled();
});

test('sin sesión no pide nada', async () => {
  mockSesion = null;
  await renderHook(() => useAsegurarMiPerfil());
  expect(mockCargarPerfil).not.toHaveBeenCalled();
});
