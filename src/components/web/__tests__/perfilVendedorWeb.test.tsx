import { fireEvent, render, screen } from '@testing-library/react-native';

// El perfil de un vendedor en la web: los mismos datos que el de la app, en una página ancha. Dice el estado REAL de la verificación (y si no se pudo leer, no afirma ninguno); un fallo al leer el perfil se dice; cada tarjeta lleva a lo suyo.

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a), replace: (...a: unknown[]) => mockReplace(...a) } }));
jest.mock('@/components/web/PaginaSesionWeb', () => ({ PaginaSesionWeb: ({ children }: { children: React.ReactNode }) => children }));
const mockFoto = { urlFoto: null as string | null, subiendoFoto: false, error: null as string | null, cambiarFoto: jest.fn() };
jest.mock('@/hooks/use-foto-perfil', () => ({ useFotoPerfil: () => mockFoto }));
const mockVendedor = jest.fn();
jest.mock('@/hooks/use-perfil-vendedor', () => ({ usePerfilVendedor: () => mockVendedor() }));

import { PerfilVendedorWeb } from '../PerfilVendedorWeb';

const base = () => ({
  miId: 'u1',
  perfil: { nombre_completo: 'damian Malvaiz', nombre_usuario: 'damianm' } as Record<string, unknown> | null,
  errorPerfil: null as string | null,
  cargarPerfil: jest.fn(),
  roles: [{ rol: 'comerciante', estado: 'sin_verificar', origen: 'solicitud' }],
  falloRoles: false,
  reintentarRoles: jest.fn(),
  paso: { tipo: 'empezar', rol: 'comerciante' } as { tipo: string; rol: string | null; heredada?: boolean },
  rolDeVerificacion: 'comerciante',
  suscripcion: { estado: 'gratis', plan_nombre: 'Gratis', hasta: null } as Record<string, unknown> | null,
  aEstudiante: jest.fn(),
  cambiando: false,
});
const con = (extra: Record<string, unknown> = {}) => mockVendedor.mockReturnValue({ ...base(), ...extra });

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockFoto, { urlFoto: null, subiendoFoto: false, error: null });
  con();
});

it('enseña quién es y el estado REAL de su verificación', async () => {
  await render(<PerfilVendedorWeb />);
  expect(screen.getByText('damian Malvaiz')).toBeTruthy();
  expect(screen.getByText('@damianm')).toBeTruthy();
  expect(screen.getByText('Sin verificar')).toBeTruthy();
  expect(screen.getByText('Falta enviar tu INE y tus fotos.')).toBeTruthy();
});

it('una función heredada no se rotula como verificada', async () => {
  con({ paso: { tipo: 'listo', rol: null, heredada: true } });
  await render(<PerfilVendedorWeb />);
  expect(screen.getByText('Función heredada, sin revisión')).toBeTruthy();
  expect(screen.queryByText('Identidad verificada')).toBeNull();
});

it('si no se pudieron leer las funciones, NO afirma ningún paso ni enseña las tarjetas', async () => {
  con({ falloRoles: true, paso: null });
  await render(<PerfilVendedorWeb />);
  expect(screen.getByText('No pudimos comprobar tu verificación')).toBeTruthy();
  expect(screen.queryByText('Sin verificar')).toBeNull();
  expect(screen.queryByLabelText('Ver mi plan y pagos')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Reintentar'));
});

it('si falló leer el perfil (y no hay nada que enseñar) lo dice, no «Tu cuenta» vacío', async () => {
  const cargarPerfil = jest.fn();
  con({ perfil: null, errorPerfil: 'x', cargarPerfil });
  await render(<PerfilVendedorWeb />);
  expect(screen.getByText('No pudimos cargar tu perfil')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Reintentar'));
  expect(cargarPerfil).toHaveBeenCalledWith('u1');
});

describe('las tarjetas llevan a lo suyo', () => {
  it('lo que ofrezco, verificación (de ESE rol), plan y pagos, y cómo me ven', async () => {
    await render(<PerfilVendedorWeb />);
    await fireEvent.press(screen.getByLabelText('Abrir Mis negocios'));
    expect(mockPush).toHaveBeenLastCalledWith('/(tabs)/publicar');
    await fireEvent.press(screen.getByLabelText('Ver mi verificación de identidad'));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/verificacion/[rol]', params: { rol: 'comerciante' } });
    await fireEvent.press(screen.getByLabelText('Ver mi plan y pagos'));
    expect(mockPush).toHaveBeenLastCalledWith('/pagos');
    await fireEvent.press(screen.getByLabelText('Ver cómo me ven'));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/perfil/[usuarioId]', params: { usuarioId: 'u1' } });
  });
  it('mientras no se sabe el plan dice «Consultando…» (no inventa uno)', async () => {
    con({ suscripcion: null });
    await render(<PerfilVendedorWeb />);
    expect(screen.getByText('Consultando…')).toBeTruthy();
  });
});

describe('foto y cambio de perfil', () => {
  it('tocar el avatar cambia la foto; si falla, lo dice', async () => {
    mockFoto.error = 'No pudimos subir la foto';
    await render(<PerfilVendedorWeb />);
    await fireEvent.press(screen.getByLabelText('Agregar una foto de perfil'));
    expect(mockFoto.cambiarFoto).toHaveBeenCalled();
    expect(screen.getByText('No pudimos subir la foto')).toBeTruthy();
  });
  it('«Activar mi perfil de estudiante» cambia de perfil; mientras cambia no se repite', async () => {
    const aEstudiante = jest.fn();
    con({ aEstudiante });
    const r = await render(<PerfilVendedorWeb />);
    await fireEvent.press(screen.getByLabelText('Activar mi perfil de estudiante'));
    expect(aEstudiante).toHaveBeenCalledTimes(1);
    con({ aEstudiante, cambiando: true });
    await r.rerender(<PerfilVendedorWeb />);
    expect(screen.getByText('Cambiando…')).toBeTruthy();
  });
});
