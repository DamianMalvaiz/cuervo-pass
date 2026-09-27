import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// V.8 · `inicio.tsx`, y sobre todo el membrete del nivel.
//
// END-08 fue el peor hallazgo del proyecto: `sugerencias_con_ranking`
// descartaba toda publicación sin embedding y `obtenerSugerencias` devolvía
// «Nivel 2» si había UNA sola fila. De veinte publicaciones viables con tres
// vectorizadas, el usuario veía tres y creía que ese era el catálogo. Lista
// incompleta, sin error y sin log — AUD-01 una capa más arriba.
//
// La corrección tiene dos mitades y hasta hoy solo se probaba la de abajo:
// pgTAP fija que la función devuelve las veinte, pero nadie comprobaba que la
// PANTALLA dijera la verdad sobre cuántas traen afinidad. Un conteo prueba que
// el motor corre y hasta dónde alcanza; una bandera binaria solo lo afirmaba,
// y mentía cuando una sola publicación vectorizada la ponía en 2.

const mockSugerencias = jest.fn();
const mockNuevas = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}));
jest.mock('@/hooks/queries/usePublicaciones', () => ({
  useSugerencias: (...a: unknown[]) => mockSugerencias(...a),
  useNuevas: (...a: unknown[]) => mockNuevas(...a),
}));
jest.mock('@/hooks/use-fotos-firmadas', () => ({ useFotosFirmadas: () => ({ urls: new Map(), fallo: null }) }));
jest.mock('@/store/usePerfilStore', () => ({
  usePerfilStore: (sel?: (s: unknown) => unknown) => {
    const estado = {
      perfil: { id: 'u1', presupuesto_max: 4000, distancia_max_km: 10, universidad: 'UTVT' },
      error: null,
      cargarPerfil: jest.fn(),
    };
    return sel ? sel(estado) : estado;
  },
}));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }),
}));
jest.mock('@/lib/tacto', () => ({ toque: jest.fn(), sello: jest.fn() }));
jest.mock('@/lib/registro', () => ({ aviso: jest.fn(), fallo: jest.fn() }));

import InicioScreen from '../inicio';

const publicacion = (id: string, nivel: 1 | 2 = 1) => ({
  id,
  titulo: `Depa ${id}`,
  tipo: 'depa',
  direccion: 'Calle 1',
  precio_renta: 2500,
  fotos: [],
  permite_mascotas: false,
  amueblado: false,
  latitud: 19.3,
  longitud: -99.5,
  distancia: 1.2,
  score: 0.8,
  similitud: nivel === 2 ? 0.9 : null,
  score_final: 0.84,
  nivel,
});

const respuesta = (extra: Record<string, unknown> = {}) => ({
  datos: [],
  conAfinidad: 0,
  total: 0,
  cargando: false,
  refrescando: false,
  fallo: null,
  refrescar: jest.fn(),
  emitido: null,
  ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockSugerencias.mockReturnValue(respuesta());
  mockNuevas.mockReturnValue({ datos: [], cargando: false });
});

describe('el membrete del nivel · END-08', () => {
  it('mientras carga NO afirma ningún nivel', async () => {
    // Con `conAfinidad = 0` por omisión, un membrete que no espera declara
    // «NIVEL 1» antes de haber preguntado — y si la respuesta trae afinidad se
    // corrige solo, delante de quien lo esté leyendo.
    mockSugerencias.mockReturnValue(respuesta({ cargando: true }));
    await render(<InicioScreen />);

    expect(screen.getByText('CONSULTANDO EXPEDIENTE')).toBeTruthy();
    expect(screen.queryByText(/NIVEL 1/)).toBeNull();
    expect(screen.queryByText(/NIVEL 2/)).toBeNull();
  });

  it('sin ninguna afinidad, dice Nivel 1', async () => {
    mockSugerencias.mockReturnValue(
      respuesta({ datos: [publicacion('p1'), publicacion('p2')], conAfinidad: 0, total: 2 })
    );
    await render(<InicioScreen />);

    expect(screen.getByText('NIVEL 1 · FILTROS PONDERADOS')).toBeTruthy();
  });

  it('con afinidad PARCIAL dice cuántas de cuántas, no solo «Nivel 2»', async () => {
    // Esta es la aserción que END-08 existe para sostener. Con doce de veinte,
    // una bandera binaria diría «Nivel 2» y quien mira no sabría que ocho
    // publicaciones no participaron del reordenamiento.
    mockSugerencias.mockReturnValue(
      respuesta({ datos: [publicacion('p1', 2)], conAfinidad: 12, total: 20 })
    );
    await render(<InicioScreen />);

    expect(screen.getByText('NIVEL 2 · 12 DE 20 CON AFINIDAD SEMÁNTICA')).toBeTruthy();
  });

  it('con UNA sola vectorizada no presume de Nivel 2 a secas', async () => {
    // El caso exacto que delataba la bandera: una publicación con vector de
    // veinte ponía la app en «Nivel 2» y escondía las otras diecinueve.
    mockSugerencias.mockReturnValue(
      respuesta({ datos: [publicacion('p1', 2)], conAfinidad: 1, total: 20 })
    );
    await render(<InicioScreen />);

    expect(screen.getByText('NIVEL 2 · 1 DE 20 CON AFINIDAD SEMÁNTICA')).toBeTruthy();
  });
});

describe('el filtro de tipo · END-17', () => {
  it('va al SERVIDOR, no sobre la página ya truncada', async () => {
    mockSugerencias.mockReturnValue(respuesta({ datos: [publicacion('p1')], conAfinidad: 0, total: 1 }));
    await render(<InicioScreen />);

    await act(async () => { fireEvent.press(screen.getByLabelText('Cuarto')); });

    // Filtrar en el teléfono los primeros treinta resultados hacía que la app
    // dijera «SIN REGISTROS DE ESE TIPO» con cincuenta cuartos disponibles.
    await waitFor(() => expect(mockSugerencias).toHaveBeenCalledWith('cuarto', expect.anything()));
  });
});

describe('cuando falla', () => {
  it('lo dice, en vez de enseñar una lista vacía', async () => {
    // §27: un fallo no puede presentarse como ausencia de resultados. Es el
    // mismo defecto que END-11, en la pantalla principal.
    mockSugerencias.mockReturnValue(respuesta({ fallo: 'No pudimos consultar el expediente.' }));
    await render(<InicioScreen />);

    expect(screen.getByText('NO SE PUDO CONSULTAR')).toBeTruthy();
    expect(screen.queryByText('SIN REGISTROS')).toBeNull();
  });

  it('sin resultados y sin fallo, dice que no hay — que es otra cosa', async () => {
    await render(<InicioScreen />);

    expect(screen.getByText('SIN REGISTROS')).toBeTruthy();
    expect(screen.queryByText('NO SE PUDO CONSULTAR')).toBeNull();
  });
});
