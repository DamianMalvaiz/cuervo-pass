import { fireEvent, render, screen } from '@testing-library/react-native';

// Notificaciones en la web: separa «Sin leer» de «Anteriores»; tocar un aviso lo marca y lleva a su destino; «Marcar todos» solo si hay sin leer; y cargando / falló / vacío son estados distintos (END-11).

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/components/web/PaginaSesionWeb', () => ({ PaginaSesionWeb: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/components/web/EsqueletoWeb', () => {
  const { Text } = require('react-native');
  return { EsqueletoFilasWeb: () => <Text>cargando-esqueleto</Text> };
});
const mockAvisos = jest.fn();
const mockMarcarUno = jest.fn();
const mockMarcarTodos = jest.fn();
jest.mock('@/hooks/queries/useNotificaciones', () => ({
  useAvisos: (...a: unknown[]) => mockAvisos(...a),
  useMarcarAvisos: () => ({ marcarUno: mockMarcarUno, marcarTodos: mockMarcarTodos, marcandoTodos: false }),
}));
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }) }));

import { NotificacionesWeb } from '../NotificacionesWeb';

const ahora = Date.now();
const aviso = (extra: Record<string, unknown> = {}) => ({
  id: 'a1', tipo: 'resena_nueva', contenido: 'Nueva reseña de 5 ★ en «Café»', leida: false, creado_en: new Date(ahora - 5 * 60_000).toISOString(), destino: 'negocio:n1', ...extra,
});
const estado = (extra: Record<string, unknown> = {}) => ({ avisos: [aviso()], cargando: false, fallo: false, reintentar: jest.fn(), ...extra });

beforeEach(() => {
  jest.clearAllMocks();
  mockAvisos.mockReturnValue(estado());
});

it('lo no leído va en «Sin leer» con su cuenta, y lo leído en «Anteriores»', async () => {
  mockAvisos.mockReturnValue(estado({ avisos: [aviso(), aviso({ id: 'a2', leida: true, contenido: 'Ya lo viste' })] }));
  await render(<NotificacionesWeb />);
  expect(screen.getByText('Sin leer (1)')).toBeTruthy();
  expect(screen.getByText('Anteriores')).toBeTruthy();
  expect(screen.getByText('Ya lo viste')).toBeTruthy();
});

it('si todo está leído, lo dice y no ofrece «Marcar todos»', async () => {
  mockAvisos.mockReturnValue(estado({ avisos: [aviso({ leida: true })] }));
  await render(<NotificacionesWeb />);
  expect(screen.getByText('Todo al día')).toBeTruthy();
  expect(screen.queryByLabelText('Marcar todos como leídos')).toBeNull();
});

it('tocar un aviso sin leer lo marca como leído y lleva a su destino', async () => {
  await render(<NotificacionesWeb />);
  await fireEvent.press(screen.getByLabelText(/Sin leer\. Nueva reseña/));
  expect(mockMarcarUno).toHaveBeenCalledWith('a1');
  expect(mockPush).toHaveBeenCalledTimes(1);
});

it('un aviso ya leído no se vuelve a marcar', async () => {
  mockAvisos.mockReturnValue(estado({ avisos: [aviso({ leida: true })] }));
  await render(<NotificacionesWeb />);
  await fireEvent.press(screen.getByLabelText(/Nueva reseña/));
  expect(mockMarcarUno).not.toHaveBeenCalled();
});

it('«Marcar todos como leídos» marca todos', async () => {
  await render(<NotificacionesWeb />);
  await fireEvent.press(screen.getByLabelText('Marcar todos como leídos'));
  expect(mockMarcarTodos).toHaveBeenCalledTimes(1);
});

it('un destino desconocido solo marca como leído, no navega', async () => {
  mockAvisos.mockReturnValue(estado({ avisos: [aviso({ destino: 'algo:raro' })] }));
  await render(<NotificacionesWeb />);
  await fireEvent.press(screen.getByLabelText(/Sin leer\./));
  expect(mockMarcarUno).toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
});

it('cargando, falló y vacío son tres cosas distintas', async () => {
  mockAvisos.mockReturnValue(estado({ avisos: [], cargando: true }));
  const r = await render(<NotificacionesWeb />);
  expect(screen.getByText('cargando-esqueleto')).toBeTruthy();
  mockAvisos.mockReturnValue(estado({ avisos: [], fallo: true }));
  await r.rerender(<NotificacionesWeb />);
  expect(screen.getByText('No pudimos cargar tus avisos')).toBeTruthy();
  expect(screen.queryByText('Sin avisos')).toBeNull();
  mockAvisos.mockReturnValue(estado({ avisos: [] }));
  await r.rerender(<NotificacionesWeb />);
  expect(screen.getByText('Sin avisos')).toBeTruthy();
});
