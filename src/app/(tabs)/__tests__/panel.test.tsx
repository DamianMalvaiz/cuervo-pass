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
const mockProductos = jest.fn();
const mockMiNegocio = jest.fn();
const mockFavPubs = jest.fn();
const mockFavNegocios = jest.fn();
jest.mock('@/hooks/queries/useRoles', () => ({ useMisRoles: (...a: unknown[]) => mockRoles(...a) }));
jest.mock('@/hooks/queries/useChat', () => ({ useConversaciones: (...a: unknown[]) => mockConversaciones(...a) }));
jest.mock('@/hooks/queries/usePublicaciones', () => ({ useMisPublicaciones: (...a: unknown[]) => mockPublicaciones(...a) }));
jest.mock('@/hooks/queries/useMisNegocios', () => ({
  useMisNegocios: (...a: unknown[]) => mockNegocios(...a),
  useMisProductosConteo: (...a: unknown[]) => mockProductos(...a),
  useMiNegocio: (...a: unknown[]) => mockMiNegocio(...a),
}));
jest.mock('@/hooks/queries/useFavoritos', () => ({ useConteoFavoritos: (...a: unknown[]) => mockFavPubs(...a) }));
jest.mock('@/hooks/queries/useFavoritosNegocios', () => ({ useConteoFavoritosDeMisNegocios: (...a: unknown[]) => mockFavNegocios(...a) }));
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
  mockProductos.mockReturnValue({ total: 0, cargando: false, fallo: false });
  mockMiNegocio.mockReturnValue({ negocio: null, items: [], turnos: [], cargando: false, fallo: false, reintentar: jest.fn() });
  mockFavPubs.mockReturnValue({ conteos: new Map(), cargando: false, fallo: false });
  mockFavNegocios.mockReturnValue({ conteos: new Map(), cargando: false, fallo: false });
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

  describe('cada función enseña lo suyo', () => {
    it('un arrendador ve sus PUBLICACIONES activas y no ve productos', async () => {
      mockPublicaciones.mockReturnValue({ datos: [{ id: 'p1', activa: true }, { id: 'p2', activa: false }], cargando: false, fallo: null });
      await render(<PanelScreen />);
      expect(screen.getByLabelText('Publicaciones activas: 1')).toBeTruthy();
      expect(screen.queryByLabelText(/^Productos/)).toBeNull();
    });

    it('un comerciante ve sus PRODUCTOS y no ve publicaciones', async () => {
      mockRoles.mockReturnValue(roles(rol('comerciante', 'aprobado')));
      mockProductos.mockReturnValue({ total: 12, cargando: false, fallo: false });
      await render(<PanelScreen />);
      expect(screen.getByLabelText('Productos: 12')).toBeTruthy();
      expect(screen.queryByLabelText(/^Publicaciones activas/)).toBeNull();
    });

    it('con las dos funciones ve las dos cifras', async () => {
      mockRoles.mockReturnValue(roles(rol('comerciante', 'aprobado'), rol('arrendador', 'aprobado')));
      mockProductos.mockReturnValue({ total: 5, cargando: false, fallo: false });
      mockPublicaciones.mockReturnValue({ datos: [{ id: 'p1', activa: true }], cargando: false, fallo: null });
      await render(<PanelScreen />);
      expect(screen.getByLabelText('Productos: 5')).toBeTruthy();
      expect(screen.getByLabelText('Publicaciones activas: 1')).toBeTruthy();
    });

    it('un producto que todavía no se cuenta es «sin dato», no 0', async () => {
      mockRoles.mockReturnValue(roles(rol('comerciante', 'aprobado')));
      mockProductos.mockReturnValue({ total: null, cargando: true, fallo: false });
      await render(<PanelScreen />);
      expect(screen.getByLabelText('Productos: sin dato')).toBeTruthy();
    });

    it('si falla el conteo de productos tampoco es 0', async () => {
      mockRoles.mockReturnValue(roles(rol('comerciante', 'aprobado')));
      mockProductos.mockReturnValue({ total: null, cargando: false, fallo: true });
      await render(<PanelScreen />);
      expect(screen.getByLabelText('Productos: sin dato')).toBeTruthy();
    });
  });

  describe('favoritos: cuántas personas guardaron lo mío', () => {
    it('suma los de mis publicaciones y los de mis negocios', async () => {
      mockRoles.mockReturnValue(roles(rol('comerciante', 'aprobado'), rol('arrendador', 'aprobado')));
      mockPublicaciones.mockReturnValue({ datos: [{ id: 'p1', activa: true }], cargando: false, fallo: null });
      mockNegocios.mockReturnValue({ negocios: [{ id: 'n1' }], cargando: false, fallo: false, reintentar: jest.fn() });
      mockFavPubs.mockReturnValue({ conteos: new Map([['p1', 2]]), cargando: false, fallo: false });
      mockFavNegocios.mockReturnValue({ conteos: new Map([['n1', 5]]), cargando: false, fallo: false });
      await render(<PanelScreen />);
      expect(screen.getByLabelText('Favoritos: 7')).toBeTruthy();
    });

    it('pregunta por MIS publicaciones y MIS negocios, no por otros', async () => {
      mockPublicaciones.mockReturnValue({ datos: [{ id: 'p1', activa: true }], cargando: false, fallo: null });
      mockNegocios.mockReturnValue({ negocios: [{ id: 'n1' }], cargando: false, fallo: false, reintentar: jest.fn() });
      await render(<PanelScreen />);
      expect(mockFavPubs).toHaveBeenCalledWith(['p1']);
      expect(mockFavNegocios).toHaveBeenCalledWith(['n1']);
    });

    it('sin nada publicado son 0: es un hecho, no falta un dato', async () => {
      await render(<PanelScreen />);
      expect(screen.getByLabelText('Favoritos: 0')).toBeTruthy();
    });

    it('si falla cualquiera de los dos conteos, «sin dato»', async () => {
      mockPublicaciones.mockReturnValue({ datos: [{ id: 'p1', activa: true }], cargando: false, fallo: null });
      mockFavPubs.mockReturnValue({ conteos: new Map(), cargando: false, fallo: true });
      await render(<PanelScreen />);
      expect(screen.getByLabelText('Favoritos: sin dato')).toBeTruthy();
    });

    it('mientras cargan, «sin dato», no un 0 provisional', async () => {
      mockPublicaciones.mockReturnValue({ datos: [{ id: 'p1', activa: true }], cargando: false, fallo: null });
      mockFavPubs.mockReturnValue({ conteos: new Map(), cargando: true, fallo: false });
      await render(<PanelScreen />);
      expect(screen.getByLabelText('Favoritos: sin dato')).toBeTruthy();
    });
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
    // Con la verificación hecha: sin ella la fila está bloqueada (ver «publicar exige la verificación hecha»).
    mockRoles.mockReturnValue(roles(rol('arrendador', 'aprobado')));
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

describe('publicar exige la verificación hecha', () => {
  it('sin verificar, la fila de lo que publica está bloqueada y dice cuándo se abre', async () => {
    mockRoles.mockReturnValue(roles(rol('comerciante', 'sin_verificar')));
    await render(<PanelScreen />);
    const fila = screen.getByLabelText(/Disponible cuando te verifiquemos/);
    expect(fila.props.accessibilityState).toMatchObject({ disabled: true });
    await act(async () => { fireEvent.press(fila); });
    expect(mockPush).not.toHaveBeenCalledWith('/(tabs)/publicar');
  });

  it('en revisión también está bloqueada', async () => {
    mockRoles.mockReturnValue(roles(rol('arrendador', 'pendiente')));
    await render(<PanelScreen />);
    expect(screen.getByLabelText(/Disponible cuando te verifiquemos/)).toBeTruthy();
  });

  it('aprobada, la fila lleva a publicar', async () => {
    mockRoles.mockReturnValue(roles(rol('comerciante', 'aprobado')));
    await render(<PanelScreen />);
    expect(screen.queryByLabelText(/Disponible cuando te verifiquemos/)).toBeNull();
    await act(async () => { fireEvent.press(screen.getByLabelText(/Mis negocios/)); });
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/publicar');
  });
});

describe('cuando FALLA la conexión se dice, no se pinta como «sin verificar» ni como cero', () => {
  it('si fallan las funciones: no enseña el paso de verificar ni la fila bloqueada, y ofrece reintentar', async () => {
    const reintentar = jest.fn();
    mockRoles.mockReturnValue({ roles: [], cargando: false, fallo: true, reintentar });
    await render(<PanelScreen />);
    expect(screen.queryByText(/Verifica tu identidad/)).toBeNull();
    expect(screen.queryByLabelText(/Disponible cuando te verifiquemos/)).toBeNull();
    expect(screen.getByText('No pudimos comprobar tu verificación')).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByLabelText('Reintentar')); });
    expect(reintentar).toHaveBeenCalledTimes(1);
  });

  it('si fallan mis publicaciones, «Publicaciones activas» dice «sin dato», no 0', async () => {
    mockPublicaciones.mockReturnValue({ datos: [], cargando: false, fallo: 'x' });
    await render(<PanelScreen />);
    expect(screen.getByLabelText('Publicaciones activas: sin dato')).toBeTruthy();
  });
});

describe('el plan dice si destaca', () => {
  const plan = (extra: Record<string, unknown>) => mockSuscripcion.mockReturnValue({
    suscripcion: { plan_id: 'x', plan_nombre: 'Plus', hasta: '2099-01-01T00:00:00Z', destaca: false, ...extra }, cargando: false, fallo: false, reintentar: jest.fn(),
  });

  it('con un plan vigente que destaca: lo dice y dice dónde', async () => {
    mockRoles.mockReturnValue(roles(rol('comerciante', 'aprobado')));
    plan({ estado: 'vigente', destaca: true });
    await render(<PanelScreen />);
    expect(screen.getByText('Destacado')).toBeTruthy();
    expect(screen.getByText(/Apareces primero en Servicios/)).toBeTruthy();
  });

  it('un arrendador destacado aparece primero en Departamentos', async () => {
    mockRoles.mockReturnValue(roles(rol('arrendador', 'aprobado')));
    plan({ estado: 'prueba', destaca: true });
    await render(<PanelScreen />);
    expect(screen.getByText(/Apareces primero en Departamentos/)).toBeTruthy();
  });

  it('sin destacar no hay insignia ni promesa', async () => {
    plan({ estado: 'vigente', destaca: false });
    await render(<PanelScreen />);
    expect(screen.queryByText('Destacado')).toBeNull();
    expect(screen.queryByText(/Apareces primero/)).toBeNull();
  });

  it('un plan sin plan (gratis) que por error dijera destaca no promete nada: solo vigente o en prueba', async () => {
    plan({ estado: 'gratis', destaca: true });
    await render(<PanelScreen />);
    expect(screen.queryByText(/Apareces primero/)).toBeNull();
  });
});

describe('Mi tienda (comerciante)', () => {
  const comerciante = () => mockRoles.mockReturnValue(roles(rol('comerciante', 'aprobado')));
  const negocio = { id: 'n1', nombre: 'Lavandería Burbuja', activo: true };
  const conNegocio = (items: unknown[]) => {
    mockNegocios.mockReturnValue({ negocios: [negocio], cargando: false, fallo: false, reintentar: jest.fn() });
    mockMiNegocio.mockReturnValue({ negocio, items, turnos: [], cargando: false, fallo: false, reintentar: jest.fn() });
  };
  const item = (id: string, seccion: string | null, estrella = false) => ({ id, nombre: id, seccion, estrella });

  it('enseña el negocio, cuántos productos tiene y sus categorías', async () => {
    comerciante();
    conNegocio([item('a', 'Lavado'), item('b', 'Lavado'), item('c', 'Planchado')]);
    await render(<PanelScreen />);
    expect(screen.getByText('Mi tienda')).toBeTruthy();
    expect(screen.getByText('Lavandería Burbuja')).toBeTruthy();
    expect(screen.getByText(/3 productos/)).toBeTruthy();
    expect(screen.getByText(/Lavado · Planchado/)).toBeTruthy();
  });

  it('dice cuántos productos estrella lleva, del tope de 6', async () => {
    comerciante();
    conNegocio([item('a', 'Lavado', true), item('b', 'Lavado')]);
    await render(<PanelScreen />);
    expect(screen.getByText(/Destacados: 1 de 6/)).toBeTruthy();
  });

  it('«Agregar producto» abre el menú de ESE negocio', async () => {
    comerciante();
    conNegocio([item('a', 'Lavado')]);
    await render(<PanelScreen />);
    await act(async () => { fireEvent.press(screen.getByLabelText('Agregar producto')); });
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/negocio/menu/[id]', params: { id: 'n1' } });
  });

  it('un solo producto se dice en singular', async () => {
    comerciante();
    conNegocio([item('a', null)]);
    await render(<PanelScreen />);
    expect(screen.getByText(/^1 producto/)).toBeTruthy();
  });

  it('verificado y sin negocio: ofrece publicarlo', async () => {
    comerciante();
    await render(<PanelScreen />);
    await act(async () => { fireEvent.press(screen.getByLabelText('Publicar mi negocio')); });
    expect(mockPush).toHaveBeenCalledWith('/negocio/nuevo');
  });

  it('SIN verificar no se ofrece publicar: primero la verificación', async () => {
    mockRoles.mockReturnValue(roles(rol('comerciante', 'sin_verificar')));
    await render(<PanelScreen />);
    expect(screen.queryByLabelText('Publicar mi negocio')).toBeNull();
    expect(screen.queryByText('Mi tienda')).toBeNull();
  });

  it('un arrendador no tiene tienda', async () => {
    mockRoles.mockReturnValue(roles(rol('arrendador', 'aprobado')));
    await render(<PanelScreen />);
    expect(screen.queryByText('Mi tienda')).toBeNull();
  });

  it('si falla la lectura de mis negocios no dice «aún no publicas»: dice que falló', async () => {
    comerciante();
    mockNegocios.mockReturnValue({ negocios: [], cargando: false, fallo: true, reintentar: jest.fn() });
    await render(<PanelScreen />);
    expect(screen.queryByLabelText('Publicar mi negocio')).toBeNull();
    expect(screen.getByText('No pudimos cargar tu tienda')).toBeTruthy();
  });
});
