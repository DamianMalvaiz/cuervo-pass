import { fireEvent, render, screen } from '@testing-library/react-native';

// «Guardados»: cuatro pestañas (Favoritos, Vistos, Búsquedas, Comparar). Cada una dice su cuenta SOLO cuando se sabe (nunca un 0 que mienta) y tiene sus cuatro estados distintos: cargando, FALLÓ, vacío y lista.

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/hooks/use-tamano-pantalla', () => ({ useTamanoPantalla: () => ({ ancho: 1440, alto: 900, clase: 'amplia' }) }));
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }) }));
jest.mock('../PaginaSesionWeb', () => ({ PaginaSesionWeb: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('../FavoritosWeb', () => ({ FavoritosWeb: () => require('react').createElement(require('react-native').Text, null, 'CONTENIDO DE FAVORITOS') }));
jest.mock('../EsqueletoWeb', () => ({
  EsqueletoTarjetasWeb: () => require('react').createElement(require('react-native').Text, null, 'esqueleto-tarjetas'),
  EsqueletoFilasWeb: () => require('react').createElement(require('react-native').Text, null, 'esqueleto-filas'),
}));
jest.mock('../TarjetaPublicacionWeb', () => ({ TarjetaPublicacionWeb: ({ p }: { p: { titulo_publico: string } }) => require('react').createElement(require('react-native').Text, null, `VIV ${p.titulo_publico}`) }));

const mockIdsPub = { ids: new Set<string>(), cargando: false, fallo: false };
const mockIdsNeg = { ids: new Set<string>(), cargando: false, fallo: false };
jest.mock('@/hooks/queries/useFavoritos', () => ({ useMisFavoritosIds: () => mockIdsPub }));
jest.mock('@/hooks/queries/useFavoritosNegocios', () => ({ useMisNegociosFavoritosIds: () => mockIdsNeg }));
const reintentar = jest.fn();
const mockViv = { publicaciones: [] as { id: string; titulo_publico: string }[], cargando: false, fallo: false, reintentar };
jest.mock('@/hooks/queries/useExplorar', () => ({ usePublicacionesPorIds: () => mockViv }));
const mockBus = { busquedas: [] as { id: string; nombre: string; filtros: Record<string, string> }[], cargando: false, fallo: false, reintentar };
const mockBorrar = jest.fn();
jest.mock('@/hooks/queries/useBusquedasGuardadas', () => ({ useBusquedasGuardadas: () => mockBus, useBorrarBusqueda: () => ({ mutate: (...a: unknown[]) => mockBorrar(...a) }) }));
const mockVistos = { ids: [] as string[] };
jest.mock('@/hooks/use-vistos', () => ({ useVistos: () => mockVistos.ids }));
const mockComp = { ids: [] as string[] };
jest.mock('@/hooks/use-comparar', () => ({ useComparar: () => ({ ids: mockComp.ids, lleno: false, alternar: jest.fn() }) }));
const mockBorrarVistos = jest.fn();
jest.mock('@/lib/vistos', () => ({ borrarVistos: () => mockBorrarVistos() }));
const mockVaciar = jest.fn();
jest.mock('@/lib/comparar', () => ({ vaciarComparar: () => mockVaciar() }));
const mockError = jest.fn();
jest.mock('@/lib/toast', () => ({ toast: { error: (...a: unknown[]) => mockError(...a), exito: jest.fn(), info: jest.fn() } }));

import { GuardadosWeb } from '../GuardadosWeb';

const abrir = async (nombre: RegExp | string) => fireEvent.press(screen.getByRole('tab', { name: nombre }));

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockIdsPub, { ids: new Set(), cargando: false, fallo: false });
  Object.assign(mockIdsNeg, { ids: new Set(), cargando: false, fallo: false });
  Object.assign(mockViv, { publicaciones: [], cargando: false, fallo: false });
  Object.assign(mockBus, { busquedas: [], cargando: false, fallo: false });
  mockVistos.ids = [];
  mockComp.ids = [];
});

describe('las pestañas y sus cuentas', () => {
  it('abre en Favoritos y dice cuántas hay en cada una', async () => {
    mockIdsPub.ids = new Set(['a', 'b']);
    mockIdsNeg.ids = new Set(['n']);
    mockVistos.ids = ['v1', 'v2', 'v3', 'v4'];
    mockBus.busquedas = [{ id: 'b1', nombre: 'Lerma', filtros: {} }];
    mockComp.ids = ['c1', 'c2'];
    await render(<GuardadosWeb />);
    expect(screen.getByText('CONTENIDO DE FAVORITOS')).toBeTruthy();
    expect(screen.getByLabelText('Favoritos (3)')).toBeTruthy();
    expect(screen.getByLabelText('Vistos (4)')).toBeTruthy();
    expect(screen.getByLabelText('Búsquedas (1)')).toBeTruthy();
    expect(screen.getByLabelText('Comparar (2)')).toBeTruthy();
  });

  it('una cuenta que no se sabe (cargando o falló) NO se pinta: nunca un 0 que mienta', async () => {
    mockIdsPub.fallo = true;
    mockBus.cargando = true;
    await render(<GuardadosWeb />);
    expect(screen.getByLabelText('Favoritos')).toBeTruthy();
    expect(screen.getByLabelText('Búsquedas')).toBeTruthy();
    expect(screen.queryByLabelText(/Favoritos \(/)).toBeNull();
  });

  it('tocar una pestaña cambia el contenido y la marca como seleccionada', async () => {
    await render(<GuardadosWeb />);
    await abrir(/Vistos/);
    expect(screen.queryByText('CONTENIDO DE FAVORITOS')).toBeNull();
    expect(screen.getByRole('tab', { name: /Vistos/ }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByRole('tab', { name: /Favoritos/ }).props.accessibilityState.selected).toBe(false);
  });
});

describe('Vistos', () => {
  it('vacío lo dice y ofrece explorar', async () => {
    await render(<GuardadosWeb />);
    await abrir(/Vistos/);
    expect(screen.getByText(/Todavía no has abierto ningún lugar/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Explorar lugares'));
    expect(mockPush).toHaveBeenCalledWith('/departamentos');
  });
  it('con vistos enseña los lugares en su orden y se puede borrar el historial', async () => {
    mockVistos.ids = ['b', 'a'];
    mockViv.publicaciones = [{ id: 'a', titulo_publico: 'A' }, { id: 'b', titulo_publico: 'B' }];
    await render(<GuardadosWeb />);
    await abrir(/Vistos/);
    expect(screen.getAllByText(/^VIV /).map((n) => n.props.children)).toEqual(['VIV B', 'VIV A']);
    await fireEvent.press(screen.getByLabelText('Borrar el historial de vistos'));
    expect(mockBorrarVistos).toHaveBeenCalled();
  });
  it('un lugar que ya no es visible se DICE; un fallo no es «nada»; cargando reserva el sitio', async () => {
    mockVistos.ids = ['a', 'x'];
    mockViv.publicaciones = [{ id: 'a', titulo_publico: 'A' }];
    const r = await render(<GuardadosWeb />);
    await abrir(/Vistos/);
    expect(screen.getByText('1 lugar de esta lista ya no está disponible.')).toBeTruthy();
    mockViv.fallo = true;
    await r.rerender(<GuardadosWeb />);
    expect(screen.getByText('No pudimos cargar lo que viste')).toBeTruthy();
    expect(screen.queryByText(/Todavía no has abierto/)).toBeNull();
    Object.assign(mockViv, { fallo: false, cargando: true });
    await r.rerender(<GuardadosWeb />);
    expect(screen.getByText('esqueleto-tarjetas')).toBeTruthy();
  });
});

describe('Búsquedas', () => {
  it('vacío explica cómo guardar una', async () => {
    await render(<GuardadosWeb />);
    await abrir(/Búsquedas/);
    expect(screen.getByText(/toca «Guardar esta búsqueda»/)).toBeTruthy();
  });
  it('«Buscar» abre /departamentos con SUS filtros (validados) y la papelera borra ESA búsqueda', async () => {
    mockBus.busquedas = [{ id: 'b1', nombre: 'Lerma · Cuarto', filtros: { zona: 'Lerma', tipo: 'cuarto', presupuesto: '4000', raro: 'x' } }];
    await render(<GuardadosWeb />);
    await abrir(/Búsquedas/);
    await fireEvent.press(screen.getByLabelText('Buscar de nuevo: Lerma · Cuarto'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/departamentos', params: { zona: 'Lerma', presupuesto: '4000', tipo: 'cuarto' } });
    await fireEvent.press(screen.getByLabelText('Borrar la búsqueda guardada: Lerma · Cuarto'));
    expect(mockBorrar.mock.calls[0][0]).toBe('b1');
    mockBorrar.mock.calls[0][1].onError();
    expect(String(mockError.mock.calls[0][0])).toMatch(/No pudimos borrar/);
  });
  it('falló ≠ vacío ≠ cargando', async () => {
    mockBus.fallo = true;
    const r = await render(<GuardadosWeb />);
    await abrir(/Búsquedas/);
    expect(screen.getByText('No pudimos cargar tus búsquedas guardadas')).toBeTruthy();
    expect(screen.queryByText(/Aún no guardas ninguna búsqueda/)).toBeNull();
    Object.assign(mockBus, { fallo: false, cargando: true });
    await r.rerender(<GuardadosWeb />);
    expect(screen.getByText('esqueleto-filas')).toBeTruthy();
  });
});

describe('Comparar', () => {
  it('vacío explica cómo agregar', async () => {
    await render(<GuardadosWeb />);
    await abrir(/Comparar/);
    expect(screen.getByText(/toca «Comparar» \(hasta 3\)/)).toBeTruthy();
  });
  it('con uno solo pide agregar otro (no ofrece comparar); con dos o más lleva a la comparación; vaciar vacía', async () => {
    mockComp.ids = ['a'];
    mockViv.publicaciones = [{ id: 'a', titulo_publico: 'A' }, { id: 'b', titulo_publico: 'B' }];
    const r = await render(<GuardadosWeb />);
    await abrir(/Comparar/);
    expect(screen.getByText(/Agrega al menos un lugar más/)).toBeTruthy();
    expect(screen.queryByLabelText('Comparar lado a lado')).toBeNull();
    mockComp.ids = ['a', 'b'];
    await r.rerender(<GuardadosWeb />);
    await fireEvent.press(screen.getByLabelText('Comparar lado a lado'));
    expect(mockPush).toHaveBeenCalledWith('/comparar');
    await fireEvent.press(screen.getByLabelText('Vaciar la lista de comparar'));
    expect(mockVaciar).toHaveBeenCalled();
  });
  it('si falla la lectura lo dice', async () => {
    mockComp.ids = ['a'];
    mockViv.fallo = true;
    await render(<GuardadosWeb />);
    await abrir(/Comparar/);
    expect(screen.getByText('No pudimos cargar lo que quieres comparar')).toBeTruthy();
  });
});
