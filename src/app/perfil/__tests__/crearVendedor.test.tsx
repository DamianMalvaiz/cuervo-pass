import { act, fireEvent, render, screen } from '@testing-library/react-native';

// «Crear perfil de vendedor» (0083): reemplaza al viejo «Tus funciones» del perfil, que pedía el rol con una alerta. Lo que se fija: elegir qué se ofrece,
// pedir la función SOLO si no se tiene, pasar al perfil de vendedor, y que NADA cambie de pantalla si el servidor rechaza algún paso.

const mockReplace = jest.fn();
const mockAgregar = jest.fn();
const mockCambiar = jest.fn();
const mockToastError = jest.fn();
jest.mock('expo-router', () => ({ router: { replace: (...a: unknown[]) => mockReplace(...a) } }));
jest.mock('@/lib/toast', () => ({ toast: { error: (...a: unknown[]) => mockToastError(...a), exito: jest.fn(), info: jest.fn() } }));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }),
}));
const mockRoles = jest.fn();
jest.mock('@/hooks/queries/useRoles', () => ({
  useMisRoles: (...a: unknown[]) => mockRoles(...a),
  useAgregarFuncion: () => ({ mutateAsync: (...a: unknown[]) => mockAgregar(...a) }),
}));
const { usePerfilActivo } = jest.requireMock('@/hooks/queries/usePerfilActivo');

import CrearVendedorScreen from '../crear-vendedor';

const rol = (r: string, estado = 'sin_verificar') => ({ usuario_id: 'u1', rol: r, estado, origen: 'solicitud', desde: 'x' });
const pulsar = async (e: string | RegExp) => { await act(async () => { fireEvent.press(screen.getByLabelText(e)); }); };

beforeEach(() => {
  jest.clearAllMocks();
  mockRoles.mockReturnValue({ roles: [], cargando: false, fallo: false, reintentar: jest.fn() });
  mockAgregar.mockResolvedValue(undefined);
  mockCambiar.mockResolvedValue(undefined);
  usePerfilActivo.mockReturnValue({ perfil: 'estudiante', cargando: false, fallo: false, cambiar: mockCambiar, cambiando: false });
});

describe('elegir qué se ofrece', () => {
  it('por omisión es «Arrendador»', async () => {
    await render(<CrearVendedorScreen />);
    expect(screen.getByLabelText(/^Arrendador/).props.accessibilityState?.checked).toBe(true);
    expect(screen.getByLabelText(/^Negocio o servicio/).props.accessibilityState?.checked).toBe(false);
  });

  it('se puede elegir «Negocio o servicio»', async () => {
    await render(<CrearVendedorScreen />);
    await pulsar(/^Negocio o servicio/);
    expect(screen.getByLabelText(/^Negocio o servicio/).props.accessibilityState?.checked).toBe(true);
    expect(screen.getByLabelText(/^Arrendador/).props.accessibilityState?.checked).toBe(false);
  });
});

describe('continuar', () => {
  it('pide la función, pasa al perfil de vendedor y va al panel, EN ESE ORDEN', async () => {
    const orden: string[] = [];
    mockAgregar.mockImplementation(async () => { orden.push('agregar'); });
    mockCambiar.mockImplementation(async () => { orden.push('cambiar'); });
    mockReplace.mockImplementation(() => { orden.push('ir'); });
    await render(<CrearVendedorScreen />);
    await pulsar(/^Negocio o servicio/);
    await pulsar('Continuar');

    expect(mockAgregar).toHaveBeenCalledWith('comerciante');
    expect(mockCambiar).toHaveBeenCalledWith('vendedor');
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/panel');
    expect(orden).toEqual(['agregar', 'cambiar', 'ir']);
  });

  it('si ya tiene esa función NO la pide otra vez', async () => {
    mockRoles.mockReturnValue({ roles: [rol('arrendador')], cargando: false, fallo: false, reintentar: jest.fn() });
    await render(<CrearVendedorScreen />);
    await pulsar('Continuar');

    expect(mockAgregar).not.toHaveBeenCalled();
    expect(mockCambiar).toHaveBeenCalledWith('vendedor');
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/panel');
  });

  it('si el servidor rechaza pedir la función: lo dice, y NO cambia de perfil ni de pantalla', async () => {
    mockAgregar.mockRejectedValue(new Error('sin red'));
    await render(<CrearVendedorScreen />);
    await pulsar('Continuar');

    expect(mockToastError).toHaveBeenCalled();
    expect(mockCambiar).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('si rechaza el cambio de perfil: lo dice y NO cambia de pantalla', async () => {
    mockCambiar.mockRejectedValue({ code: 'CP017' });
    await render(<CrearVendedorScreen />);
    await pulsar('Continuar');

    expect(mockToastError).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  // END-27 · el rechazo se distingue POR CÓDIGO, y un fallo de red no se dice como rechazo (ni al revés).
  it('si el servidor la rechaza con CP003, lo explica por código', async () => {
    mockAgregar.mockRejectedValue({ code: 'CP003' });
    await render(<CrearVendedorScreen />);
    await pulsar('Continuar');
    expect(mockToastError).toHaveBeenCalledWith('Esa función no se puede crear.');
  });

  it('un fallo de red se dice como fallo de red, no como rechazo', async () => {
    mockAgregar.mockRejectedValue(new Error('sin red'));
    await render(<CrearVendedorScreen />);
    await pulsar('Continuar');
    expect(mockToastError).toHaveBeenCalledWith(expect.stringMatching(/conexión/i));
    expect(mockToastError).not.toHaveBeenCalledWith('Esa función no se puede crear.');
  });

  it('dos toques seguidos piden la función una sola vez', async () => {
    let resolver!: () => void;
    mockAgregar.mockReturnValue(new Promise<void>((r) => { resolver = r; }));
    await render(<CrearVendedorScreen />);
    await pulsar('Continuar');
    await pulsar('Continuar');
    expect(mockAgregar).toHaveBeenCalledTimes(1);
    await act(async () => { resolver(); });
  });
});

describe('lo que dice', () => {
  it('avisa que la cuenta de estudiante sigue funcionando y que hay que verificarse', async () => {
    await render(<CrearVendedorScreen />);
    expect(screen.getByText(/tu cuenta de estudiante sigue funcionando/i)).toBeTruthy();
    expect(screen.getByText(/INE/)).toBeTruthy();
  });
});
