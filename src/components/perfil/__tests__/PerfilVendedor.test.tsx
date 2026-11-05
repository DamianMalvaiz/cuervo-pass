import { act, fireEvent, render, screen } from '@testing-library/react-native';

// El perfil de un vendedor (0083): tarjeta de identidad con su estado de verificación y una lista corta que lleva a lo suyo. Lo que se fija: la
// insignia dice la verdad sobre la verificación, cada renglón lleva a donde dice, y pasar a estudiante solo cambia de pantalla si el servidor acepta.

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockCambiar = jest.fn();
const mockToastError = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a), replace: (...a: unknown[]) => mockReplace(...a) } }));
jest.mock('@/lib/toast', () => ({ toast: { error: (...a: unknown[]) => mockToastError(...a), exito: jest.fn(), info: jest.fn() } }));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }),
}));
const perfilMock: { valor: Record<string, unknown> | null; error: string | null } = { valor: { id: 'u1', universidad: null, nombre_completo: 'Dueña Prueba' }, error: null };
const mockCargarPerfil = jest.fn();
jest.mock('@/store/usePerfilStore', () => ({ usePerfilStore: () => ({ perfil: perfilMock.valor, error: perfilMock.error, cargarPerfil: (...a: unknown[]) => mockCargarPerfil(...a) }) }));
// La tarjeta de identidad tiene sus propias pruebas: aquí solo importa la insignia que recibe y lo que lleva dentro.
jest.mock('../TarjetaIdentidad', () => ({
  TarjetaIdentidad: ({ insignia, children }: { insignia?: string; children?: React.ReactNode }) => {
    const { Text, View } = require('react-native');
    return <View>{insignia ? <Text>{`INSIGNIA:${insignia}`}</Text> : null}{children}</View>;
  },
}));

const mockRoles = jest.fn();
const mockSuscripcion = jest.fn();
jest.mock('@/hooks/queries/useRoles', () => ({ useMisRoles: (...a: unknown[]) => mockRoles(...a) }));
jest.mock('@/hooks/queries/usePlanes', () => ({ useMiSuscripcion: (...a: unknown[]) => mockSuscripcion(...a) }));
const { usePerfilActivo } = jest.requireMock('@/hooks/queries/usePerfilActivo');

import { PerfilVendedor } from '../PerfilVendedor';

const rol = (r: string, estado: string) => ({ usuario_id: 'u1', rol: r, estado, origen: 'solicitud', desde: 'x' });
const roles = (...rs: unknown[]) => ({ roles: rs, cargando: false, fallo: false, reintentar: jest.fn() });
const pulsar = async (e: string | RegExp) => { await act(async () => { fireEvent.press(screen.getByLabelText(e)); }); };

beforeEach(() => {
  jest.clearAllMocks();
  perfilMock.valor = { id: 'u1', universidad: null, nombre_completo: 'Dueña Prueba' };
  perfilMock.error = null;
  mockRoles.mockReturnValue(roles(rol('arrendador', 'sin_verificar')));
  mockSuscripcion.mockReturnValue({ suscripcion: null, cargando: false, fallo: false, reintentar: jest.fn() });
  mockCambiar.mockResolvedValue(undefined);
  usePerfilActivo.mockReturnValue({ perfil: 'vendedor', cargando: false, fallo: false, cambiar: mockCambiar, cambiando: false });
});

describe('la insignia dice la verdad sobre la verificación', () => {
  it.each([
    ['sin_verificar', 'Sin verificar'],
    ['pendiente', 'Identidad en revisión'],
    ['aprobado', 'Identidad verificada'],
    ['rechazado', 'Verificación rechazada'],
  ])('%s → «%s»', async (estado, texto) => {
    mockRoles.mockReturnValue(roles(rol('comerciante', estado)));
    await render(<PerfilVendedor />);
    expect(screen.getByText(`INSIGNIA:${texto}`)).toBeTruthy();
  });

  // La 0043: una función heredada NO pasó por una revisión y no se rotula como verificada.
  it('una función HEREDADA no se rotula como verificada', async () => {
    mockRoles.mockReturnValue(roles({ usuario_id: 'u1', rol: 'arrendador', estado: 'aprobado', origen: 'migracion', desde: 'x' }));
    await render(<PerfilVendedor />);
    expect(screen.getByText('INSIGNIA:Función heredada, sin revisión')).toBeTruthy();
    expect(screen.queryByText('INSIGNIA:Identidad verificada')).toBeNull();
  });

  it('sin funciones de vendedor no inventa ninguna insignia', async () => {
    mockRoles.mockReturnValue(roles());
    await render(<PerfilVendedor />);
    expect(screen.queryByText(/INSIGNIA:/)).toBeNull();
  });
});

describe('los renglones llevan a donde dicen', () => {
  it('el engranaje abre Configuración', async () => {
    await render(<PerfilVendedor />);
    await pulsar('Configuración');
    expect(mockPush).toHaveBeenCalledWith('/configuracion');
  });

  it('lo propio se llama según lo que ofrece y lleva a Publicaciones', async () => {
    mockRoles.mockReturnValue(roles(rol('comerciante', 'aprobado')));
    await render(<PerfilVendedor />);
    await pulsar(/^Mis negocios/);
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/publicar');
  });

  it('«Verificación de identidad» lleva a la verificación del rol que urge', async () => {
    mockRoles.mockReturnValue(roles(rol('arrendador', 'sin_verificar')));
    await render(<PerfilVendedor />);
    await pulsar(/^Verificación de identidad/);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/verificacion/[rol]', params: { rol: 'arrendador' } });
  });

  it('con todo aprobado, «Verificación de identidad» sigue llevando a ver el estado', async () => {
    mockRoles.mockReturnValue(roles(rol('comerciante', 'aprobado')));
    await render(<PerfilVendedor />);
    await pulsar(/^Verificación de identidad/);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/verificacion/[rol]', params: { rol: 'comerciante' } });
  });

  it('«Mi plan y pagos» lleva a pagos', async () => {
    await render(<PerfilVendedor />);
    await pulsar(/^Mi plan y pagos/);
    expect(mockPush).toHaveBeenCalledWith('/pagos');
  });

  it('«Cómo me ven» abre la ficha propia con el id propio', async () => {
    await render(<PerfilVendedor />);
    await pulsar(/^Cómo me ven/);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/perfil/[usuarioId]', params: { usuarioId: 'u1' } });
  });
});

describe('pasar al perfil de estudiante', () => {
  it('lo pide al servidor y, sin datos de búsqueda, lleva a llenarlos', async () => {
    await render(<PerfilVendedor />);
    await pulsar(/^Activar mi perfil de estudiante/);
    expect(mockCambiar).toHaveBeenCalledWith('estudiante');
    expect(mockReplace).toHaveBeenCalledWith('/perfil/preferencias');
  });

  it('con datos de búsqueda ya puestos, va directo a Inicio', async () => {
    perfilMock.valor = { id: 'u1', universidad: 'UTVT', nombre_completo: 'Dueña Prueba' };
    await render(<PerfilVendedor />);
    await pulsar(/^Activar mi perfil de estudiante/);
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/inicio');
  });

  it('si el servidor lo rechaza, lo dice y NO cambia de pantalla', async () => {
    mockCambiar.mockRejectedValue(new Error('sin red'));
    await render(<PerfilVendedor />);
    await pulsar(/^Activar mi perfil de estudiante/);
    expect(mockToastError).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

describe('cuando FALLA la conexión se dice, no se pinta como «sin verificar»', () => {
  it('si fallan las funciones: no dice «Sin verificar» ni enseña filas que suponen lo contrario; ofrece reintentar', async () => {
    const reintentar = jest.fn();
    mockRoles.mockReturnValue({ roles: [], cargando: false, fallo: true, reintentar });
    await render(<PerfilVendedor />);
    expect(screen.queryByText(/INSIGNIA:/)).toBeNull();
    expect(screen.queryByLabelText(/Verificación de identidad/)).toBeNull();
    expect(screen.getByText('No pudimos comprobar tu verificación')).toBeTruthy();
    await pulsar('Reintentar');
    expect(reintentar).toHaveBeenCalledTimes(1);
  });

  it('aun así se puede pasar al perfil de estudiante', async () => {
    mockRoles.mockReturnValue({ roles: [], cargando: false, fallo: true, reintentar: jest.fn() });
    await render(<PerfilVendedor />);
    expect(screen.getByLabelText(/Activar mi perfil de estudiante/)).toBeTruthy();
  });

  it('sin perfil y con error de lectura: dice que no pudo cargarlo y ofrece reintentar', async () => {
    perfilMock.valor = null;
    perfilMock.error = 'No pudimos actualizar tu ficha.';
    await render(<PerfilVendedor />);
    expect(screen.getByText('No pudimos cargar tu perfil')).toBeTruthy();
    await pulsar('Reintentar');
    expect(mockCargarPerfil).toHaveBeenCalledWith('u1');
  });
});
