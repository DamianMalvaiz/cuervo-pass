import { act, fireEvent, render, screen } from '@testing-library/react-native';

// El panel del vendedor (0083): su primera vista. Lo que se fija: dice UN paso de verificación y lo lleva a él; los números son los de verdad (y un
// dato que no llegó es «—», nunca un 0 que parezca un hecho); y enseña su plan sin inventar nada.

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/components/CampanaAvisos', () => ({ CampanaAvisos: () => null }));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }),
}));

const mockRoles = jest.fn();
const mockConversaciones = jest.fn();
const mockPublicaciones = jest.fn();
const mockNegocios = jest.fn();
const mockSuscripcion = jest.fn();
jest.mock('@/hooks/queries/useRoles', () => ({ useMisRoles: (...a: unknown[]) => mockRoles(...a) }));
jest.mock('@/hooks/queries/useChat', () => ({ useConversaciones: (...a: unknown[]) => mockConversaciones(...a) }));
jest.mock('@/hooks/queries/usePublicaciones', () => ({ useMisPublicaciones: (...a: unknown[]) => mockPublicaciones(...a) }));
jest.mock('@/hooks/queries/useMisNegocios', () => ({ useMisNegocios: (...a: unknown[]) => mockNegocios(...a) }));
jest.mock('@/hooks/queries/usePlanes', () => ({ useMiSuscripcion: (...a: unknown[]) => mockSuscripcion(...a) }));

import PanelScreen from '../panel';

const rol = (r: string, estado: string) => ({ usuario_id: 'u1', rol: r, estado, origen: 'solicitud', desde: 'x' });
const roles = (...rs: unknown[]) => ({ roles: rs, cargando: false, fallo: false, reintentar: jest.fn() });
const conv = (...noLeidos: number[]) => ({
  conversaciones: noLeidos.map((n, i) => ({ conversacionId: `c${i}`, noLeidos: n })), cargando: false, fallo: false,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRoles.mockReturnValue(roles(rol('arrendador', 'sin_verificar')));
  mockConversaciones.mockReturnValue(conv());
  mockPublicaciones.mockReturnValue({ datos: [], cargando: false });
  mockNegocios.mockReturnValue({ negocios: [], cargando: false, fallo: false, reintentar: jest.fn() });
  mockSuscripcion.mockReturnValue({ suscripcion: null, cargando: false, fallo: false, reintentar: jest.fn() });
});

describe('el paso de verificación', () => {
  it('sin verificar: pide empezar y lleva a la verificación de ESE rol', async () => {
    await render(<PanelScreen />);
    expect(screen.getByText('Mi panel')).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByLabelText('Empezar verificación')); });
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/verificacion/[rol]', params: { rol: 'arrendador' } });
  });

  it('rechazada: pide volver a enviarla', async () => {
    mockRoles.mockReturnValue(roles(rol('comerciante', 'rechazado')));
    await render(<PanelScreen />);
    await act(async () => { fireEvent.press(screen.getByLabelText('Volver a enviar mi verificación')); });
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/verificacion/[rol]', params: { rol: 'comerciante' } });
  });

  it('en revisión: dice que se espera y NO ofrece empezar', async () => {
    mockRoles.mockReturnValue(roles(rol('comerciante', 'pendiente')));
    await render(<PanelScreen />);
    expect(screen.getByText(/En revisión/)).toBeTruthy();
    expect(screen.queryByLabelText('Empezar verificación')).toBeNull();
  });

  it('todo aprobado: no hay tarjeta de verificación', async () => {
    mockRoles.mockReturnValue(roles(rol('arrendador', 'aprobado')));
    await render(<PanelScreen />);
    expect(screen.queryByText('VERIFICACIÓN')).toBeNull();
    expect(screen.queryByLabelText('Empezar verificación')).toBeNull();
  });
});

describe('los números', () => {
  it('suma los mensajes sin leer de todas las conversaciones', async () => {
    mockConversaciones.mockReturnValue(conv(2, 0, 1));
    await render(<PanelScreen />);
    expect(screen.getByLabelText('Mensajes sin leer: 3')).toBeTruthy();
  });

  it('un dato que todavía no llegó es «—», no un cero', async () => {
    mockConversaciones.mockReturnValue({ conversaciones: [], cargando: true, fallo: false });
    await render(<PanelScreen />);
    expect(screen.getByLabelText('Mensajes sin leer: sin dato')).toBeTruthy();
  });

  it('un fallo de lectura tampoco se pinta como cero', async () => {
    mockConversaciones.mockReturnValue({ conversaciones: [], cargando: false, fallo: true });
    await render(<PanelScreen />);
    expect(screen.getByLabelText('Mensajes sin leer: sin dato')).toBeTruthy();
  });

  it('cuenta lo ACTIVO entre publicaciones y negocios', async () => {
    mockPublicaciones.mockReturnValue({ datos: [{ id: 'p1', activa: true }, { id: 'p2', activa: false }], cargando: false });
    mockNegocios.mockReturnValue({ negocios: [{ id: 'n1', activo: true }, { id: 'n2', activo: true }], cargando: false, fallo: false, reintentar: jest.fn() });
    await render(<PanelScreen />);
    expect(screen.getByLabelText('Activos: 3')).toBeTruthy();
  });
});

describe('el plan y lo propio', () => {
  it('enseña el plan del primer rol de vendedor, con las palabras de siempre', async () => {
    mockSuscripcion.mockReturnValue({
      suscripcion: { estado: 'sin_plan', plan_id: null, plan_nombre: null, hasta: null },
      cargando: false, fallo: false, reintentar: jest.fn(),
    });
    await render(<PanelScreen />);
    expect(screen.getByText(/Sin plan/)).toBeTruthy();
    expect(mockSuscripcion).toHaveBeenCalledWith('u1', 'arrendador');
  });

  it('«Ver mi plan y pagos» lleva a pagos', async () => {
    await render(<PanelScreen />);
    await act(async () => { fireEvent.press(screen.getByLabelText('Ver mi plan y pagos')); });
    expect(mockPush).toHaveBeenCalledWith('/pagos');
  });

  // Una sola forma de fila en toda la app (`FilaAjuste`): icono, título, descripción y flecha. El panel tenía la suya, sin icono ni descripción.
  it('lo propio usa la misma fila que el resto de la app: con su descripción, y lleva a Publicaciones', async () => {
    await render(<PanelScreen />);
    expect(screen.getByText('Datos, fotos y lo que publicas.')).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByLabelText(/^Mis publicaciones/)); });
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/publicar');
  });

  it('el bloque de lo propio se llama según lo que ofrece', async () => {
    mockRoles.mockReturnValue(roles(rol('comerciante', 'aprobado')));
    await render(<PanelScreen />);
    expect(screen.getByText('Mis negocios')).toBeTruthy();
  });
});

describe('empezar la prueba gratis', () => {
  const con = (s: Record<string, unknown>) =>
    mockSuscripcion.mockReturnValue({ suscripcion: { plan_id: null, plan_nombre: null, hasta: null, ...s }, cargando: false, fallo: false, reintentar: jest.fn() });

  it('con prueba disponible: ofrece «Empezar prueba gratis» y lleva a los planes de ESE rol', async () => {
    con({ estado: 'gratis', prueba_disponible: true });
    await render(<PanelScreen />);
    await act(async () => { fireEvent.press(screen.getByLabelText('Empezar prueba gratis')); });
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/planes/[rol]', params: { rol: 'arrendador' } });
  });

  it('sin prueba disponible, o ya en prueba: no lo ofrece', async () => {
    con({ estado: 'gratis', prueba_disponible: false });
    await render(<PanelScreen />);
    expect(screen.queryByLabelText('Empezar prueba gratis')).toBeNull();
  });

  it('en prueba: tampoco', async () => {
    con({ estado: 'prueba', prueba_disponible: false, hasta: '2099-01-01T00:00:00Z' });
    await render(<PanelScreen />);
    expect(screen.queryByLabelText('Empezar prueba gratis')).toBeNull();
  });
});
