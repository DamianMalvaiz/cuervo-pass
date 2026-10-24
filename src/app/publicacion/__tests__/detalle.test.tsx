import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { revelarContacto } from '@/services/publicaciones.service';
import { useToastStore } from '@/store/useToastStore';

// `publicacion/[id].tsx` · la ficha que se abre desde un toque en las
// sugerencias. Tenía 28 de 61 ramas sin cubrir.
//
// El sello —revelar contacto— NO se prueba aquí: vive en `BotonVerContacto`, que
// tiene su propio archivo. Esta pantalla solo le pasa `revelarContacto` como
// prop, así que una prueba de la cuota escrita aquí comprobaría el doble del
// servicio. Mismo reparto que con `chats` y `useChat`.
//
// Lo que sí es de la pantalla:
//
//  · END-11 · TRES estados y no dos. `fallo` es una caída de lectura;
//    `publicacion === null` es que de verdad no está. Mientras compartieron un
//    mismo `null`, la pantalla elegía la interpretación más grave y ACUSABA DE
//    REPORTES a un anuncio ajeno por un fallo de red. Es el peor de los END-11
//    del proyecto porque no solo miente: difama.
//  · END-27 · El reporte duplicado se reconoce por el código 23505, no por la
//    subcadena «duplicate key value».
//  · La distancia, que depende de que el perfil tenga coordenadas de
//    universidad — lo mismo que se fija en las pruebas del cuestionario.

const mockPublicacion = jest.fn();
const mockAfinidad = jest.fn();
const mockCalificacion = jest.fn();
const mockSeccionResenas = jest.fn();
const mockReportar = jest.fn();
const mockReintentar = jest.fn();
const mockFotos = jest.fn();
const mockPerfil: { valor: Record<string, unknown> | null } = { valor: null };

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ id: 'p1' }),
  Stack: { Screen: () => null },
}));
jest.mock('@/hooks/queries/usePublicaciones', () => ({
  usePublicacion: (...a: unknown[]) => mockPublicacion(...a),
  useAfinidad: (...a: unknown[]) => mockAfinidad(...a),
}));
jest.mock('@/services/publicaciones.service', () => ({
  reportarPublicacion: (...a: unknown[]) => mockReportar(...a),
  revelarContacto: jest.fn().mockResolvedValue('7221234567'),
}));
jest.mock('@/hooks/use-fotos-firmadas', () => ({ useFotosFirmadas: (...a: unknown[]) => mockFotos(...a) }));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }),
}));
jest.mock('@/store/usePerfilStore', () => ({
  usePerfilStore: (sel?: (s: unknown) => unknown) => {
    const estado = { perfil: mockPerfil.valor, cargarPerfil: jest.fn() };
    return sel ? sel(estado) : estado;
  },
}));
jest.mock('@/lib/tacto', () => ({ sello: jest.fn(), toque: jest.fn() }));
jest.mock('@/components/BotonEscribir', () => ({
  BotonEscribir: ({ otroUsuarioId }: { otroUsuarioId: string }) => {
    const { Text } = require('react-native');
    return <Text>{`ESCRIBIR_A:${otroUsuarioId}`}</Text>;
  },
}));
jest.mock('@/components/ConteoFavoritos', () => ({
  ConteoFavoritos: ({ publicacionId }: { publicacionId: string }) => {
    const { Text } = require('react-native');
    return <Text>{`CONTEO:${publicacionId}`}</Text>;
  },
}));
// El corazón tiene sus propias pruebas; aquí solo importa que la ficha lo monte con SU id.
jest.mock('@/components/BotonFavorito', () => ({
  BotonFavorito: ({ publicacionId }: { publicacionId: string }) => {
    const { Text } = require('react-native');
    return <Text>{`CORAZON:${publicacionId}`}</Text>;
  },
}));

jest.mock('@/hooks/queries/useResenas', () => ({ useCalificacionPublicacion: (...a: unknown[]) => mockCalificacion(...a) }));
// Las reseñas tienen sus propias pruebas; aquí solo importa que la ficha las monte con lo correcto.
jest.mock('@/components/SeccionResenas', () => ({
  SeccionResenas: (props: unknown) => {
    const { Text } = require('react-native');
    mockSeccionResenas(props);
    return <Text>SECCION RESEÑAS</Text>;
  },
}));

// «Parecidos a este» tiene sus propias pruebas; aquí solo importa que la ficha lo monte con el id correcto.
jest.mock('@/components/SeccionParecidas', () => ({
  SeccionParecidas: ({ publicacionId }: { publicacionId: string }) => {
    const { Text } = require('react-native');
    return <Text>{`PARECIDOS ${publicacionId}`}</Text>;
  },
}));

import DetalleScreen from '../[id]';

const PUBLICACION = {
  id: 'abcd1234-0000-0000-0000-000000000000',
  titulo: 'Depa centro',
  tipo: 'depa',
  direccion: 'Calle 1, Lerma',
  descripcion: 'Bien iluminado y cerca del transporte.',
  usuario_id: 'dueno-9',
  precio_renta: 3500,
  fotos: [],
  permite_mascotas: false,
  amueblado: false,
  servicios_incluidos: false,
  latitud: null,
  longitud: null,
  creado_en: '2026-09-20T10:00:00Z',
};

const estado = (extra: Record<string, unknown> = {}) => ({
  publicacion: PUBLICACION,
  cargando: false,
  fallo: null,
  reintentar: mockReintentar,
  ...extra,
});

const pintar = async () => render(<DetalleScreen />);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  useToastStore.setState({ actual: null });
  mockPerfil.valor = null;
  mockPublicacion.mockReturnValue(estado());
  mockAfinidad.mockReturnValue(null);
  mockCalificacion.mockReturnValue({ calificacion: null, numResenas: 0, cargando: false, fallo: false });
  mockFotos.mockReturnValue({ urls: new Map(), fallo: null });
});

// ── END-11 · los tres estados ────────────────────────────────────────────────

// El peor END-11 del proyecto. Un fallo de red hacía que la pantalla dijera que
// la publicación «pudo ocultarse tras varios reportes»: no solo mentía sobre el
// estado, difamaba a un anuncio ajeno delante de quien lo estaba mirando.
test('un fallo de lectura NO insinúa reportes: ofrece reintentar', async () => {
  mockPublicacion.mockReturnValue(estado({ publicacion: null, fallo: 'No pudimos cargar' }));
  await pintar();

  expect(screen.queryByText(/reportes/)).toBeNull();
  expect(screen.queryByText('Ficha no disponible')).toBeNull();
  expect(screen.getByLabelText('Reintentar')).toBeTruthy();
});

test('y el botón de reintentar reintenta de verdad', async () => {
  mockPublicacion.mockReturnValue(estado({ publicacion: null, fallo: 'No pudimos cargar' }));
  await pintar();
  await act(async () => {
    fireEvent.press(screen.getByLabelText('Reintentar'));
  });
  expect(mockReintentar).toHaveBeenCalled();
});

// Ausente de verdad: sin fallo y sin publicación. Aquí SÍ toca decir que pudo
// desactivarse u ocultarse, porque es lo que de verdad pasó.
test('ausente de verdad dice que no está disponible, sin ofrecer reintento', async () => {
  mockPublicacion.mockReturnValue(estado({ publicacion: null }));
  await pintar();

  expect(screen.getByText('Ficha no disponible')).toBeTruthy();
  expect(screen.getByText(/Pudo desactivarse o ocultarse tras varios reportes/)).toBeTruthy();
  expect(screen.queryByLabelText('Reintentar')).toBeNull();
});

test('mientras carga no afirma ni fallo ni ausencia', async () => {
  mockPublicacion.mockReturnValue(estado({ publicacion: null, cargando: true }));
  await pintar();
  expect(screen.queryByText('Ficha no disponible')).toBeNull();
  expect(screen.queryByLabelText('Reintentar')).toBeNull();
});

// ── END-27 · el reporte ──────────────────────────────────────────────────────

/** Abre el diálogo de reporte y devuelve sus botones. */
const abrirReporte = async () => {
  await act(async () => {
    fireEvent.press(screen.getByLabelText(/Reportar/i));
  });
  await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
  const llamada = (Alert.alert as jest.Mock).mock.calls.find(([t]) => t === 'Reportar publicación');
  return llamada?.[2] as { text: string; onPress?: () => unknown }[];
};

test('reportar pregunta el motivo antes de enviar nada', async () => {
  await pintar();
  const botones = await abrirReporte();
  expect(botones.map((b) => b.text)).toEqual(['Cancelar', 'Contenido sospechoso', 'Información falsa']);
  expect(mockReportar).not.toHaveBeenCalled();
});

test('el motivo elegido viaja tal cual', async () => {
  mockReportar.mockResolvedValue(undefined);
  await pintar();
  const botones = await abrirReporte();
  await act(async () => {
    await botones.find((b) => b.text === 'Información falsa')?.onPress?.();
  });
  expect(mockReportar).toHaveBeenCalledWith('u1', PUBLICACION.id, 'información falsa');
});

// END-27 · 23505 es el código estándar de violación de unicidad, el mismo en
// cualquier versión y cualquier locale. El texto «duplicate key value» no lo es.
// Este error trae el mensaje en inglés a propósito.
test('un reporte repetido se reconoce por código, no por el texto', async () => {
  mockReportar.mockRejectedValue({ code: '23505', message: 'duplicate key value violates unique constraint' });
  await pintar();
  const botones = await abrirReporte();
  await act(async () => {
    await botones.find((b) => b.text === 'Contenido sospechoso')?.onPress?.();
  });

  // Paso 3 · el resultado se AVISA, no se pregunta: un Alert que solo informa
  // obliga a tocar «OK» para seguir. El diálogo que sí se queda es el del motivo.
  expect(useToastStore.getState().actual).toMatchObject({
    tipo: 'error',
    mensaje: 'No se pudo enviar el reporte. Ya habías reportado esta publicación.',
  });
});

test('otro fallo al reportar da el mensaje genérico', async () => {
  mockReportar.mockRejectedValue(new Error('sin red'));
  await pintar();
  const botones = await abrirReporte();
  await act(async () => {
    await botones.find((b) => b.text === 'Contenido sospechoso')?.onPress?.();
  });
  expect(useToastStore.getState().actual).toMatchObject({
    tipo: 'error',
    mensaje: 'No se pudo enviar el reporte. Intenta de nuevo en un momento.',
  });
});

test('un reporte enviado se agradece', async () => {
  mockReportar.mockResolvedValue(undefined);
  await pintar();
  const botones = await abrirReporte();
  await act(async () => {
    await botones.find((b) => b.text === 'Contenido sospechoso')?.onPress?.();
  });
  expect(useToastStore.getState().actual).toMatchObject({
    tipo: 'exito',
    mensaje: 'Gracias. Reportamos esta publicación para revisión.',
  });
});

// Paso 3 · el fallo de revelar el contacto se AVISA. El Alert que había obligaba a
// tocar «OK» para un mensaje que solo informa. El texto ya llega completo desde
// el botón, así que se muestra tal cual.
test('si no se puede revelar el contacto, se avisa con el mensaje del botón', async () => {
  (revelarContacto as jest.Mock).mockRejectedValueOnce(new Error('sin red'));
  await pintar();

  await act(async () => {
    fireEvent.press(screen.getByLabelText('Ver contacto'));
  });

  await waitFor(() => expect(useToastStore.getState().actual).not.toBeNull());
  expect(useToastStore.getState().actual).toMatchObject({
    tipo: 'error',
    mensaje: 'No pudimos obtener el contacto de esta publicación. Intenta de nuevo en un momento.',
  });
});

// ── La distancia ─────────────────────────────────────────────────────────────

// Depende de DOS cosas: que la publicación tenga coordenadas y que el perfil
// tenga las de su universidad. Faltando cualquiera, «sin dato» y atenuado — no
// un 0.0 km, que sería una afirmación falsa.
test('sin coordenadas de universidad la distancia dice «sin dato»', async () => {
  mockPublicacion.mockReturnValue(estado({ publicacion: { ...PUBLICACION, latitud: 19.3, longitud: -99.45 } }));
  mockPerfil.valor = { id: 'u1' };
  await pintar();
  expect(screen.getByText('Distancia sin dato')).toBeTruthy();
});

test('sin coordenadas de la publicación tampoco se inventa', async () => {
  mockPerfil.valor = { id: 'u1', latitud_universidad: 19.32568, longitud_universidad: -99.458244 };
  await pintar();
  expect(screen.getByText('Distancia sin dato')).toBeTruthy();
});

test('con las dos, se calcula', async () => {
  mockPublicacion.mockReturnValue(estado({ publicacion: { ...PUBLICACION, latitud: 19.33, longitud: -99.46 } }));
  mockPerfil.valor = { id: 'u1', latitud_universidad: 19.32568, longitud_universidad: -99.458244 };
  await pintar();
  expect(screen.getByText(/^A \d+\.\d km de tu universidad$/)).toBeTruthy();
});

// ── Las fotografías ──────────────────────────────────────────────────────────

test('sin fotografías no se pinta carrusel ni foja', async () => {
  await pintar();
  expect(screen.queryByText(/^\d+ de \d+$/)).toBeNull();
});

// Una sola foto no lleva foja: «FOJA 1 DE 1» es ruido.
test('con una sola foto no hay foja', async () => {
  mockPublicacion.mockReturnValue(estado({ publicacion: { ...PUBLICACION, fotos: ['a.jpg'] } }));
  mockFotos.mockReturnValue({ urls: new Map([['a.jpg', 'https://f.test/a']]), fallo: null });
  await pintar();
  expect(screen.queryByText(/^\d+ de \d+$/)).toBeNull();
});

test('con varias, la foja dice en cuál vas y cuántas hay', async () => {
  mockPublicacion.mockReturnValue(estado({ publicacion: { ...PUBLICACION, fotos: ['a.jpg', 'b.jpg', 'c.jpg'] } }));
  mockFotos.mockReturnValue({
    urls: new Map([['a.jpg', 'https://f.test/a'], ['b.jpg', 'https://f.test/b'], ['c.jpg', 'https://f.test/c']]),
    fallo: null,
  });
  await pintar();
  expect(screen.getByText('1 de 3')).toBeTruthy();
});

// §14 · El bucket es privado. Si la firma falla, se DICE en vez de dejar
// rectángulos vacíos que se leen como una publicación sin fotos.
test('si falla firmar las fotos se dice', async () => {
  mockPublicacion.mockReturnValue(estado({ publicacion: { ...PUBLICACION, fotos: ['a.jpg'] } }));
  mockFotos.mockReturnValue({ urls: new Map(), fallo: 'no se pudo firmar' });
  await pintar();
  expect(screen.getByText('Fotografía no disponible')).toBeTruthy();
});

// ── La ficha ─────────────────────────────────────────────────────────────────

test('las condiciones se dicen por los dos lados', async () => {
  await pintar();
  expect(screen.getByText('No acepta mascotas')).toBeTruthy();
  expect(screen.getByText('Sin amueblar')).toBeTruthy();
  expect(screen.getByText('Servicios aparte')).toBeTruthy();

  mockPublicacion.mockReturnValue(
    estado({ publicacion: { ...PUBLICACION, amueblado: true, permite_mascotas: true, servicios_incluidos: true } })
  );
  await pintar();
  expect(screen.getByText('Acepta mascotas')).toBeTruthy();
  expect(screen.getByText('Amueblado')).toBeTruthy();
  expect(screen.getByText('Servicios incluidos')).toBeTruthy();
});

// Cuervo 360 · el precio manda y va con «al mes»; las condiciones son pastillas, no una tabla de campos.
test('el precio va grande, con «al mes»', async () => {
  await pintar();
  expect(screen.getByText(/^\$[\d,]+ al mes$/)).toBeTruthy();
});

test('las recámaras se cuentan en singular y plural', async () => {
  mockPublicacion.mockReturnValue(estado({ publicacion: { ...PUBLICACION, recamaras: 1 } }));
  await pintar();
  expect(screen.getByText('1 recámara')).toBeTruthy();

  mockPublicacion.mockReturnValue(estado({ publicacion: { ...PUBLICACION, recamaras: 3 } }));
  await pintar();
  expect(screen.getByText('3 recámaras')).toBeTruthy();
});

test('ya no hay tabla de datos de la publicación', async () => {
  await pintar();
  expect(screen.queryByText('Datos de la publicación')).toBeNull();
  expect(screen.queryByText('Renta mensual')).toBeNull();
});

// Un tipo que no esté en el mapa no debe pintar «undefined» en el membrete: cae
// al nombre crudo en mayúsculas, que al menos dice algo.
test('un tipo desconocido cae al nombre crudo, no a undefined', async () => {
  mockPublicacion.mockReturnValue(estado({ publicacion: { ...PUBLICACION, tipo: 'loft' } }));
  await pintar();
  expect(screen.getByText('Loft')).toBeTruthy();
});

test('sin descripción no se pinta esa sección vacía', async () => {
  mockPublicacion.mockReturnValue(estado({ publicacion: { ...PUBLICACION, descripcion: null } }));
  await pintar();
  expect(screen.queryByText(/Bien iluminado/)).toBeNull();
});

// El bloque del «por qué» solo aparece si el motor devolvió un score: sin
// afinidad calculada, afirmar un porcentaje sería inventarlo.
test('sin afinidad no se pinta el desglose', async () => {
  await pintar();
  expect(screen.queryByText(/POR QUÉ/i)).toBeNull();
  expect(screen.queryByText('Por qué es buena para ti')).toBeNull();
  expect(screen.queryByText(/compatible contigo/i)).toBeNull();
});

// Cuervo 360 · en lugar de «9.4» y su fórmula, la ficha dice en palabras qué tan compatible es y POR QUÉ, solo con
// lo que se cumple.
describe('compatibilidad en palabras', () => {
  const conAfinidad = (scoreFinal: number) =>
    mockAfinidad.mockReturnValue({ scoreFinal, score: scoreFinal, similitud: null });

  it('con score alto dice «Muy compatible contigo» y no enseña números ni fórmula', async () => {
    conAfinidad(0.9);
    await pintar();
    expect(screen.getByText('Muy compatible contigo')).toBeTruthy();
    expect(screen.queryByText(/Filtros ponderados/)).toBeNull();
    expect(screen.queryByText(/Este ajuste compara/)).toBeNull();
    expect(screen.queryByText(/^\d\.\d$/)).toBeNull();
  });

  it('con score medio dice «Compatible contigo»', async () => {
    conAfinidad(0.6);
    await pintar();
    expect(screen.getByText('Compatible contigo')).toBeTruthy();
  });

  it('con score bajo no dice nada de compatibilidad', async () => {
    conAfinidad(0.3);
    await pintar();
    expect(screen.queryByText(/compatible contigo/i)).toBeNull();
  });

  it('«Por qué es buena para ti» lista solo las razones que se cumplen', async () => {
    conAfinidad(0.9);
    mockPerfil.valor = { id: 'u1', presupuesto_max: 4000, distancia_max_km: 5, mascotas: true };
    await pintar();
    expect(screen.getByText('Por qué es buena para ti')).toBeTruthy();
    expect(screen.getByText('Está dentro de tu presupuesto')).toBeTruthy();
    // La publicación de prueba no acepta mascotas y no tiene coordenadas: esas dos NO se afirman.
    expect(screen.queryByText('Acepta mascotas, como pediste')).toBeNull();
    expect(screen.queryByText('Queda dentro de tu distancia máxima')).toBeNull();
  });

  it('sin ninguna razón que decir no pinta el recuadro vacío', async () => {
    conAfinidad(0.9);
    mockPerfil.valor = { id: 'u1', presupuesto_max: 1000, mascotas: false };
    await pintar();
    expect(screen.queryByText('Por qué es buena para ti')).toBeNull();
  });
});

// ── Cuervo 360 · Favoritos ───────────────────────────────────────────────────

// El corazón va junto a «Ver contacto», no sobre la foto: así está siempre, haya fotos o no, y queda
// al alcance del pulgar. Recibe el id de ESTA publicación y no otro.
test('la ficha pinta el corazón de favoritos con el id de la publicación', async () => {
  await pintar();
  expect(await screen.findByText(`CORAZON:${PUBLICACION.id}`)).toBeTruthy();
});

test('el corazón no desplaza «Ver contacto»: los dos están', async () => {
  await pintar();
  expect(await screen.findByLabelText('Ver contacto')).toBeTruthy();
  expect(screen.getByText(`CORAZON:${PUBLICACION.id}`)).toBeTruthy();
});

// Cuervo 360 · se ve cuántas personas la guardaron (el número, nunca quién).
test('la ficha pinta el conteo de favoritos con el id de la publicación', async () => {
  await pintar();
  expect(await screen.findByText(`CONTEO:${PUBLICACION.id}`)).toBeTruthy();
});

// Cuervo 360 · contactar DENTRO de la app es el camino principal; WhatsApp es la segunda opción.
test('la ficha ofrece escribir en la app, al dueño de ESTA publicación', async () => {
  await pintar();
  expect(await screen.findByText('ESCRIBIR_A:dueno-9')).toBeTruthy();
});

test('«Ver contacto» (WhatsApp) sigue ahí como segunda opción', async () => {
  await pintar();
  await screen.findByText('ESCRIBIR_A:dueno-9');
  expect(screen.getByLabelText('Ver contacto')).toBeTruthy();
});

// Cuervo 360 · la barra de contacto va FIJA abajo (17/10/2026): el corazón, «Escribir en la app» y «Ver contacto»
// no se pierden al desplazar la ficha, y quedan al alcance del pulgar.
test('el corazón, escribir y ver contacto viven en la barra fija de abajo', async () => {
  await pintar();
  const barra = screen.getByTestId('barra-contacto');
  expect(within(barra).getByText(`CORAZON:${PUBLICACION.id}`)).toBeTruthy();
  expect(within(barra).getByText('ESCRIBIR_A:dueno-9')).toBeTruthy();
  expect(within(barra).getByLabelText('Ver contacto')).toBeTruthy();
});

test('el conteo de favoritos y el reporte siguen en el cuerpo, no en la barra', async () => {
  await pintar();
  const barra = screen.getByTestId('barra-contacto');
  expect(within(barra).queryByText(`CONTEO:${PUBLICACION.id}`)).toBeNull();
  expect(within(barra).queryByLabelText('Reportar publicación')).toBeNull();
});

test('el membrete ya no lleva folio ni fecha de alta', async () => {
  await pintar();
  expect(screen.getByText('Departamento')).toBeTruthy();
  expect(screen.queryByText(/FOLIO/)).toBeNull();
  expect(screen.queryByText(/ALTA/)).toBeNull();
});

// Reseñas (0054).
describe('las reseñas en la ficha de una vivienda', () => {
  it('monta la sección con la vivienda y su calificación calculada', async () => {
    mockCalificacion.mockReturnValue({ calificacion: 4.5, numResenas: 3, cargando: false, fallo: false });
    await pintar();
    expect(screen.getByText('SECCION RESEÑAS')).toBeTruthy();
    expect(mockSeccionResenas).toHaveBeenCalledWith({
      objetivo: { publicacionId: PUBLICACION.id }, esDueno: false, calificacion: 4.5, numResenas: 3,
    });
  });

  it('sin reseñas no inventa calificación: null y 0', async () => {
    await pintar();
    expect(mockSeccionResenas).toHaveBeenCalledWith(expect.objectContaining({ calificacion: null, numResenas: 0 }));
  });

  it('si la vivienda es MÍA, la sección sabe que soy el dueño (responde, no reseña)', async () => {
    mockPublicacion.mockReturnValue(estado({ publicacion: { ...PUBLICACION, usuario_id: 'u1' } }));
    await pintar();
    expect(mockSeccionResenas).toHaveBeenCalledWith(expect.objectContaining({ esDueno: true }));
  });

  it('pide la calificación de ESTA publicación', async () => {
    await pintar();
    expect(mockCalificacion).toHaveBeenCalledWith('p1');
  });
});

describe('personalización con favoritos (0071)', () => {
  it('monta «Parecidos a este» con el id de la publicación', async () => {
    await pintar();
    expect(screen.getByText('PARECIDOS p1')).toBeTruthy();
  });

  it('dice a qué favorito se parece, y solo cuando el servidor lo dice', async () => {
    mockAfinidad.mockReturnValue({ scoreFinal: 0.7, score: 0.7, similitud: 0.6, parecidoA: 'Depa junto al metro' });
    await pintar();
    expect(screen.getByText(/Se parece a «Depa junto al metro», que guardaste en favoritos/)).toBeTruthy();
  });

  it('sin «parecido a» no inventa una explicación', async () => {
    mockAfinidad.mockReturnValue({ scoreFinal: 0.7, score: 0.7, similitud: 0.6, parecidoA: null });
    await pintar();
    expect(screen.queryByText(/Se parece a/)).toBeNull();
  });
});

// 0082 · una cuenta restringida no ve lo que la base va a rechazar. `useCuentaRestringida` está simulado por omisión en jest.setup.js (false).
const { useCuentaRestringida } = jest.requireMock('@/hooks/queries/useCuentaRestringida');
afterEach(() => useCuentaRestringida.mockReturnValue(false));

test('una cuenta restringida no ve «Reportar publicación»', async () => {
  useCuentaRestringida.mockReturnValue(true);
  await pintar();
  expect(screen.queryByLabelText('Reportar publicación')).toBeNull();
});

test('una cuenta normal sí lo ve (control de la anterior)', async () => {
  await pintar();
  expect(screen.getByLabelText('Reportar publicación')).toBeTruthy();
});
