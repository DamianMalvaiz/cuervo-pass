import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
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
const mockContactos = jest.fn();
const mockMutar = jest.fn();

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/hooks/queries/usePublicaciones', () => ({
  useMisPublicaciones: (...a: unknown[]) => mockMisPublicaciones(...a),
  useContactosRecibidos: (...a: unknown[]) => mockContactos(...a),
  useCambiarEstadoPublicacion: () => ({ mutateAsync: mockMutar }),
}));
jest.mock('@/hooks/use-fotos-firmadas', () => ({
  useFotosFirmadas: (rutas: (string | null | undefined)[]) => ({
    urls: new Map(rutas.filter(Boolean).map((r) => [r, `https://firmada.test/${r}`])),
    fallo: null,
  }),
}));
// Cuervo 360 · la pantalla pasa por `GuardaPublicar`; estas pruebas son de la pantalla del dueño, así
// que se le da una cuenta con una función aprobada. La guarda tiene sus propias pruebas.
jest.mock('@/hooks/queries/useRoles', () => ({
  useMisRoles: () => ({
    roles: [{ usuario_id: 'u1', rol: 'arrendador', estado: 'aprobado', origen: 'solicitud', desde: 'x' }],
    cargando: false, fallo: false, reintentar: jest.fn(),
  }),
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
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  useToastStore.setState({ actual: null });
  mockMisPublicaciones.mockReturnValue({ datos: [publicacion()], cargando: false });
  mockContactos.mockReturnValue(new Map([['p1', 3]]));
  mockMutar.mockResolvedValue(undefined);
});

/** Toca la acción y devuelve los argumentos con los que se abrió el diálogo. */
async function tocar(etiqueta: string) {
  await act(async () => {
    fireEvent.press(screen.getByLabelText(etiqueta));
  });
  await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
  return (Alert.alert as jest.Mock).mock.calls[0];
}

/** Pulsa el botón de confirmación del diálogo abierto (el que no es Cancelar). */
async function confirmar(botones: { text: string; onPress?: () => unknown }[]) {
  const boton = botones.find((b) => b.text !== 'Cancelar');
  await act(async () => {
    await boton?.onPress?.();
  });
}

test('el primer toque solo pregunta: no muta nada', async () => {
  await render(<PublicacionesScreen />);
  await tocar('Desactivar Depa centro');
  expect(mockMutar).not.toHaveBeenCalled();
});

test('al confirmar, desactiva con activa=false', async () => {
  await render(<PublicacionesScreen />);
  const [, , botones] = await tocar('Desactivar Depa centro');
  await confirmar(botones);
  expect(mockMutar).toHaveBeenCalledWith({ id: 'p1', activa: false });
});

// Una inactiva ofrece lo contrario. Si la etiqueta y la mutación se
// desincronizaran, el dueño pulsaría «Reactivar» y la volvería a apagar.
test('una inactiva ofrece reactivar, y reactiva con activa=true', async () => {
  mockMisPublicaciones.mockReturnValue({ datos: [publicacion({ activa: false })], cargando: false });
  await render(<PublicacionesScreen />);
  expect(screen.getByText('Inactiva: no aparece en las sugerencias')).toBeTruthy();
  const [, , botones] = await tocar('Reactivar Depa centro');
  await confirmar(botones);
  expect(mockMutar).toHaveBeenCalledWith({ id: 'p1', activa: true });
});

// END-27 · El código manda, no el idioma del servidor. Este error trae el texto
// en inglés a propósito: con la comprobación por subcadena que había antes,
// esta prueba fallaría.
test('END-27 · el límite de 15 se reconoce por código, no por el texto', async () => {
  mockMutar.mockRejectedValue({ code: 'CP002', message: 'maximum of 15 active listings reached' });
  mockMisPublicaciones.mockReturnValue({ datos: [publicacion({ activa: false })], cargando: false });
  await render(<PublicacionesScreen />);
  const [, , botones] = await tocar('Reactivar Depa centro');
  await confirmar(botones);

  // Paso 3 · el fallo se AVISA. Solo se queda como Alert la pregunta de confirmar.
  expect(useToastStore.getState().actual).toMatchObject({ tipo: 'error' });
  expect(useToastStore.getState().actual?.mensaje).toContain('No se pudo cambiar el estado');
  expect(useToastStore.getState().actual?.mensaje).toContain('15 publicaciones activas');
});

test('un fallo sin código da el mensaje genérico, no el del límite', async () => {
  mockMutar.mockRejectedValue(new Error('network request failed'));
  await render(<PublicacionesScreen />);
  const [, , botones] = await tocar('Desactivar Depa centro');
  await confirmar(botones);

  expect(useToastStore.getState().actual).toMatchObject({
    tipo: 'error',
    mensaje: 'No se pudo cambiar el estado. Intenta de nuevo en un momento.',
  });
  expect(useToastStore.getState().actual?.mensaje).not.toContain('15');
});

// Paso 3 · antes, un cambio exitoso no decía nada: la publicación solo cambiaba de
// aspecto en la lista, y quien estaba mirando otra cosa no se enteraba.
test('al desactivar bien, se confirma con un aviso de éxito', async () => {
  await render(<PublicacionesScreen />);
  const [, , botones] = await tocar('Desactivar Depa centro');
  await confirmar(botones);

  expect(useToastStore.getState().actual).toMatchObject({ tipo: 'exito', mensaje: 'Publicación desactivada' });
});

test('al reactivar bien, se confirma con un aviso de éxito', async () => {
  mockMisPublicaciones.mockReturnValue({ datos: [publicacion({ activa: false })], cargando: false });
  await render(<PublicacionesScreen />);
  const [, , botones] = await tocar('Reactivar Depa centro');
  await confirmar(botones);

  expect(useToastStore.getState().actual).toMatchObject({ tipo: 'exito', mensaje: 'Publicación reactivada' });
});

// Un fallo no debe dar también el aviso de éxito.
test('si falla, NO hay aviso de éxito', async () => {
  mockMutar.mockRejectedValue(new Error('sin red'));
  await render(<PublicacionesScreen />);
  const [, , botones] = await tocar('Desactivar Depa centro');
  await confirmar(botones);

  expect(useToastStore.getState().actual?.tipo).toBe('error');
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
  expect(screen.getByText('SIN PUBLICACIONES')).toBeTruthy();
  expect(screen.getByText('0 PUBLICACIONES')).toBeTruthy();
});

test('mientras carga no dice que no hay nada', async () => {
  mockMisPublicaciones.mockReturnValue({ datos: [], cargando: true });
  await render(<PublicacionesScreen />);
  expect(screen.queryByText('SIN PUBLICACIONES')).toBeNull();
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
