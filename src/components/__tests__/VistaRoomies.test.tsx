import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { useToastStore } from '@/store/useToastStore';

// V.8 · `roomies.tsx`. Tres propiedades que ninguna prueba cubría y que se
// rompen calladas:
//
//  · La descripción es lo que se VECTORIZA para ordenar la lista por afinidad.
//    Activar la búsqueda sin ella deja una ficha que aparece para los demás
//    pero que no puede ordenar nada: el motor compara contra un texto vacío.
//    Por eso el interruptor se niega, y por eso se prueba que se NIEGA — no
//    basta con que avise.
//  · Los campos se siembran UNA vez desde la ficha guardada. Si se sembraran en
//    cada render, escribir se sobreescribiría con el valor del servidor en el
//    siguiente refresco: el usuario ve desaparecer lo que acaba de teclear.
//    `sembrado` es un `useRef`, y un ref roto no lo atrapa ni tsc ni el lint.
//  · Si guardar falla, el interruptor VUELVE. Un interruptor que se queda
//    encendido tras un fallo afirma que la ficha está activa cuando no lo está,
//    que es el mismo defecto que END-11 en otra capa.

const mockRoomies = jest.fn();
const mockMiRoomie = jest.fn();
const mockMutar = jest.fn();

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/hooks/queries/useRoomies', () => ({
  useRoomiesSugeridos: (...a: unknown[]) => mockRoomies(...a),
  useMiRoomie: (...a: unknown[]) => mockMiRoomie(...a),
  useGuardarMiRoomie: () => ({ mutateAsync: mockMutar, isPending: false }),
}));
jest.mock('@/hooks/use-fotos-firmadas', () => ({
  useFotosFirmadas: (rutas: (string | null | undefined)[]) => ({
    urls: new Map(rutas.filter(Boolean).map((r) => [r, `https://firmada.test/${r}`])),
    fallo: null,
  }),
}));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1' } } }),
}));
jest.mock('@/lib/registro', () => ({ aviso: jest.fn(), fallo: jest.fn() }));

import { VistaRoomies } from '../vistas/VistaRoomies';

const DESCRIPCION = 'Busco cerca de la UTVT, no fumo, tengo gato.';

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  useToastStore.setState({ actual: null });
  mockRoomies.mockReturnValue({ roomies: [], cargando: false });
  mockMiRoomie.mockReturnValue({ miRoomie: null });
  mockMutar.mockResolvedValue(undefined);
});

const encender = async (valor = true) => {
  await act(async () => {
    fireEvent(screen.getByLabelText('Buscar roomie'), 'valueChange', valor);
  });
};

// El caso que importa: se niega. Antes de exigir esto, la comprobación podía
// avisar y guardar igual, y el aviso se leería como un consejo.
test('activar sin descripción avisa y NO guarda', async () => {
  await render(<VistaRoomies />);
  await encender();
  // Paso 3 · se AVISA, no se pregunta: no hay nada que decidir, solo que escribir.
  await waitFor(() => expect(useToastStore.getState().actual).not.toBeNull());
  expect(useToastStore.getState().actual).toMatchObject({ tipo: 'info' });
  expect(useToastStore.getState().actual?.mensaje).toContain('Falta tu descripción');
  expect(Alert.alert).not.toHaveBeenCalled();
  expect(mockMutar).not.toHaveBeenCalled();
});

// Diez caracteres es el umbral. «Hola» pasaría una comprobación de «no vacío».
test('una descripción demasiado corta tampoco activa', async () => {
  mockMiRoomie.mockReturnValue({ miRoomie: { descripcion_busqueda: 'Hola', estado: 'cerrado' } });
  await render(<VistaRoomies />);
  await encender();
  expect(mockMutar).not.toHaveBeenCalled();
});

test('con descripción suficiente, activar guarda como activo', async () => {
  mockMiRoomie.mockReturnValue({ miRoomie: { descripcion_busqueda: DESCRIPCION, estado: 'cerrado' } });
  await render(<VistaRoomies />);
  await encender();
  expect(mockMutar).toHaveBeenCalledWith({ descripcionBusqueda: DESCRIPCION, estado: 'activo' });
});

// Apagar no exige descripción: cerrar la ficha siempre debe poder hacerse.
test('apagar guarda como cerrado sin exigir nada', async () => {
  mockMiRoomie.mockReturnValue({ miRoomie: { descripcion_busqueda: DESCRIPCION, estado: 'activo' } });
  await render(<VistaRoomies />);
  await encender(false);
  expect(mockMutar).toHaveBeenCalledWith({ descripcionBusqueda: DESCRIPCION, estado: 'cerrado' });
  expect(Alert.alert).not.toHaveBeenCalled();
});

test('si guardar falla, el interruptor vuelve y se dice', async () => {
  mockMutar.mockRejectedValue(new Error('caido'));
  mockMiRoomie.mockReturnValue({ miRoomie: { descripcion_busqueda: DESCRIPCION, estado: 'cerrado' } });
  await render(<VistaRoomies />);
  await encender();

  await waitFor(() => expect(useToastStore.getState().actual).not.toBeNull());
  expect(useToastStore.getState().actual).toMatchObject({ tipo: 'error' });
  expect(useToastStore.getState().actual?.mensaje).toContain('No se pudo guardar');
  expect(Alert.alert).not.toHaveBeenCalled();
  // El interruptor vuelve a apagado: si se quedara encendido, afirmaría que la
  // ficha está activa cuando el servidor nunca la guardó.
  expect(screen.getByLabelText('Buscar roomie').props.value).toBe(false);
  // Y con él desaparece el campo, que solo existe con la búsqueda activa.
  expect(screen.queryByText('QUÉ BUSCAS')).toBeNull();
});

// Paso 3 · antes, activar o apagar la búsqueda solo movía el interruptor.
test('activar la búsqueda se confirma con un aviso de éxito', async () => {
  mockMiRoomie.mockReturnValue({ miRoomie: { descripcion_busqueda: DESCRIPCION, estado: 'cerrado' } });
  await render(<VistaRoomies />);
  await encender();

  expect(useToastStore.getState().actual).toMatchObject({
    tipo: 'exito',
    mensaje: 'Búsqueda de roomie activada',
  });
});

test('apagar la búsqueda también se confirma', async () => {
  mockMiRoomie.mockReturnValue({ miRoomie: { descripcion_busqueda: DESCRIPCION, estado: 'activo' } });
  await render(<VistaRoomies />);
  await encender(false);

  expect(useToastStore.getState().actual).toMatchObject({
    tipo: 'exito',
    mensaje: 'Búsqueda de roomie desactivada',
  });
});

// La descripción se guarda al salir del campo, SIN preguntar. Si fallaba, el
// rechazo quedaba sin atender: nadie veía nada y el indicador seguía diciendo
// «Sin guardar» sin explicar por qué. Es el invariante 2 aplicado a una escritura.
test('si guardar la descripción al salir del campo falla, se avisa', async () => {
  mockMiRoomie.mockReturnValue({ miRoomie: { descripcion_busqueda: DESCRIPCION, estado: 'activo' } });
  mockMutar.mockRejectedValue(new Error('sin red'));
  await render(<VistaRoomies />);

  await act(async () => {
    fireEvent(screen.getByPlaceholderText(/Zona, presupuesto/), 'blur');
  });

  await waitFor(() => expect(useToastStore.getState().actual).not.toBeNull());
  expect(useToastStore.getState().actual).toMatchObject({
    tipo: 'error',
    mensaje: 'No se pudo guardar la descripción. Revisa tu conexión e intenta de nuevo.',
  });
});

// El autoguardado ya tiene su indicador («Guardado»): un aviso de éxito en cada
// salida del campo sería ruido.
test('guardar la descripción bien NO lanza aviso: ya lo dice el indicador', async () => {
  mockMiRoomie.mockReturnValue({ miRoomie: { descripcion_busqueda: DESCRIPCION, estado: 'activo' } });
  await render(<VistaRoomies />);

  await act(async () => {
    fireEvent(screen.getByPlaceholderText(/Zona, presupuesto/), 'blur');
  });

  expect(mockMutar).toHaveBeenCalled();
  expect(useToastStore.getState().actual).toBeNull();
});

// La siembra de una sola vez. Un refresco del servidor NO debe pisar lo que se
// está escribiendo.
test('un refresco no pisa lo que el usuario acaba de teclear', async () => {
  mockMiRoomie.mockReturnValue({ miRoomie: { descripcion_busqueda: DESCRIPCION, estado: 'activo' } });
  const vista = await render(<VistaRoomies />);
  const campo = screen.getByPlaceholderText(/Zona, presupuesto/);
  expect(campo.props.value).toBe(DESCRIPCION);

  const nuevo = 'Ahora busco por el centro, con estacionamiento.';
  await act(async () => {
    fireEvent.changeText(campo, nuevo);
  });

  // Llega otra respuesta del servidor con el texto ANTERIOR — es lo que ocurre
  // cuando la consulta se refresca mientras se escribe.
  await act(async () => {
    vista.rerender(<VistaRoomies />);
  });
  expect(screen.getByPlaceholderText(/Zona, presupuesto/).props.value).toBe(nuevo);
});

// El estado se dice, no se adivina.
test('distingue «sin guardar» de «guardado»', async () => {
  mockMiRoomie.mockReturnValue({ miRoomie: { descripcion_busqueda: DESCRIPCION, estado: 'activo' } });
  await render(<VistaRoomies />);
  expect(screen.getByText('Guardado')).toBeTruthy();

  await act(async () => {
    fireEvent.changeText(screen.getByPlaceholderText(/Zona, presupuesto/), `${DESCRIPCION} Y más.`);
  });
  expect(screen.getByText(/Sin guardar/)).toBeTruthy();
});

// Salir del campo es lo que regenera el vector de búsqueda. Si no guardara, la
// afinidad seguiría calculándose contra el texto anterior.
test('salir del campo guarda la descripción nueva', async () => {
  mockMiRoomie.mockReturnValue({ miRoomie: { descripcion_busqueda: DESCRIPCION, estado: 'activo' } });
  await render(<VistaRoomies />);
  const campo = screen.getByPlaceholderText(/Zona, presupuesto/);
  const nuevo = 'Busco en el centro, con estacionamiento, sin fumadores.';
  // Dos `act` y no uno: en uno solo, React agrupa el cambio y el blur en el
  // mismo lote y el manejador del blur lee el `descripcion` del render
  // anterior — guarda el texto VIEJO. Comprobado al escribir esta prueba.
  //
  // En un teléfono son dos eventos nativos distintos, con un render entre
  // medias, así que no es el fallo que parece. Pero deja dicho lo que pasaría
  // si algún día el campo se volviera no controlado o se le pusiera un
  // `debounce` al `onChangeText`: el vector de búsqueda se regeneraría contra
  // el texto anterior, calladamente, y la lista quedaría ordenada por una
  // afinidad que ya no corresponde a lo que la persona escribió.
  await act(async () => {
    fireEvent.changeText(campo, nuevo);
  });
  await act(async () => {
    fireEvent(campo, 'blur');
  });
  expect(mockMutar).toHaveBeenCalledWith({ descripcionBusqueda: nuevo, estado: 'activo' });
});

test('sin registros lo dice en vez de dejar la lista muda', async () => {
  await render(<VistaRoomies />);
  expect(screen.getByText('SIN REGISTROS')).toBeTruthy();
});

// Vacío y cargando son estados distintos: §27.
test('mientras carga no afirma que no hay nadie', async () => {
  mockRoomies.mockReturnValue({ roomies: [], cargando: true });
  await render(<VistaRoomies />);
  expect(screen.queryByText('SIN REGISTROS')).toBeNull();
});

test('el conteo de personas concuerda en número', async () => {
  mockRoomies.mockReturnValue({
    roomies: [{ id: 'r1', usuario_id: 'o1', nombre_completo: 'Ana', descripcion_busqueda: 'Hola', foto_url: null, similitud: 0.9 }],
    cargando: false,
  });
  await render(<VistaRoomies />);
  expect(screen.getByText('1 PERSONA BUSCANDO')).toBeTruthy();
});


// ── Las ramas que quedaban ───────────────────────────────────────────────────

// `descripcion_busqueda: null` en la base. Si no se normalizara a cadena vacía,
// el campo mostraría «null» como texto y el contador diría 4/2000.
test('una descripción nula se siembra como vacía, no como «null»', async () => {
  mockMiRoomie.mockReturnValue({ miRoomie: { descripcion_busqueda: null, estado: 'activo' } });
  await render(<VistaRoomies />);
  expect(screen.getByPlaceholderText(/Zona, presupuesto/).props.value).toBe('');
  expect(screen.getByText('0/2000')).toBeTruthy();
});

// Apagar con la descripción vacía manda un texto por omisión y no una cadena
// vacía: la columna alimenta el vector de búsqueda, y un vector de nada haría
// que esa ficha apareciera al final de la lista de todo el mundo para siempre.
test('al apagar sin descripción se guarda un texto por omisión', async () => {
  mockMiRoomie.mockReturnValue({ miRoomie: { descripcion_busqueda: '', estado: 'activo' } });
  await render(<VistaRoomies />);
  await encender(false);
  expect(mockMutar).toHaveBeenCalledWith({ descripcionBusqueda: 'Busco roomie.', estado: 'cerrado' });
});

test('un roomie con foto se pinta con su tarjeta completa', async () => {
  mockRoomies.mockReturnValue({
    roomies: [{ id: 'r1', usuario_id: 'o1', nombre_completo: 'Ana', descripcion_busqueda: 'Hola', foto_url: 'o1/a.jpg', similitud: 0.9 }],
    cargando: false,
  });
  await render(<VistaRoomies />);
  expect(screen.getByText('Ana')).toBeTruthy();
});

// Cuervo 360 · la vista vive dentro de Inicio y recibe el selector de módulo. Sin él, quien
// entra a Roomies no tiene forma de volver a Depas: una vista sin salida.
test('pinta el selector que le pasa Inicio, arriba de su encabezado', async () => {
  const { Text } = require('react-native');
  await render(<VistaRoomies selector={<Text>SELECTOR DE PRUEBA</Text>} />);
  expect(await screen.findByText('SELECTOR DE PRUEBA')).toBeTruthy();
  expect(screen.queryByText('REGISTRO DE ROOMIES')).toBeNull();
});
