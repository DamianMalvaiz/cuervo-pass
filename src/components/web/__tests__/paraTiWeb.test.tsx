import { fireEvent, render, screen } from '@testing-library/react-native';

// «Para ti»: la portada de quien ya entró. Lo que se fija: el saludo (con el nombre solo si se sabe), el ajuste SOLO en palabras y solo si se cumple (0.5 o más; por debajo se calla), las razones que de verdad se
// cumplen con el perfil, y que un FALLO al leer nunca se pinte como «no hay nada» (invariante 2). Cada bloque falla y se recupera por su cuenta.

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('expo-router/head', () => ({ __esModule: true, default: () => null }));
const mockPantalla = { ancho: 1440 };
jest.mock('@/hooks/use-tamano-pantalla', () => ({ useTamanoPantalla: () => ({ ancho: mockPantalla.ancho, alto: 900, clase: 'amplia' }) }));
const mockSesion = { user: { id: 'u1', email: 'ana@b.mx', user_metadata: { nombre_completo: 'Ana Ruiz López' } } as { id: string; email: string; user_metadata: Record<string, string> } };
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: mockSesion }) }));
const mockPerfil = { perfil: { presupuesto_max: 4500, distancia_max_km: 5, universidad: 'UTVT', mascotas: false } as null | Record<string, unknown>, cargando: false, error: null as string | null, cargarPerfil: jest.fn() };
jest.mock('@/store/usePerfilStore', () => ({ usePerfilStore: (sel: (s: unknown) => unknown) => sel(mockPerfil) }));
jest.mock('@/hooks/use-fotos-firmadas', () => ({ useFotosFirmadas: () => ({ urls: new Map(), fallo: null }) }));

const reintentar = jest.fn();
const mockSug = { datos: [] as Record<string, unknown>[], cargando: false, fallo: null as string | null, refrescar: reintentar };
jest.mock('@/hooks/queries/usePublicaciones', () => ({ useSugerencias: () => mockSug }));
const mockViv = { publicaciones: [] as { id: string; titulo_publico: string }[], cargando: false, fallo: false, reintentar };
jest.mock('@/hooks/queries/useExplorar', () => ({ usePublicacionesPorIds: () => mockViv }));
const mockRoom = { roomies: [] as { id: string; nombre_completo: string; foto_url: null }[], cargando: false, fallo: null as string | null, reintentar };
jest.mock('@/hooks/queries/useRoomies', () => ({ useRoomiesSugeridos: () => mockRoom }));
const mockChats = { conversaciones: [] as Record<string, unknown>[], cargando: false, fallo: null as string | null, reintentar };
jest.mock('@/hooks/queries/useChat', () => ({ useConversaciones: () => mockChats }));
const mockFav = { ids: new Set<string>(), cargando: false, fallo: false };
jest.mock('@/hooks/queries/useFavoritos', () => ({ useMisFavoritosIds: () => mockFav }));

jest.mock('../PaginaWeb', () => ({ PaginaWeb: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('../BuscadorWeb', () => ({ BuscadorWeb: ({ onBuscar }: { onBuscar: () => void }) => require('react').createElement(require('react-native').Pressable, { onPress: onBuscar, accessibilityLabel: 'Buscar' }) }));
jest.mock('../TarjetaPublicacionWeb', () => ({ TarjetaPublicacionWeb: ({ p, etiqueta, razon }: { p: { titulo_publico: string }; etiqueta?: string; razon?: string }) => require('react').createElement(require('react-native').Text, null, `VIV ${p.titulo_publico} | ${etiqueta ?? '-'} | ${razon ?? '-'}`) }));
jest.mock('../TarjetaRoomieWeb', () => ({ TarjetaRoomieWeb: ({ r }: { r: { nombre_completo: string } }) => require('react').createElement(require('react-native').Text, null, `ROOMIE ${r.nombre_completo}`) }));

import { ParaTiWeb } from '../ParaTiWeb';

const sug = (id: string, extra: Record<string, unknown> = {}) => ({ id, titulo: id, tipo: 'cuarto', precio_renta: 3000, distancia: 1.2, permite_mascotas: false, score: 0.8, score_final: 0.9, ...extra });
const viv = (id: string) => ({ id, titulo_publico: `Lugar ${id}` });
const conv = (id: string, nombre: string, noLeidos: number) => ({ conversacionId: id, otroUsuario: { nombre_completo: nombre, foto_url: null }, ultimoMensaje: { contenido: `Hola de ${nombre}`, creado_en: '2026-10-27T15:00:00Z' }, noLeidos });

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: new Date('2026-10-27T15:00:00') });
  mockPantalla.ancho = 1440;
  mockSesion.user.user_metadata = { nombre_completo: 'Ana Ruiz López' };
  Object.assign(mockPerfil, { perfil: { presupuesto_max: 4500, distancia_max_km: 5, universidad: 'UTVT', mascotas: false }, cargando: false, error: null });
  Object.assign(mockSug, { datos: [], cargando: false, fallo: null });
  Object.assign(mockViv, { publicaciones: [], cargando: false, fallo: false });
  Object.assign(mockRoom, { roomies: [], cargando: false, fallo: null });
  Object.assign(mockChats, { conversaciones: [], cargando: false, fallo: null });
  Object.assign(mockFav, { ids: new Set(), cargando: false, fallo: false });
});
afterEach(() => jest.useRealTimers());

describe('saludo y cifras', () => {
  it('saluda por la hora y por el primer nombre', async () => {
    await render(<ParaTiWeb />);
    expect(screen.getByText('Buenas tardes, Ana.')).toBeTruthy();
  });

  it('sin nombre no se inventa uno', async () => {
    mockSesion.user.user_metadata = {};
    await render(<ParaTiWeb />);
    expect(screen.getByText('Buenas tardes.')).toBeTruthy();
  });

  it('cuenta lo que de verdad hay: lugares que encajan, mensajes sin leer y guardados', async () => {
    mockSug.datos = [sug('a'), sug('b'), sug('c', { score_final: 0.3 })];
    mockChats.conversaciones = [conv('c1', 'Valeria', 2), conv('c2', 'Jorge', 1)];
    mockFav.ids = new Set(['x', 'y', 'z', 'w']);
    await render(<ParaTiWeb />);
    expect(screen.getByLabelText('2 lugares encajan contigo')).toBeTruthy();
    expect(screen.getByLabelText('3 mensajes sin leer')).toBeTruthy();
    expect(screen.getByLabelText('4 guardados')).toBeTruthy();
  });

  it('una cifra que no se sabe (falló la lectura) no se pinta: nunca un cero que mienta', async () => {
    mockChats.fallo = 'x';
    await render(<ParaTiWeb />);
    expect(screen.queryByLabelText(/mensajes? sin leer/)).toBeNull();
  });
});

describe('lo que mejor encaja', () => {
  it('enseña los lugares en el orden del motor, con el ajuste en palabras y la razón que se cumple', async () => {
    mockSug.datos = [sug('a'), sug('b', { score_final: 0.6, precio_renta: 9000, distancia: 40 })];
    mockViv.publicaciones = [viv('b'), viv('a')];
    await render(<ParaTiWeb />);
    expect(screen.getByText('VIV Lugar a | Muy compatible contigo | Está dentro de tu presupuesto')).toBeTruthy();
    // El segundo es compatible, y no inventa razones que no se cumplen (fuera de presupuesto y de distancia).
    expect(screen.getByText('VIV Lugar b | Compatible contigo | -')).toBeTruthy();
  });

  it('con el score bajo (menos de 0.5) no pone etiqueta: se calla en vez de decir «poco compatible»', async () => {
    mockSug.datos = [sug('a', { score_final: 0.3 })];
    mockViv.publicaciones = [viv('a')];
    await render(<ParaTiWeb />);
    expect(screen.getByText(/VIV Lugar a \| - \|/)).toBeTruthy();
  });

  it('un FALLO al leer no se pinta como «no hay lugares»: se dice y se puede reintentar', async () => {
    mockSug.fallo = 'x';
    await render(<ParaTiWeb />);
    expect(screen.getByText('No pudimos cargar lo que encaja contigo')).toBeTruthy();
    expect(screen.queryByText(/Todavía no hay lugares/)).toBeNull();
    await fireEvent.press(screen.getByLabelText('Reintentar'));
    expect(reintentar).toHaveBeenCalled();
  });

  it('sin lugares lo dice y ofrece explorar', async () => {
    await render(<ParaTiWeb />);
    expect(screen.getByText(/Todavía no hay lugares que encajen/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Explorar lugares'));
    expect(mockPush).toHaveBeenCalledWith('/departamentos');
  });

  it('mientras carga reserva el lugar con esqueletos, no afirma que no hay nada', async () => {
    mockSug.cargando = true;
    await render(<ParaTiWeb />);
    expect(screen.getByLabelText('Cargando')).toBeTruthy();
    expect(screen.queryByText(/Todavía no hay lugares/)).toBeNull();
  });
});

describe('roomies, búsqueda y mensajes', () => {
  it('roomies sugeridos: los primeros tres', async () => {
    mockRoom.roomies = [1, 2, 3, 4].map((n) => ({ id: `r${n}`, nombre_completo: `Persona ${n}`, foto_url: null }));
    await render(<ParaTiWeb />);
    expect(screen.getByText('ROOMIE Persona 1')).toBeTruthy();
    expect(screen.getByText('ROOMIE Persona 3')).toBeTruthy();
    expect(screen.queryByText('ROOMIE Persona 4')).toBeNull();
  });

  it('un fallo en roomies se dice aparte, sin tumbar el resto de la página', async () => {
    mockRoom.fallo = 'x';
    mockSug.datos = [sug('a')];
    mockViv.publicaciones = [viv('a')];
    await render(<ParaTiWeb />);
    expect(screen.getByText('No pudimos cargar los roomies')).toBeTruthy();
    expect(screen.getByText(/VIV Lugar a/)).toBeTruthy();
  });

  it('«Tu búsqueda» enseña lo que la persona declaró, tal cual', async () => {
    await render(<ParaTiWeb />);
    expect(screen.getByText('Hasta $4,500')).toBeTruthy();
    expect(screen.getByText('5 km')).toBeTruthy();
    expect(screen.getByText('UTVT')).toBeTruthy();
  });

  it('sin perfil leído por un fallo lo dice (no pinta «sin presupuesto»)', async () => {
    Object.assign(mockPerfil, { perfil: null, error: 'x' });
    await render(<ParaTiWeb />);
    expect(screen.getByText('No pudimos leer tu búsqueda')).toBeTruthy();
    expect(screen.queryByText(/Sin presupuesto/)).toBeNull();
  });

  it('los mensajes: quién, qué dijo y cuántos sin leer; tocar lleva a los chats', async () => {
    mockChats.conversaciones = [conv('c1', 'Valeria Soto', 2), conv('c2', 'Jorge Jiménez', 0)];
    await render(<ParaTiWeb />);
    expect(screen.getByText('Valeria Soto')).toBeTruthy();
    expect(screen.getByLabelText('Conversación con Valeria Soto, 2 sin leer')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Conversación con Jorge Jiménez'));
    expect(mockPush).toHaveBeenCalledWith('/chats?c=c2');
  });

  it('sin conversaciones lo dice; con fallo, no', async () => {
    const { unmount } = await render(<ParaTiWeb />);
    expect(screen.getByText('Sin mensajes todavía')).toBeTruthy();
    await unmount();
    mockChats.fallo = 'x';
    await render(<ParaTiWeb />);
    expect(screen.queryByText('Sin mensajes todavía')).toBeNull();
    expect(screen.getByText('No pudimos cargar tus mensajes')).toBeTruthy();
  });
});

describe('buscar', () => {
  it('el buscador abre la búsqueda en /departamentos', async () => {
    await render(<ParaTiWeb />);
    await fireEvent.press(screen.getByLabelText('Buscar'));
    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/departamentos' }));
  });
});
