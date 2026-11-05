import { fireEvent, render, screen } from '@testing-library/react-native';

// Mi panel en la web: los MISMOS números que el de la app. Un paso de verificación y lo lleva a él; una cifra que no llegó es «—» (nunca 0); no promete lo que no hay; y lo propio se ve bloqueado hasta verificar.

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/components/web/PaginaSesionWeb', () => ({ PaginaSesionWeb: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/components/web/CifraAnimadaWeb', () => {
  const { Text } = require('react-native');
  return { CifraAnimadaWeb: ({ valor }: { valor: number }) => <Text>{`n:${valor}`}</Text> };
});
const mockPanel = jest.fn();
jest.mock('@/hooks/use-panel-vendedor', () => ({ usePanelVendedor: () => mockPanel() }));

import { PanelWeb } from '../PanelWeb';

const base = () => ({
  roles: [{ rol: 'arrendador', estado: 'aprobado', origen: 'solicitud' }],
  falloRoles: false,
  reintentarRoles: jest.fn(),
  paso: { tipo: 'listo', rol: null, heredada: false } as { tipo: string; rol?: string | null },
  publica: true,
  rolPlan: 'arrendador',
  suscripcion: null as null | Record<string, unknown>,
  destaca: false,
  ofreceProductos: false,
  ofrecePublicaciones: true,
  totalProductos: null as number | null,
  publicacionesActivas: 3 as number | null,
  sinLeer: 2 as number | null,
  favoritos: 5 as number | null,
  esTienda: false,
  negocios: { negocios: [], cargando: false, fallo: false, reintentar: jest.fn() },
  primerNegocio: undefined as undefined | { id: string; nombre: string },
  tienda: { fallo: false },
  productosDeTienda: [] as unknown[],
  categorias: [] as string[],
  estrellas: 0,
  maxEstrellas: 3,
});
const con = (extra: Record<string, unknown> = {}) => mockPanel.mockReturnValue({ ...base(), ...extra });
beforeEach(() => {
  jest.clearAllMocks();
  con();
});

describe('verificación: UN paso, el que más urge', () => {
  it('sin verificar: pide empezar y lleva a la verificación de ESE rol', async () => {
    con({ paso: { tipo: 'empezar', rol: 'comerciante' }, publica: false });
    await render(<PanelWeb />);
    await fireEvent.press(screen.getByLabelText('Empezar verificación'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/verificacion/[rol]', params: { rol: 'comerciante' } });
  });
  it('rechazada: pide volver a enviarla', async () => {
    con({ paso: { tipo: 'reenviar', rol: 'arrendador' } });
    await render(<PanelWeb />);
    await fireEvent.press(screen.getByLabelText('Volver a enviar mi verificación'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/verificacion/[rol]', params: { rol: 'arrendador' } });
  });
  it('en revisión: dice que se espera y NO ofrece empezar', async () => {
    con({ paso: { tipo: 'esperar', rol: 'arrendador' } });
    await render(<PanelWeb />);
    expect(screen.getByText('En revisión')).toBeTruthy();
    expect(screen.queryByLabelText('Empezar verificación')).toBeNull();
  });
  it('todo aprobado: no hay tarjeta de verificación', async () => {
    await render(<PanelWeb />);
    expect(screen.queryByText('VERIFICACIÓN')).toBeNull();
  });
  it('si FALLÓ saber el paso, lo dice (ni «verifica» ni «sin verificar») y no enseña lo propio', async () => {
    con({ falloRoles: true, paso: null });
    await render(<PanelWeb />);
    expect(screen.getByText('No pudimos comprobar tu verificación')).toBeTruthy();
    expect(screen.queryByText('Mis publicaciones')).toBeNull();
  });
});

describe('cifras', () => {
  it('enseña los números de verdad', async () => {
    await render(<PanelWeb />);
    expect(screen.getByLabelText('Publicaciones activas: 3')).toBeTruthy();
    expect(screen.getByLabelText('Mensajes sin leer: 2')).toBeTruthy();
    expect(screen.getByLabelText('Favoritos: 5')).toBeTruthy();
  });
  it('un dato que no llegó es «—», no un 0', async () => {
    con({ sinLeer: null, favoritos: null });
    await render(<PanelWeb />);
    expect(screen.getByLabelText('Mensajes sin leer: sin dato')).toBeTruthy();
    expect(screen.getByLabelText('Favoritos: sin dato')).toBeTruthy();
    expect(screen.queryByText('n:0')).toBeNull();
  });
  it('un 0 de verdad se pinta 0', async () => {
    con({ favoritos: 0 });
    await render(<PanelWeb />);
    expect(screen.getByLabelText('Favoritos: 0')).toBeTruthy();
  });
  it('un arrendador no ve productos; un comerciante no ve publicaciones', async () => {
    const r = await render(<PanelWeb />);
    expect(screen.queryByLabelText(/Productos:/)).toBeNull();
    con({ ofreceProductos: true, ofrecePublicaciones: false, totalProductos: 4 });
    await r.rerender(<PanelWeb />);
    expect(screen.getByLabelText('Productos: 4')).toBeTruthy();
    expect(screen.queryByLabelText(/Publicaciones activas:/)).toBeNull();
  });
});

describe('plan', () => {
  it('con prueba disponible ofrece empezarla (lleva a los planes de SU rol); siempre ofrece ver plan y pagos', async () => {
    con({ rolPlan: 'comerciante', suscripcion: { estado: 'gratis', prueba_disponible: true, destaca: false } });
    await render(<PanelWeb />);
    await fireEvent.press(screen.getByLabelText('Empezar prueba gratis'));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/planes/[rol]', params: { rol: 'comerciante' } });
    await fireEvent.press(screen.getByLabelText('Ver mi plan y pagos'));
    expect(mockPush).toHaveBeenLastCalledWith('/pagos');
  });
  it('«Destacado» solo si el plan destaca, y dice dónde', async () => {
    const r = await render(<PanelWeb />);
    expect(screen.queryByText('Destacado')).toBeNull();
    con({ destaca: true, rolPlan: 'arrendador' });
    await r.rerender(<PanelWeb />);
    expect(screen.getByText('Destacado')).toBeTruthy();
    expect(screen.getByText('Apareces primero en Departamentos.')).toBeTruthy();
  });
});

describe('lo propio y la tienda', () => {
  it('lo propio está bloqueado hasta verificar, y abierto después', async () => {
    con({ publica: false });
    const r = await render(<PanelWeb />);
    expect(screen.getByText('Bloqueado hasta verificar tu identidad')).toBeTruthy();
    con({ publica: true });
    await r.rerender(<PanelWeb />);
    await fireEvent.press(screen.getByLabelText('Abrir Mis publicaciones'));
    expect(mockPush).toHaveBeenLastCalledWith('/(tabs)/publicar');
  });
  it('tienda sin negocio ofrece publicarlo; con negocio enseña lo que tiene y deja agregar producto', async () => {
    con({ esTienda: true });
    const r = await render(<PanelWeb />);
    await fireEvent.press(screen.getByLabelText('Publicar mi negocio'));
    expect(mockPush).toHaveBeenLastCalledWith('/negocio/nuevo');
    con({ esTienda: true, primerNegocio: { id: 'n1', nombre: 'Café La Parada' }, productosDeTienda: [{}, {}], categorias: ['Bebidas', 'Postres'], estrellas: 1 });
    await r.rerender(<PanelWeb />);
    expect(screen.getByText('Café La Parada')).toBeTruthy();
    expect(screen.getByText('2 productos')).toBeTruthy();
    expect(screen.getByText('Categorías: Bebidas · Postres')).toBeTruthy();
    expect(screen.getByText('Destacados: 1 de 3')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Agregar producto'));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/negocio/menu/[id]', params: { id: 'n1' } });
  });
  it('si falla cargar la tienda, lo dice', async () => {
    con({ esTienda: true, negocios: { negocios: [], cargando: false, fallo: true, reintentar: jest.fn() } });
    await render(<PanelWeb />);
    expect(screen.getByText('No pudimos cargar tu tienda')).toBeTruthy();
  });
});
