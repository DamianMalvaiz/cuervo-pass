import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { useToastStore } from '@/store/useToastStore';

// V.8 · `publicaciones.tsx` — la pantalla del DUEÑO, que era la de menor
// cobertura de la carpeta (36 %) y la que concentra tres hallazgos distintos:
//
//  · END-27 · El mensaje del límite de 15 activas se elegía por SUBCADENA del
//    texto del error. Un servidor con `lc_messages` distinto nunca entraba en
//    esa rama y la persona leía «intenta de nuevo en un momento» ante un límite
//    que no se mueve solo por reintentar. Ahora se elige por CÓDIGO (CP002), y
//    eso es justo lo que una prueba puede fijar: un error con el código pero
//    con el texto en inglés debe seguir dando el mensaje del límite.
//  · AUD-26 · El límite se aplica al REACTIVAR igual que al crear, así que el
//    fallo llega por esta vía y no solo por el formulario.
//  · AUD-16 · El dueño se entera de por qué desapareció su publicación
//    (`oculta_por_reportes`) en vez de descubrirlo por su cuenta.
//
// Y una propiedad que ninguna prueba cubría: desactivar PREGUNTA antes. El
// primer toque no debe mutar nada.

const mockMisPublicaciones = jest.fn();
const mockConteo = jest.fn();
const mockContactos = jest.fn();
const mockMutar = jest.fn();

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/hooks/queries/usePublicaciones', () => ({
  useMisPublicaciones: (...a: unknown[]) => mockMisPublicaciones(...a),
  useContactosRecibidos: (...a: unknown[]) => mockContactos(...a),
  useCambiarEstadoPublicacion: () => ({ mutateAsync: mockMutar }),
}));
// Cuervo 360 · cuántas personas guardaron cada publicación (el número, nunca quién).
jest.mock('@/hooks/queries/useFavoritos', () => ({ useConteoFavoritos: (...a: unknown[]) => mockConteo(...a) }));
jest.mock('@/hooks/use-fotos-firmadas', () => ({
  useFotosFirmadas: (rutas: (string | null | undefined)[]) => ({
    urls: new Map(rutas.filter(Boolean).map((r) => [r, `https://firmada.test/${r}`])),
    fallo: null,
  }),
}));
// Cuervo 360 · la pantalla pasa por `GuardaPublicar`; estas pruebas son de la pantalla del dueño, así
// que se le da una cuenta con una función aprobada. La guarda tiene sus propias pruebas.
const rolAprobado = (rol: string) => ({ usuario_id: 'u1', rol, estado: 'aprobado', origen: 'solicitud', desde: 'x' });
let mockRolesPublicar: ReturnType<typeof rolAprobado>[] = [rolAprobado('arrendador')];
jest.mock('@/hooks/queries/useRoles', () => ({
  useMisRoles: () => ({ roles: mockRolesPublicar, cargando: false, fallo: false, reintentar: jest.fn() }),
}));
// «Mi negocio» tiene sus propias pruebas; aquí solo importa que la pantalla la monte según las funciones.
jest.mock('@/components/SeccionMiNegocio', () => ({
  SeccionMiNegocio: () => {
    const { Text } = require('react-native');
    return <Text>SECCION MI NEGOCIO</Text>;
  },
}));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }),
}));

import PublicacionesScreen from '../publicar';

const publicacion = (extra: Record<string, unknown> = {}) => ({
  id: 'p1',
  titulo: 'Depa centro',
  tipo: 'depa',
  direccion: 'Calle 1',
  precio_renta: 2500,
  fotos: [],
  permite_mascotas: false,
  amueblado: false,
  activa: true,
  oculta_por_reportes: false,
  pendiente_geocoding: false,
  ...extra,
});

beforeEach(() => {
  mockConteo.mockReturnValue({ conteos: new Map(), cargando: false, fallo: false });
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  useToastStore.setState({ actual: null });
  mockMisPublicaciones.mockReturnValue({ datos: [publicacion()], cargando: false });
  mockContactos.mockReturnValue(new Map([['p1', 3]]));
  mockMutar.mockResolvedValue(undefined);
});

/** Toca la acción. Desactivar y reactivar son reversibles: actúan al instante, sin diálogo (el skill de Apple: confirmar solo lo irreversible). */
async function tocar(etiqueta: string) {
  await act(async () => {
    fireEvent.press(screen.getByLabelText(etiqueta));
  });
}

test('desactivar actúa AL INSTANTE: sin diálogo de confirmación', async () => {
  await render(<PublicacionesScreen />);
  await tocar('Desactivar Depa centro');
  expect(mockMutar).toHaveBeenCalledWith({ id: 'p1', activa: false });
  expect(Alert.alert).not.toHaveBeenCalled();
});

// Una inactiva ofrece lo contrario. Si la etiqueta y la mutación se
// desincronizaran, el dueño pulsaría «Reactivar» y la volvería a apagar.
test('una inactiva ofrece reactivar, y reactiva con activa=true, también sin diálogo', async () => {
  mockMisPublicaciones.mockReturnValue({ datos: [publicacion({ activa: false })], cargando: false });
  await render(<PublicacionesScreen />);
  expect(screen.getByText('Inactiva: no aparece en las sugerencias')).toBeTruthy();
  await tocar('Reactivar Depa centro');
  expect(mockMutar).toHaveBeenCalledWith({ id: 'p1', activa: true });
  expect(Alert.alert).not.toHaveBeenCalled();
});

// END-27 · El código manda, no el idioma del servidor. Este error trae el texto
// en inglés a propósito: con la comprobación por subcadena que había antes,
// esta prueba fallaría.
test('END-27 · el límite de 15 se reconoce por código, no por el texto', async () => {
  mockMutar.mockRejectedValue({ code: 'CP002', message: 'maximum of 15 active listings reached' });
  mockMisPublicaciones.mockReturnValue({ datos: [publicacion({ activa: false })], cargando: false });
  await render(<PublicacionesScreen />);
  await tocar('Reactivar Depa centro');

  expect(useToastStore.getState().actual).toMatchObject({ tipo: 'error' });
  expect(useToastStore.getState().actual?.mensaje).toContain('No se pudo cambiar el estado');
  expect(useToastStore.getState().actual?.mensaje).toContain('15 publicaciones activas');
});

test('un fallo sin código da el mensaje genérico, no el del límite', async () => {
  mockMutar.mockRejectedValue(new Error('network request failed'));
  await render(<PublicacionesScreen />);
  await tocar('Desactivar Depa centro');

  expect(useToastStore.getState().actual).toMatchObject({
    tipo: 'error',
    mensaje: 'No se pudo cambiar el estado. Intenta de nuevo en un momento.',
  });
  expect(useToastStore.getState().actual?.mensaje).not.toContain('15');
});

// Paso 3 · antes, un cambio exitoso no decía nada. Y ahora, sin diálogo previo, el aviso es la red de seguridad: lleva «Deshacer».
test('al desactivar bien, se confirma con un aviso de éxito que ofrece «Deshacer»', async () => {
  await render(<PublicacionesScreen />);
  await tocar('Desactivar Depa centro');

  expect(useToastStore.getState().actual).toMatchObject({ tipo: 'exito', mensaje: 'Publicación desactivada' });
  expect(useToastStore.getState().actual?.accion?.etiqueta).toBe('Deshacer');
});

test('«Deshacer» tras desactivar la vuelve a activar', async () => {
  await render(<PublicacionesScreen />);
  await tocar('Desactivar Depa centro');
  mockMutar.mockClear();

  await act(async () => { useToastStore.getState().actual?.accion?.onPress(); });

  expect(mockMutar).toHaveBeenCalledWith({ id: 'p1', activa: true });
});

test('al reactivar bien, se confirma con un aviso de éxito, y «Deshacer» la vuelve a desactivar', async () => {
  mockMisPublicaciones.mockReturnValue({ datos: [publicacion({ activa: false })], cargando: false });
  await render(<PublicacionesScreen />);
  await tocar('Reactivar Depa centro');

  expect(useToastStore.getState().actual).toMatchObject({ tipo: 'exito', mensaje: 'Publicación reactivada' });
  mockMutar.mockClear();
  await act(async () => { useToastStore.getState().actual?.accion?.onPress(); });
  expect(mockMutar).toHaveBeenCalledWith({ id: 'p1', activa: false });
});

// Deshacer una desactivación es reactivar, y reactivar puede chocar con el límite de 15 si mientras tanto se activó otra: se dice, no se traga.
test('si «Deshacer» falla por el límite, lo dice', async () => {
  await render(<PublicacionesScreen />);
  await tocar('Desactivar Depa centro');
  mockMutar.mockRejectedValue({ code: 'CP002', message: 'maximum of 15 active listings reached' });

  await act(async () => { useToastStore.getState().actual?.accion?.onPress(); });

  expect(useToastStore.getState().actual).toMatchObject({ tipo: 'error' });
  expect(useToastStore.getState().actual?.mensaje).toContain('15 publicaciones activas');
});

// Un fallo no debe dar también el aviso de éxito.
test('si falla, NO hay aviso de éxito ni «Deshacer»', async () => {
  mockMutar.mockRejectedValue(new Error('sin red'));
  await render(<PublicacionesScreen />);
  await tocar('Desactivar Depa centro');

  expect(useToastStore.getState().actual?.tipo).toBe('error');
  expect(useToastStore.getState().actual?.accion).toBeUndefined();
});

// AUD-16 · Sin esto, una publicación oculta por reportes desaparecía de las
// sugerencias y su dueño no tenía forma de saber por qué.
test('AUD-16 · avisa al dueño cuando está oculta por reportes', async () => {
  mockMisPublicaciones.mockReturnValue({ datos: [publicacion({ oculta_por_reportes: true })], cargando: false });
  await render(<PublicacionesScreen />);
  expect(screen.getByText('Oculta por reportes')).toBeTruthy();
});

test('avisa cuando falta la ubicación en el mapa', async () => {
  mockMisPublicaciones.mockReturnValue({ datos: [publicacion({ pendiente_geocoding: true })], cargando: false });
  await render(<PublicacionesScreen />);
  expect(screen.getByText(/Sin ubicación en el mapa/)).toBeTruthy();
});

// AUD-11 · La métrica dejó de inflarse con cada toque repetido; lo que se fija
// aquí es que el singular no se lee como un error de plantilla.
test('el conteo de contactos concuerda en número', async () => {
  await render(<PublicacionesScreen />);
  expect(screen.getByText('3 personas pidieron tu contacto')).toBeTruthy();

  mockContactos.mockReturnValue(new Map([['p1', 1]]));
  await render(<PublicacionesScreen />);
  expect(screen.getByText('1 persona pidió tu contacto')).toBeTruthy();
});

test('sin registros lo dice, y no deja la lista muda', async () => {
  mockMisPublicaciones.mockReturnValue({ datos: [], cargando: false });
  await render(<PublicacionesScreen />);
  expect(screen.getByText('Sin publicaciones')).toBeTruthy();
  expect(screen.queryByText('0 PUBLICACIONES')).toBeNull();
});

test('mientras carga no dice que no hay nada', async () => {
  mockMisPublicaciones.mockReturnValue({ datos: [], cargando: true });
  await render(<PublicacionesScreen />);
  expect(screen.queryByText('Sin publicaciones')).toBeNull();
});


// Una publicación con foto: el camino que el fixture sin fotos no tocaba.
test('una publicación con foto monta con su ficha entera', async () => {
  mockMisPublicaciones.mockReturnValue({
    datos: [publicacion({ fotos: ['u1/p1-0.jpg'] })],
    cargando: false,
  });
  await render(<PublicacionesScreen />);
  expect(screen.getByText('Depa centro')).toBeTruthy();
});

// Una publicación que nadie ha contactado no está en el Map, y eso debe leerse
// como cero y no como «undefined personas pidieron tu contacto».
test('una publicación sin contactos dice cero, no undefined', async () => {
  mockContactos.mockReturnValue(new Map());
  await render(<PublicacionesScreen />);
  expect(screen.getByText('0 personas pidieron tu contacto')).toBeTruthy();
});

// ── Cuervo 360 · cuántas personas guardaron cada publicación ─────────────────

const conConteo = (mapa: Record<string, number>) =>
  mockConteo.mockReturnValue({ conteos: new Map(Object.entries(mapa)), cargando: false, fallo: false });

test('el dueño ve cuántas personas guardaron su publicación', async () => {
  mockMisPublicaciones.mockReturnValue({ datos: [publicacion()], cargando: false });
  mockContactos.mockReturnValue(new Map());
  conConteo({ p1: 4 });
  await render(<PublicacionesScreen />);
  expect(await screen.findByText('4 personas la guardaron')).toBeTruthy();
});

test('con una usa el singular', async () => {
  mockMisPublicaciones.mockReturnValue({ datos: [publicacion()], cargando: false });
  mockContactos.mockReturnValue(new Map());
  conConteo({ p1: 1 });
  await render(<PublicacionesScreen />);
  expect(await screen.findByText('1 persona la guardó')).toBeTruthy();
});

// Para el dueño un cero es un dato verdadero (como «0 personas pidieron tu contacto»)...
test('un cero de verdad se dice', async () => {
  mockMisPublicaciones.mockReturnValue({ datos: [publicacion()], cargando: false });
  mockContactos.mockReturnValue(new Map());
  conConteo({ p1: 0 });
  await render(<PublicacionesScreen />);
  expect(await screen.findByText('0 personas la guardaron')).toBeTruthy();
});

// ...pero un fallo o una carga NO se convierten en cero (END-11).
test('sin dato (cargando o falló) no se afirma un cero', async () => {
  mockMisPublicaciones.mockReturnValue({ datos: [publicacion()], cargando: false });
  mockContactos.mockReturnValue(new Map());
  conConteo({});
  await render(<PublicacionesScreen />);
  await screen.findByText('Depa centro');
  expect(screen.queryByText(/la guard/)).toBeNull();
});

test('pide el conteo de TODAS sus publicaciones en una sola consulta', async () => {
  mockMisPublicaciones.mockReturnValue({ datos: [publicacion({ id: 'p1' }), publicacion({ id: 'p2' })], cargando: false });
  mockContactos.mockReturnValue(new Map());
  await render(<PublicacionesScreen />);
  await screen.findAllByText('Depa centro');
  expect(mockConteo).toHaveBeenCalledWith(['p1', 'p2']);
});

// Cuervo 360 · lo que se ve depende de las funciones APROBADAS.
describe('según la función', () => {
  beforeEach(() => {
    mockMisPublicaciones.mockReturnValue({ datos: [], cargando: false });
  });
  afterEach(() => { mockRolesPublicar = [rolAprobado('arrendador')]; });

  test('un arrendador ve sus publicaciones y NO la sección de negocio', async () => {
    mockRolesPublicar = [rolAprobado('arrendador')];
    await render(<PublicacionesScreen />);
    expect(screen.getByText('Mis publicaciones')).toBeTruthy();
    expect(screen.queryByText('SECCION MI NEGOCIO')).toBeNull();
  });

  test('un comerciante ve «Mi negocio» y NO las publicaciones de depas', async () => {
    mockRolesPublicar = [rolAprobado('comerciante')];
    await render(<PublicacionesScreen />);
    expect(screen.getByText('Mi negocio')).toBeTruthy();
    expect(screen.getByText('SECCION MI NEGOCIO')).toBeTruthy();
    expect(screen.queryByText('Mis publicaciones')).toBeNull();
    expect(screen.queryByLabelText('Crear una nueva publicación')).toBeNull();
  });

  test('con las dos funciones ve las dos cosas', async () => {
    mockRolesPublicar = [rolAprobado('arrendador'), rolAprobado('comerciante')];
    await render(<PublicacionesScreen />);
    expect(screen.getByText('Mis publicaciones')).toBeTruthy();
    expect(screen.getByText('SECCION MI NEGOCIO')).toBeTruthy();
  });
});
