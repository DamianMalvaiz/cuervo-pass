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
// Mutable para poder pintar el resumen de filtros SIN preferencias, que es la
// otra mitad de `ResumenFiltros`. El prefijo `mock` lo exige
// `babel-plugin-jest-hoist`: sube las factorías por encima de las declaraciones
// del módulo y solo tolera leer de fuera las variables así nombradas.
const mockPerfil: { valor: Record<string, unknown> | null } = {
  valor: { id: 'u1', presupuesto_max: 4000, distancia_max_km: 10, universidad: 'UTVT' },
};

jest.mock('@/store/usePerfilStore', () => ({
  usePerfilStore: (sel?: (s: unknown) => unknown) => {
    const estado = { perfil: mockPerfil.valor, error: null, cargarPerfil: jest.fn() };
    return sel ? sel(estado) : estado;
  },
}));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }),
}));
jest.mock('@/lib/tacto', () => ({ toque: jest.fn(), sello: jest.fn() }));
// El corazón de Favoritos tiene sus propias pruebas (necesita un cliente de consultas); aquí solo importa la lista.
jest.mock('@/components/BotonFavorito', () => ({ BotonFavorito: () => null }));
// La campana de avisos tiene sus propias pruebas; Inicio no monta consultas por ella.
jest.mock('@/components/CampanaAvisos', () => ({ CampanaAvisos: () => null }));
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
  mockPerfil.valor = { id: 'u1', presupuesto_max: 4000, distancia_max_km: 10, universidad: 'UTVT' };
  mockSugerencias.mockReturnValue(respuesta());
  mockNuevas.mockReturnValue({ datos: [], cargando: false });
});

// Cuervo 360 · el orden y el nivel son AUTOMÁTICOS. Hasta el 17/10/2026 Inicio decía «NIVEL 1 · FILTROS PONDERADOS» o
// «NIVEL 2 · N DE N CON AFINIDAD SEMÁNTICA» (END-08), mostraba «afinidad 0.39» en cada fila y ofrecía «Ordenar por».
// Eran los internos del motor puestos en la cara de quien solo quiere ver depas. El motor sigue calculando el nivel
// por fila (END-08); lo que ya no hace es presumirlo: la lista llega ordenada sola.
describe('el nivel y el orden son automáticos', () => {
  const sinTecnicismos = () => {
    expect(screen.queryByText(/NIVEL/)).toBeNull();
    expect(screen.queryByText(/FILTROS PONDERADOS/)).toBeNull();
    expect(screen.queryByText(/AFINIDAD SEMÁNTICA/i)).toBeNull();
    expect(screen.queryByText('ORDENAR POR')).toBeNull();
    expect(screen.queryByText(/afinidad \d/)).toBeNull();
  };

  it('mientras carga no muestra ningún nivel', async () => {
    mockSugerencias.mockReturnValue(respuesta({ cargando: true }));
    await render(<InicioScreen />);
    sinTecnicismos();
  });

  it('con filtros solamente (Nivel 1) no lo dice', async () => {
    mockSugerencias.mockReturnValue(
      respuesta({ datos: [publicacion('p1'), publicacion('p2')], conAfinidad: 0, total: 2 })
    );
    await render(<InicioScreen />);
    sinTecnicismos();
  });

  it('con afinidad (Nivel 2) tampoco lo dice, ni cuántas de cuántas', async () => {
    mockSugerencias.mockReturnValue(
      respuesta({ datos: [publicacion('p1', 2)], conAfinidad: 12, total: 20 })
    );
    await render(<InicioScreen />);
    sinTecnicismos();
  });

  it('la lista se ofrece completa y sin «por afinidad y filtros»', async () => {
    mockSugerencias.mockReturnValue(respuesta({ datos: [publicacion('p1', 2)], conAfinidad: 5, total: 5 }));
    await render(<InicioScreen />);
    expect(screen.getByText('Todas las publicaciones')).toBeTruthy();
    expect(screen.queryByText(/por afinidad/)).toBeNull();
  });

  it('el orden va fijo en «ajuste»: se le pide al servidor sin que nadie lo elija', async () => {
    mockSugerencias.mockReturnValue(respuesta({ datos: [publicacion('p1')], conAfinidad: 0, total: 1 }));
    await render(<InicioScreen />);
    expect(mockSugerencias).toHaveBeenCalledWith(null, 'ajuste');
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

    expect(screen.getByText('No se pudo consultar')).toBeTruthy();
    expect(screen.queryByText('Sin resultados')).toBeNull();
  });

  it('sin resultados y sin fallo, dice que no hay — que es otra cosa', async () => {
    await render(<InicioScreen />);

    expect(screen.getByText('Sin resultados')).toBeTruthy();
    expect(screen.queryByText('No se pudo consultar')).toBeNull();
  });
});


// ── Las ramas que quedaban sin pisar ─────────────────────────────────────────

// §27 · LA rama de este bloque. Un refresco fallido CON resultados en memoria
// mostraba datos viejos y ningún aviso: la persona lee precios de hace una hora
// creyendo que son de ahora. Silencioso es la peor forma de fallar, y es distinto
// del fallo sin datos —que sí tiene su pantalla— porque aquí hay algo que mirar.
describe('un fallo mientras hay resultados en pantalla', () => {
  it('avisa de que lo que se ve está viejo, sin borrarlo', async () => {
    mockSugerencias.mockReturnValue(
      respuesta({ datos: [publicacion('p1'), publicacion('p2')], total: 2, fallo: 'sin red' })
    );
    await render(<InicioScreen />);

    expect(screen.getByText(/Estás viendo los últimos resultados cargados/)).toBeTruthy();
    // Y no se borran: el aviso ACOMPAÑA a los datos, no los sustituye.
    expect(screen.getByText('Depa p1')).toBeTruthy();
  });

  it('con la lista vacía no pone ese aviso, que sería contradictorio', async () => {
    mockSugerencias.mockReturnValue(respuesta({ fallo: 'sin red' }));
    await render(<InicioScreen />);
    expect(screen.queryByText(/últimos resultados cargados/)).toBeNull();
  });

  it('y sin fallo no hay aviso aunque haya datos', async () => {
    mockSugerencias.mockReturnValue(respuesta({ datos: [publicacion('p1')], total: 1 }));
    await render(<InicioScreen />);
    expect(screen.queryByText(/últimos resultados cargados/)).toBeNull();
  });
});

// «Un carril con dos es un hueco con título»: el mínimo es tres. El límite se
// prueba por los dos lados, que es donde un `>` en vez de un `>=` se esconde.
describe('el carrusel de nuevas', () => {
  const nueva = (id: string) => ({ ...publicacion(id), creado_en: '2026-09-20T10:00:00Z' });

  it('con dos no se pinta', async () => {
    mockNuevas.mockReturnValue({ datos: [nueva('n1'), nueva('n2')], cargando: false });
    await render(<InicioScreen />);
    expect(screen.queryByText('Nuevas esta semana')).toBeNull();
  });

  it('con tres sí', async () => {
    mockNuevas.mockReturnValue({ datos: [nueva('n1'), nueva('n2'), nueva('n3')], cargando: false });
    await render(<InicioScreen />);
    expect(screen.getByText('Nuevas esta semana')).toBeTruthy();
  });
});

// El encabezado ya no lleva folio ni hora de emisión («1 REGISTRO · EMITIDO …»): era membrete de expediente y se
// retiró el 17/10/2026. Aunque el motor devuelva `emitido`, no se pinta.
describe('el encabezado de Inicio', () => {
  it('no pinta folio, conteo ni hora de emisión', async () => {
    mockSugerencias.mockReturnValue(
      respuesta({ datos: [publicacion('p1')], total: 1, emitido: new Date('2026-09-26T12:30:00Z') })
    );
    await render(<InicioScreen />);
    expect(screen.getByText('Sugerencias')).toBeTruthy();
    expect(screen.queryByText(/EMITIDO/)).toBeNull();
    expect(screen.queryByText(/REGISTRO/)).toBeNull();
  });
});

// `ResumenFiltros` con el perfil a medio llenar. Es la primera cosa que se lee al
// abrir la app: si los filtros sin definir se pintaran en blanco, la lista
// parecería filtrada por criterios que nadie fijó.
describe('el resumen de filtros sin preferencias', () => {
  it('nombra lo que falta en vez de dejarlo en blanco', async () => {
    mockPerfil.valor = { id: 'u1', presupuesto_max: null, distancia_max_km: null, universidad: null };
    await render(<InicioScreen />);

    expect(screen.getByText(/Sin presupuesto/)).toBeTruthy();
    expect(screen.getByText(/Sin distancia/)).toBeTruthy();
    expect(screen.getByText(/Sin universidad/)).toBeTruthy();
  });

  it('y con ellas puestas las muestra', async () => {
    await render(<InicioScreen />);
    expect(screen.getByText(/Hasta \$4,000/)).toBeTruthy();
    expect(screen.getByText(/10 km/)).toBeTruthy();
    expect(screen.getByText(/UTVT/)).toBeTruthy();
  });
});
