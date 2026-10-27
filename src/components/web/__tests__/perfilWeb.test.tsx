import { fireEvent, render, screen } from '@testing-library/react-native';

// El perfil de quien busca, en la web. Lo que se fija: «completa tu perfil» se calcula SOLO con datos reales (cada punto está hecho o pendiente según lo que hay), lo pendiente trae su acción, «Correo verificado» es
// literalmente lo que se sabe (no «usuario verificado»), y un fallo al leer el perfil NO se pinta como «sin nombre» ni «sin definir» (END-11). Cambiar de perfil dice si falla.

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a), replace: (...a: unknown[]) => mockReplace(...a) } }));
jest.mock('expo-router/head', () => ({ __esModule: true, default: () => null }));
jest.mock('@/hooks/use-tamano-pantalla', () => ({ useTamanoPantalla: () => ({ ancho: 1440, alto: 900, clase: 'amplia' }) }));
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }) }));
const mockToast = jest.fn();
jest.mock('@/lib/toast', () => ({ toast: { error: (...a: unknown[]) => mockToast(...a), exito: jest.fn(), info: jest.fn() } }));

const cargarPerfil = jest.fn();
const mockPerfil = {
  perfil: null as null | Record<string, unknown>,
  cargando: false,
  error: null as string | null,
  cargarPerfil,
};
jest.mock('@/store/usePerfilStore', () => ({ usePerfilStore: (sel?: (s: unknown) => unknown) => (sel ? sel(mockPerfil) : mockPerfil) }));
const cambiarFoto = jest.fn();
const mockFoto = { urlFoto: null as string | null, subiendoFoto: false, error: null as string | null, cambiarFoto };
jest.mock('@/hooks/use-foto-perfil', () => ({ useFotoPerfil: () => mockFoto }));
const mockRoomie = { miRoomie: null as null | { estado: string } };
jest.mock('@/hooks/queries/useRoomies', () => ({ useMiRoomie: () => ({ ...mockRoomie, cargando: false }) }));
const mockPubs = { datos: [] as { id: string; activa: boolean }[], cargando: false };
jest.mock('@/hooks/queries/usePublicaciones', () => ({ useMisPublicaciones: () => mockPubs }));
const reintentarRoles = jest.fn();
const mockRoles = { roles: [] as { rol: string; estado: string }[], fallo: false, reintentar: reintentarRoles };
jest.mock('@/hooks/queries/useRoles', () => ({ useMisRoles: () => mockRoles }));
const mockCambiarPerfil = jest.fn();
jest.mock('@/hooks/queries/usePerfilActivo', () => ({ usePerfilActivo: () => ({ perfil: 'estudiante', cambiar: mockCambiarPerfil }) }));

import { PerfilWeb } from '../PerfilWeb';

const COMPLETO = { nombre_completo: 'Ana Ruiz', nombre_usuario: 'anaruiz', universidad: 'UTVT', presupuesto_min: 2000, presupuesto_max: 4500, distancia_max_km: 5, nivel_ruido: 'bajo', horario_predominante: 'diurno', foto_url: 'ruta/foto.jpg', biografia: 'Estudio redes y madrugo.', correo_verificado: true, mascotas: false };

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockPerfil, { perfil: { ...COMPLETO }, cargando: false, error: null });
  Object.assign(mockFoto, { urlFoto: null, subiendoFoto: false, error: null });
  mockRoomie.miRoomie = { estado: 'activo' };
  Object.assign(mockPubs, { datos: [], cargando: false });
  Object.assign(mockRoles, { roles: [], fallo: false });
  mockCambiarPerfil.mockResolvedValue(undefined);
});

describe('identidad', () => {
  it('nombre, usuario y universidad, y «Correo verificado» solo si es verdad', async () => {
    await render(<PerfilWeb />);
    expect(screen.getByText('Ana Ruiz')).toBeTruthy();
    expect(screen.getByText('@anaruiz')).toBeTruthy();
    expect(screen.getByText('Correo verificado')).toBeTruthy();
  });

  it('sin correo verificado no lo afirma (ni dice «usuario verificado»)', async () => {
    mockPerfil.perfil = { ...COMPLETO, correo_verificado: false };
    await render(<PerfilWeb />);
    expect(screen.queryByText('Correo verificado')).toBeNull();
    expect(screen.queryByText(/usuario verificado/i)).toBeNull();
  });

  it('la foto se cambia desde el avatar', async () => {
    await render(<PerfilWeb />);
    await fireEvent.press(screen.getByLabelText('Agregar una foto de perfil'));
    expect(cambiarFoto).toHaveBeenCalledTimes(1);
  });

  it('un FALLO al leer el perfil se dice y se puede reintentar: no pinta «Sin nombre»', async () => {
    Object.assign(mockPerfil, { perfil: null, error: 'x' });
    await render(<PerfilWeb />);
    expect(screen.getByText('No pudimos cargar tu perfil')).toBeTruthy();
    expect(screen.queryByText(/Sin nombre/)).toBeNull();
    await fireEvent.press(screen.getByLabelText('Reintentar'));
    expect(cargarPerfil).toHaveBeenCalledWith('u1');
  });

  it('mientras carga reserva el lugar, no afirma nada', async () => {
    Object.assign(mockPerfil, { perfil: null, cargando: true });
    await render(<PerfilWeb />);
    expect(screen.getByLabelText('Cargando')).toBeTruthy();
  });
});

describe('completa tu perfil', () => {
  it('con todo hecho dice 6 de 6 y no pide nada', async () => {
    await render(<PerfilWeb />);
    expect(screen.getByText('6 de 6')).toBeTruthy();
    expect(screen.queryByLabelText(/^Completar |^Agregar foto|^Escribir sobre|^Activar mi/)).toBeNull();
  });

  it('cada punto pendiente sale de un dato que falta y trae su acción', async () => {
    mockPerfil.perfil = { ...COMPLETO, presupuesto_max: null, nivel_ruido: null, foto_url: null, biografia: '  ', correo_verificado: false };
    mockRoomie.miRoomie = null;
    await render(<PerfilWeb />);
    expect(screen.getByText('0 de 6')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Completar presupuesto y distancia'));
    expect(mockPush).toHaveBeenLastCalledWith('/perfil/preferencias');
    await fireEvent.press(screen.getByLabelText('Completar hábitos de convivencia'));
    expect(mockPush).toHaveBeenLastCalledWith('/perfil/preferencias');
    await fireEvent.press(screen.getByLabelText('Escribir sobre mí'));
    expect(mockPush).toHaveBeenLastCalledWith('/perfil/sobre-mi');
    await fireEvent.press(screen.getByLabelText('Activar mi ficha de roomie'));
    expect(mockPush).toHaveBeenLastCalledWith('/roomies');
    await fireEvent.press(screen.getByLabelText('Agregar foto de perfil'));
    expect(cambiarFoto).toHaveBeenCalled();
  });

  it('el correo universitario sin verificar no tiene acción aquí (se verifica desde el correo)', async () => {
    mockPerfil.perfil = { ...COMPLETO, correo_verificado: false };
    await render(<PerfilWeb />);
    expect(screen.getByText('5 de 6')).toBeTruthy();
  });
});

describe('mi búsqueda y lo demás', () => {
  it('mi búsqueda enseña lo declarado, tal cual, y se edita', async () => {
    await render(<PerfilWeb />);
    expect(screen.getByText('$2,000 a $4,500')).toBeTruthy();
    expect(screen.getByText('Hasta 5 km')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Editar mi búsqueda'));
    expect(mockPush).toHaveBeenLastCalledWith('/perfil/preferencias');
  });

  it('lo que no está definido se dice «sin definir», no se inventa', async () => {
    mockPerfil.perfil = { ...COMPLETO, presupuesto_min: null, presupuesto_max: null, distancia_max_km: null, universidad: null };
    await render(<PerfilWeb />);
    expect(screen.getAllByText('sin definir')).toHaveLength(3);
  });

  it('sobre mí: el texto, o que todavía no hay', async () => {
    const { unmount } = await render(<PerfilWeb />);
    expect(screen.getByText('Estudio redes y madrugo.')).toBeTruthy();
    await unmount();
    mockPerfil.perfil = { ...COMPLETO, biografia: null };
    await render(<PerfilWeb />);
    expect(screen.getByText('Todavía no has escrito nada.')).toBeTruthy();
  });

  it('«Cómo me ven» abre tu ficha pública', async () => {
    await render(<PerfilWeb />);
    await fireEvent.press(screen.getByLabelText('Ver cómo me ven'));
    expect(mockPush).toHaveBeenLastCalledWith('/perfil/u1');
  });

  it('la ficha de roomie dice la verdad: activa, pausada o sin crear', async () => {
    const { unmount } = await render(<PerfilWeb />);
    expect(screen.getByText('Activa: apareces en la lista de roomies.')).toBeTruthy();
    await unmount();
    mockRoomie.miRoomie = { estado: 'cerrado' };
    const r2 = await render(<PerfilWeb />);
    expect(screen.getByText('Pausada: no apareces en la lista.')).toBeTruthy();
    await r2.unmount();
    mockRoomie.miRoomie = null;
    await render(<PerfilWeb />);
    expect(screen.getByText('Sin crear. Nadie te encuentra como roomie.')).toBeTruthy();
  });

  it('mis publicaciones solo si hay, con cuántas y cuántas activas', async () => {
    const { unmount } = await render(<PerfilWeb />);
    expect(screen.queryByText(/publicadas?/)).toBeNull();
    await unmount();
    mockPubs.datos = [{ id: 'a', activa: true }, { id: 'b', activa: false }];
    await render(<PerfilWeb />);
    expect(screen.getByText('2 publicadas · 1 activa')).toBeTruthy();
  });
});

describe('perfil de vendedor', () => {
  it('sin perfil de vendedor ofrece crearlo', async () => {
    await render(<PerfilWeb />);
    await fireEvent.press(screen.getByLabelText('Crea tu perfil de vendedor'));
    expect(mockPush).toHaveBeenLastCalledWith('/perfil/crear-vendedor');
  });

  it('con perfil de vendedor, el botón cambia de perfil y entra al panel', async () => {
    mockRoles.roles = [{ rol: 'arrendador', estado: 'aprobado' }];
    await render(<PerfilWeb />);
    await fireEvent.press(screen.getByLabelText('Ir a mi perfil de vendedor'));
    await Promise.resolve();
    expect(mockCambiarPerfil).toHaveBeenCalledWith('vendedor');
  });

  it('si no se pudo leer el perfil de vendedor lo dice (no ofrece «crear» lo que quizá ya existe)', async () => {
    mockRoles.fallo = true;
    await render(<PerfilWeb />);
    expect(screen.getByText('No pudimos comprobar tu perfil de vendedor')).toBeTruthy();
    expect(screen.queryByLabelText('Crea tu perfil de vendedor')).toBeNull();
  });
});
