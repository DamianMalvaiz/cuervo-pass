import { fireEvent, render, screen } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockAvisos = jest.fn();
const mockMarcarUno = jest.fn();
const mockMarcarTodos = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/hooks/queries/useNotificaciones', () => ({
  useAvisos: (...a: unknown[]) => mockAvisos(...a),
  useMarcarAvisos: () => ({ marcarUno: mockMarcarUno, marcarTodos: mockMarcarTodos, marcandoTodos: false }),
}));
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }) }));
const mockToque = jest.fn();
jest.mock('@/lib/tacto', () => ({ toque: (...a: unknown[]) => mockToque(...a), sello: jest.fn() }));

import NotificacionesScreen, { cuandoFue } from '../notificaciones';

const ahora = Date.now();
const aviso = (extra: Record<string, unknown> = {}) => ({
  id: 'a1', tipo: 'resena_nueva', contenido: 'Nueva reseña de 5 ★ en «Café»', leida: false, creado_en: new Date(ahora - 5 * 60_000).toISOString(), destino: 'negocio:n1', ...extra,
});
const estado = (extra: Record<string, unknown> = {}) => ({ avisos: [aviso()], cargando: false, fallo: false, reintentar: jest.fn(), ...extra });

beforeEach(() => {
  jest.clearAllMocks();
  mockAvisos.mockReturnValue(estado());
});

describe('cuandoFue', () => {
  const t = (ms: number) => new Date(ahora - ms).toISOString();
  it.each([[10_000, 'ahora'], [5 * 60_000, 'hace 5 min'], [3 * 3_600_000, 'hace 3 h'], [2 * 86_400_000, 'hace 2 d']])('%s ms → %s', (ms, texto) => {
    expect(cuandoFue(t(ms), ahora)).toBe(texto);
  });
  it('pasada una semana es la fecha, y un valor inválido no inventa nada', () => {
    expect(cuandoFue(t(30 * 86_400_000), ahora)).not.toMatch(/hace/);
    expect(cuandoFue('no es fecha', ahora)).toBe('');
  });
});

it('pide los avisos de ESTA cuenta', async () => {
  await render(<NotificacionesScreen />);
  expect(mockAvisos).toHaveBeenCalledWith('u1');
});
it('tocar un aviso lo marca leído y lleva a su destino', async () => {
  await render(<NotificacionesScreen />);
  await fireEvent.press(screen.getByLabelText(/Sin leer\. Nueva reseña de 5/));
  expect(mockMarcarUno).toHaveBeenCalledWith('a1');
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/negocio/[id]', params: { id: 'n1' } });
});
// Abrir un aviso navega a su destino: no cambia nada que haya que confirmar al tacto (el aviso que se marca leído se ve en la lista).
it('tocar un aviso NO vibra: es navegar', async () => {
  await render(<NotificacionesScreen />);
  await fireEvent.press(screen.getByLabelText(/Sin leer\. Nueva reseña de 5/));
  expect(mockToque).not.toHaveBeenCalled();
});
it('un aviso ya leído no se vuelve a marcar', async () => {
  mockAvisos.mockReturnValue(estado({ avisos: [aviso({ leida: true })] }));
  await render(<NotificacionesScreen />);
  await fireEvent.press(screen.getByLabelText(/Nueva reseña de 5/));
  expect(mockMarcarUno).not.toHaveBeenCalled();
  expect(mockPush).toHaveBeenCalled();
});
it('un destino desconocido solo marca leído: no navega a algo inventado', async () => {
  mockAvisos.mockReturnValue(estado({ avisos: [aviso({ destino: 'admin:todo' })] }));
  await render(<NotificacionesScreen />);
  await fireEvent.press(screen.getByLabelText(/Sin leer/));
  expect(mockMarcarUno).toHaveBeenCalledWith('a1');
  expect(mockPush).not.toHaveBeenCalled();
});
it('«Marcar todos como leídos» solo aparece si hay sin leer', async () => {
  await render(<NotificacionesScreen />);
  await fireEvent.press(screen.getByLabelText('Marcar todos como leídos'));
  expect(mockMarcarTodos).toHaveBeenCalled();
});
it('sin ninguno sin leer no ofrece marcar todos', async () => {
  mockAvisos.mockReturnValue(estado({ avisos: [aviso({ leida: true })] }));
  await render(<NotificacionesScreen />);
  expect(screen.queryByLabelText('Marcar todos como leídos')).toBeNull();
});
it('vacío legítimo: «Sin avisos»', async () => {
  mockAvisos.mockReturnValue(estado({ avisos: [] }));
  await render(<NotificacionesScreen />);
  expect(screen.getByText('Sin avisos')).toBeTruthy();
});
it('si falla, lo dice con reintento y NO dice «Sin avisos»', async () => {
  const reintentar = jest.fn();
  mockAvisos.mockReturnValue(estado({ avisos: [], fallo: true, reintentar }));
  await render(<NotificacionesScreen />);
  expect(screen.getByText('No pudimos cargar tus avisos')).toBeTruthy();
  expect(screen.queryByText('Sin avisos')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Reintentar'));
  expect(reintentar).toHaveBeenCalled();
});
it('mientras carga no dice que no hay nada', async () => {
  mockAvisos.mockReturnValue(estado({ avisos: [], cargando: true }));
  await render(<NotificacionesScreen />);
  expect(screen.queryByText('Sin avisos')).toBeNull();
});
