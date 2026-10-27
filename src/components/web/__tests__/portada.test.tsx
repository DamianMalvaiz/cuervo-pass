import { fireEvent, render, screen } from '@testing-library/react-native';

// La portada de inicio (`/`): una vitrina con el hero y un adelanto de cada sección. Cada sección tiene su propia página, así que aquí todo LLEVA a ella: el buscador y los chips abren `/departamentos` ya filtrado,
// y «Ver todos» lleva a su página. Lo que se fija: a dónde lleva cada cosa, que un fallo no se pinte como «no hay nada» (END-11) y que lo ilustrativo se diga ilustrativo.

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
const mockHead = jest.fn();
jest.mock('expo-router/head', () => ({
  __esModule: true,
  default: (props: unknown) => {
    mockHead(props);
    return null;
  },
}));
jest.mock('@/hooks/use-tamano-pantalla', () => ({
  useTamanoPantalla: () => ({ clase: 'amplia', ancho: 1280, alto: 900, anchoContenido: 480, anchoLista: 800, altoApretado: false, escalaTitulo: 1 }),
}));

const mockPub = { publicaciones: [] as unknown[], cargando: false, fallo: false, reintentar: jest.fn() };
const mockNeg = { negocios: [] as unknown[], cargando: false, fallo: false, reintentar: jest.fn() };
jest.mock('@/hooks/queries/useExplorar', () => ({
  usePublicacionesPublicas: () => mockPub,
  useNegociosPublicos: () => mockNeg,
  useFotosPublicas: () => ({ fotos: [], cargando: false, fallo: false }),
}));

import { PortadaWeb } from '../PortadaWeb';

const lugar = (i: number) => ({ id: `p${i}`, titulo_publico: `Lugar ${i}`, tipo: 'cuarto', precio_renta: 2000 + i, zona: 'Lerma, México', num_fotos: 0, destacado: false, calificacion: null, num_resenas: null });
const negocio = (i: number) => ({ id: `n${i}`, nombre: `Negocio ${i}`, zona: 'Centro, Lerma', abierto_ahora: true, calificacion: null, num_fotos: 0, destacado: false });

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockPub, { publicaciones: [1, 2, 3, 4, 5].map(lugar), cargando: false, fallo: false });
  Object.assign(mockNeg, { negocios: [1, 2, 3, 4, 5].map(negocio), cargando: false, fallo: false });
});

describe('el hero', () => {
  it('dice qué es y deja entrar o crear cuenta', async () => {
    await render(<PortadaWeb />);
    expect(screen.getByText(/Encuentra dónde/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Iniciar sesión'));
    expect(mockPush).toHaveBeenLastCalledWith('/(auth)/login');
    await fireEvent.press(screen.getByLabelText('Crear cuenta'));
    expect(mockPush).toHaveBeenLastCalledWith('/(auth)/registro');
  });

  it('pone el título de la pestaña del navegador', async () => {
    await render(<PortadaWeb />);
    const hijo = (mockHead.mock.calls[0][0] as { children: { props: { children: string } } }).children;
    expect(hijo.props.children).toMatch(/^Cuervo 360 · /);
  });

  it('Buscar abre la página de departamentos con la búsqueda en la URL', async () => {
    await render(<PortadaWeb />);
    await fireEvent.changeText(screen.getByLabelText('Zona o colonia'), 'Lerma');
    await fireEvent.changeText(screen.getByLabelText('Presupuesto máximo al mes'), '4000');
    await fireEvent.press(screen.getByLabelText('Buscar'));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/departamentos', params: { zona: 'Lerma', presupuesto: '4000' } });
  });

  it('Buscar sin llenar nada abre la página sin filtros', async () => {
    await render(<PortadaWeb />);
    await fireEvent.press(screen.getByLabelText('Buscar'));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/departamentos', params: {} });
  });

  it('los chips de tipo abren la página ya filtrada', async () => {
    await render(<PortadaWeb />);
    await fireEvent.press(screen.getByLabelText('Filtrar por cuartos'));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/departamentos', params: { tipo: 'cuarto' } });
    await fireEvent.press(screen.getByLabelText('Filtrar por acepta mascotas'));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/departamentos', params: { mascotas: '1' } });
  });
});

describe('los adelantos de cada sección', () => {
  it('lugares: enseña una fila y «Ver todos» lleva a su página', async () => {
    await render(<PortadaWeb />);
    expect(screen.getByText('Departamentos y cuartos')).toBeTruthy();
    expect(screen.queryAllByLabelText(/pesos al mes/)).toHaveLength(4);
    await fireEvent.press(screen.getByLabelText('Ver todos los lugares'));
    expect(mockPush).toHaveBeenLastCalledWith('/departamentos');
  });

  it('negocios: el mosaico y «Ver todos» lleva a su página', async () => {
    await render(<PortadaWeb />);
    expect(screen.getByText('Negocios cerca')).toBeTruthy();
    expect(screen.getByText('Negocio 1')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Ver todos los negocios'));
    expect(mockPush).toHaveBeenLastCalledWith('/servicios');
  });

  it('roomies: de qué trata y «Ver roomies» lleva a su página', async () => {
    await render(<PortadaWeb />);
    expect(screen.getByText('Con quién vives importa tanto como dónde')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Ver roomies'));
    expect(mockPush).toHaveBeenLastCalledWith('/roomies');
  });

  it('trae «Cómo funciona» y la confianza; lo ilustrativo dice «Ejemplo»', async () => {
    await render(<PortadaWeb />);
    expect(screen.getByText('Cómo funciona, sin adivinar')).toBeTruthy();
    expect(screen.getByText('Hecho para que confíes')).toBeTruthy();
    expect(screen.getAllByText('Ejemplo').length).toBeGreaterThan(1);
    expect(screen.getByText(/Proyecto académico de la UTVT/)).toBeTruthy();
  });
});

describe('estados de lectura', () => {
  it('si fallan los lugares lo dice (con reintento), no «todavía no hay»', async () => {
    Object.assign(mockPub, { publicaciones: [], fallo: true });
    await render(<PortadaWeb />);
    expect(screen.queryByText(/Todavía no hay lugares/)).toBeNull();
    await fireEvent.press(screen.getAllByLabelText('Reintentar')[0]);
    expect(mockPub.reintentar).toHaveBeenCalled();
  });

  it('si fallan los negocios lo dice y los lugares siguen a la vista', async () => {
    Object.assign(mockNeg, { negocios: [], fallo: true });
    await render(<PortadaWeb />);
    expect(screen.queryAllByLabelText(/pesos al mes/).length).toBeGreaterThan(0);
    await fireEvent.press(screen.getAllByLabelText('Reintentar')[0]);
    expect(mockNeg.reintentar).toHaveBeenCalled();
  });

  it('sin nada publicado lo dice sin alarmar', async () => {
    Object.assign(mockPub, { publicaciones: [] });
    Object.assign(mockNeg, { negocios: [] });
    await render(<PortadaWeb />);
    expect(screen.getByText(/Todavía no hay lugares publicados/)).toBeTruthy();
    expect(screen.getByText(/Todavía no hay negocios publicados/)).toBeTruthy();
  });
});
