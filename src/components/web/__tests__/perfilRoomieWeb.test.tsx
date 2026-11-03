import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// Perfil de una persona en la web: sin cuenta pide entrar; falló ≠ no existe ≠ cargando; la afinidad va en palabras y sin datos dice «Sin datos para comparar» (no «baja»);
// no enseña presupuesto ni universidad; el propio perfil y las cuentas restringidas no ofrecen chatear ni reportar; el reporte se hace en la página.

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) }, useLocalSearchParams: () => ({ usuarioId: 'u2' }) }));
jest.mock('@/components/web/PaginaSesionWeb', () => ({ PaginaSesionWeb: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/components/web/EsqueletoWeb', () => {
  const { Text } = require('react-native');
  return { EsqueletoFilasWeb: () => <Text>cargando-esqueleto</Text> };
});
const mockSesion = { id: 'u1' as string | null };
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: mockSesion.id ? { user: { id: mockSesion.id } } : null }) }));
const mockPerfil = { perfil: null as unknown, cargando: false, fallo: false, reintentar: jest.fn() };
const mockAfin = { afinidad: null as unknown };
jest.mock('@/hooks/queries/usePerfilPublico', () => ({ usePerfilPublico: () => mockPerfil, useAfinidadRoomie: () => mockAfin }));
const mockRestringida = { v: false };
jest.mock('@/hooks/queries/useCuentaRestringida', () => ({ useCuentaRestringida: () => mockRestringida.v }));
jest.mock('@/hooks/use-fotos-firmadas', () => ({ useFotosFirmadas: () => ({ urls: new Map(), fallo: null }) }));
const mockChat = jest.fn();
jest.mock('@/lib/abrirChat', () => ({ abrirChatCon: (...a: unknown[]) => mockChat(...a) }));
const mockReportar = jest.fn();
jest.mock('@/services/usuarios.service', () => ({ reportarUsuario: (...a: unknown[]) => mockReportar(...a) }));

import { PerfilRoomieWeb } from '../PerfilRoomieWeb';

const PERSONA = {
  id: 'u2', nombre_completo: 'Ana Prueba', nombre_usuario: 'ana', foto_url: null, biografia: 'Estudio mecatrónica.', mascotas: true, fuma: false,
  nivel_ruido: 'bajo', horario_predominante: 'nocturno', correo_verificado: true,
};
beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockSesion, { id: 'u1' });
  Object.assign(mockPerfil, { perfil: PERSONA, cargando: false, fallo: false });
  Object.assign(mockAfin, { afinidad: { similitud: 0.8, nivel: 2 } });
  mockRestringida.v = false;
});

it('sin cuenta pide iniciar sesión', async () => {
  Object.assign(mockSesion, { id: null });
  await render(<PerfilRoomieWeb />);
  await fireEvent.press(screen.getByLabelText('Iniciar sesión para ver el perfil'));
  expect(mockPush).toHaveBeenCalledWith('/(auth)/login');
});

it('falló ≠ no se encontró ≠ cargando', async () => {
  Object.assign(mockPerfil, { perfil: null, fallo: true });
  const r = await render(<PerfilRoomieWeb />);
  expect(screen.getByText('No pudimos cargar este perfil')).toBeTruthy();
  expect(screen.queryByText('No se encontró este perfil.')).toBeNull();
  Object.assign(mockPerfil, { fallo: false });
  await r.rerender(<PerfilRoomieWeb />);
  expect(screen.getByText('No se encontró este perfil.')).toBeTruthy();
  Object.assign(mockPerfil, { cargando: true });
  await r.rerender(<PerfilRoomieWeb />);
  expect(screen.getByText('cargando-esqueleto')).toBeTruthy();
});

it('enseña nombre, usuario, correo verificado, convivencia y biografía; nada de presupuesto ni universidad', async () => {
  await render(<PerfilRoomieWeb />);
  expect(screen.getByText('Ana Prueba')).toBeTruthy();
  expect(screen.getByText('@ana')).toBeTruthy();
  expect(screen.getByText('Correo verificado')).toBeTruthy();
  expect(screen.getByText('Prefiere silencio')).toBeTruthy();
  expect(screen.getByText('De noche')).toBeTruthy();
  expect(screen.getByText('Sí tiene')).toBeTruthy();
  expect(screen.getByText('Estudio mecatrónica.')).toBeTruthy();
  expect(screen.queryByText(/presupuesto|universidad/i)).toBeNull();
});

it('la afinidad va en palabras; sin ficha con qué comparar dice «Sin datos para comparar», no «baja»', async () => {
  const r = await render(<PerfilRoomieWeb />);
  expect(screen.getByText('Afinidad alta')).toBeTruthy();
  Object.assign(mockAfin, { afinidad: { similitud: null, nivel: 1 } });
  await r.rerender(<PerfilRoomieWeb />);
  expect(screen.getByText('Sin datos para comparar')).toBeTruthy();
  expect(screen.queryByText(/Afinidad baja/)).toBeNull();
});

it('«Iniciar chat» abre la conversación con esa persona', async () => {
  await render(<PerfilRoomieWeb />);
  await fireEvent.press(screen.getByLabelText('Iniciar chat con Ana Prueba'));
  expect(mockChat).toHaveBeenCalledWith('u2');
});

it('el propio perfil y una cuenta restringida no ofrecen chatear ni reportar', async () => {
  Object.assign(mockSesion, { id: 'u2' });
  const r = await render(<PerfilRoomieWeb />);
  expect(screen.getByText('Así te ven las demás personas.')).toBeTruthy();
  expect(screen.queryByLabelText('Reportar usuario')).toBeNull();
  Object.assign(mockSesion, { id: 'u1' });
  mockRestringida.v = true;
  await r.rerender(<PerfilRoomieWeb />);
  expect(screen.getByText(/Una cuenta de vendedor no inicia conversaciones/)).toBeTruthy();
  expect(screen.queryByLabelText('Iniciar chat con Ana Prueba')).toBeNull();
});

it('reportar: elige el motivo en la página y lo dice cuando se registró', async () => {
  mockReportar.mockResolvedValue(undefined);
  await render(<PerfilRoomieWeb />);
  await fireEvent.press(screen.getByLabelText('Reportar usuario'));
  await fireEvent.press(screen.getByLabelText('Reportar: información falsa'));
  expect(mockReportar).toHaveBeenCalledWith('u1', 'u2', 'información falsa');
  expect(await screen.findByText(/Reporte registrado/)).toBeTruthy();
});

it('si ya la habías reportado (23505) lo dice; otro fallo, otro mensaje', async () => {
  mockReportar.mockRejectedValueOnce({ code: '23505' });
  await render(<PerfilRoomieWeb />);
  await fireEvent.press(screen.getByLabelText('Reportar usuario'));
  await fireEvent.press(screen.getByLabelText('Reportar: comportamiento sospechoso'));
  expect(await screen.findByText(/Ya habías reportado a esta persona/)).toBeTruthy();
  mockReportar.mockRejectedValueOnce(new Error('x'));
  await fireEvent.press(screen.getByLabelText('Reportar usuario'));
  await fireEvent.press(screen.getByLabelText('Reportar: información falsa'));
  await waitFor(() => expect(screen.getByText(/Intenta de nuevo en un momento/)).toBeTruthy());
});
