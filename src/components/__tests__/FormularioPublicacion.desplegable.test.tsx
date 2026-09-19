import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// El desplegable de direccion se cambio de FlatList a ScrollView el 19/09/2026:
// vivia DENTRO del ScrollView vertical del formulario, y ahi la virtualizacion
// no funciona porque la lista interna nunca conoce su ventana visible. React
// Native lo advertia con razon.
//
// El cambio compilaba, pasaba lint y pasaba las 61 pruebas... porque ninguna
// tocaba este componente. Estas lo ejercitan: que las opciones se pinten, que
// se puedan elegir, y que el caso vacio siga diciendo algo.

const mockBuscarPorCodigoPostal = jest.fn();
const mockBuscarCalles = jest.fn();

jest.mock('@/lib/direccionMx', () => ({
  buscarPorCodigoPostal: (...a: unknown[]) => mockBuscarPorCodigoPostal(...a),
}));
jest.mock('@/lib/mapboxAutocomplete', () => ({
  buscarCalles: (...a: unknown[]) => mockBuscarCalles(...a),
}));
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  MediaTypeOptions: { Images: 'Images' },
}));

import { FormularioPublicacion } from '../FormularioPublicacion';

beforeEach(() => {
  jest.clearAllMocks();
  mockBuscarCalles.mockResolvedValue([]);
  mockBuscarPorCodigoPostal.mockResolvedValue({
    estado: 'México',
    municipio: 'San Mateo Atenco',
    localidad: 'San Mateo Atenco',
    colonias: ['Guadalupe', 'La Magdalena', 'San Isidro'],
  });
});

// `render` es asincrono en esta version de la libreria: sin el await, `screen`
// queda sin poblar y todo falla con "render function has not been called", que
// no se parece en nada a la causa.
const montar = () =>
  render(<FormularioPublicacion onGuardar={jest.fn()} textoBoton="Publicar" />);

test('el desplegable de colonia esta cerrado al inicio', async () => {
  await montar();
  expect(await screen.findByLabelText('Colonia', {}, { timeout: 5000 })).toBeTruthy();
  expect(screen.queryByText('Guadalupe')).toBeNull();
});

test('al escribir un codigo postal se cargan las colonias y se pintan al abrir', async () => {
  await montar();
  fireEvent.changeText(screen.getByLabelText('Código postal'), '52104');
  await waitFor(() => expect(mockBuscarPorCodigoPostal).toHaveBeenCalledWith('52104'));

  fireEvent.press(await screen.findByLabelText('Colonia', {}, { timeout: 5000 }));

  // Las TRES opciones, no solo la primera: si el contenedor recortara el
  // contenido —que es justo el riesgo al cambiar de lista virtualizada a
  // ScrollView— aqui faltaria alguna.
  expect(await screen.findByText('Guadalupe', {}, { timeout: 5000 })).toBeTruthy();
  expect(await screen.findByText('La Magdalena', {}, { timeout: 5000 })).toBeTruthy();
  expect(await screen.findByText('San Isidro', {}, { timeout: 5000 })).toBeTruthy();
});

test('elegir una colonia la fija en el campo y cierra la lista', async () => {
  await montar();
  fireEvent.changeText(screen.getByLabelText('Código postal'), '52104');
  await waitFor(() => expect(mockBuscarPorCodigoPostal).toHaveBeenCalled());

  fireEvent.press(await screen.findByLabelText('Colonia', {}, { timeout: 5000 }));
  expect(await screen.findByText('La Magdalena', {}, { timeout: 5000 })).toBeTruthy();
  fireEvent.press(await screen.findByLabelText('Elegir La Magdalena', {}, { timeout: 5000 }));

  await waitFor(() => expect(screen.queryByText('San Isidro')).toBeNull());
  expect(await screen.findByText('La Magdalena', {}, { timeout: 5000 })).toBeTruthy();
});

// Sin opciones el desplegable no puede dejar a nadie atrapado. Colonia se
// declara con permiteBuscar={false}, asi que su lista SIEMPRE termina en "Otra
// (escribir)": aunque el codigo postal no devuelva nada, hay salida.
//
// Lo comprobe al reves primero —esperaba "Escribe para buscar"— y la equivocada
// era la expectativa, no el codigo.
test('sin opciones, colonia sigue ofreciendo escribirla a mano', async () => {
  mockBuscarPorCodigoPostal.mockResolvedValue(null);
  await montar();
  fireEvent.press(await screen.findByLabelText('Colonia', {}, { timeout: 5000 }));
  expect(await screen.findByText('Otra (escribir)', {}, { timeout: 5000 })).toBeTruthy();
});

// Calle si es de busqueda remota (permiteBuscar por omision), y ahi el estado
// vacio tiene que decir que hay que teclear en vez de quedarse en blanco.
test('calle vacia dice que hay que escribir, no queda en blanco', async () => {
  await montar();
  fireEvent.press(await screen.findByLabelText('Calle', {}, { timeout: 5000 }));
  expect(await screen.findByText('Escribe para buscar', {}, { timeout: 5000 })).toBeTruthy();
});

// La busqueda de calles es remota y va con retardo: mientras corre hay que
// verlo, o parece que el desplegable esta roto.
test('al teclear una calle se consulta el autocompletado', async () => {
  // buscarCalles devuelve SugerenciaCalle[] = { texto }[], no cadenas: el
  // formulario hace resultados.map(r => r.texto). Un mock con cadenas sueltas
  // produce una lista de undefined sin que nada se queje.
  mockBuscarCalles.mockResolvedValue([{ texto: 'Avenida Hidalgo' }, { texto: 'Calle Hidalgo Sur' }]);
  await montar();
  fireEvent.press(await screen.findByLabelText('Calle', {}, { timeout: 5000 }));
  // findBy y no getBy: abrir el desplegable es un cambio de estado, y el campo
  // de busqueda no existe hasta que React vuelve a pintar.
  fireEvent.changeText(await screen.findByLabelText('Buscar Calle'), 'Hidalgo');
  await waitFor(() => expect(mockBuscarCalles).toHaveBeenCalled(), { timeout: 3000 });
  expect(await screen.findByText('Avenida Hidalgo', {}, { timeout: 5000 })).toBeTruthy();
  expect(await screen.findByText('Calle Hidalgo Sur', {}, { timeout: 5000 })).toBeTruthy();
});

// El CP que no existe tiene que decirlo: antes el formulario se quedaba mudo y
// parecia que la busqueda seguia en marcha.
test('un codigo postal inexistente se avisa en pantalla', async () => {
  mockBuscarPorCodigoPostal.mockResolvedValue(null);
  await montar();
  fireEvent.changeText(screen.getByLabelText('Código postal'), '99999');
  expect(await screen.findByText(/No encontramos ese código postal/, {}, { timeout: 5000 })).toBeTruthy();
});
