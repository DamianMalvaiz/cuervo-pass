import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// Scroll al primer error · el formulario de publicación.
//
// Con un pie fijo y dieciséis campos, un error puede quedar a varias pantallas de
// donde se tocó el botón. El aviso dice QUÉ revisar; esto lleva la vista hasta el
// PRIMER campo con error —el primero en el orden de la PANTALLA, no el primero en
// el que falló la validación—.
//
// El formulario no puede mover el ScrollView: es de la pantalla. Recibe un
// `desplazador` y le pasa el nodo del mensaje de error. Aquí se comprueba A QUÉ
// nodo; que el desplazamiento llegue bien en un teléfono no se puede juzgar en Jest.
//
// El nodo se identifica por el texto del mensaje que contiene, que es único por
// campo y no depende de cómo esté hecho el doble de `View`.

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

const DIRECCION =
  'Calle Zapata 224, Guadalupe, San Mateo Atenco, San Mateo Atenco, México, CP 52104';

const INICIALES = {
  titulo: 'Depa de 1 recámara',
  tipo: 'depa' as const,
  direccion: DIRECCION,
  precioRenta: '2500',
  descripcion: 'Cerca del campus',
  permiteMascotas: false,
  amueblado: true,
  serviciosIncluidos: false,
  recamaras: '1',
  whatsapp: '7221599193',
};

/** El mensaje de error que contiene el nodo al que se pidió desplazarse. */
const mensajeDe = (nodo: { props: { children: { props: { children: string } } } }) =>
  nodo.props.children.props.children;

afterEach(cleanup);

beforeEach(() => {
  jest.clearAllMocks();
  mockBuscarCalles.mockResolvedValue([]);
  mockBuscarPorCodigoPostal.mockResolvedValue(null);
});

const pintar = async (alNodo = jest.fn()) => {
  await render(
    <FormularioPublicacion
      onGuardar={jest.fn()}
      textoBoton="Guardar"
      valoresIniciales={INICIALES}
      desplazador={{ alNodo }}
    />
  );
  return alNodo;
};

test('con dos errores, va al PRIMERO de la pantalla, no al primero en romperse', async () => {
  const alNodo = await pintar();
  // whatsapp está DESPUÉS de precio en la pantalla, y aquí se rompe primero.
  await fireEvent.changeText(screen.getByLabelText('Número de WhatsApp, 10 dígitos'), '123');
  await fireEvent.changeText(screen.getByLabelText('Precio de renta mensual en pesos'), 'abc');

  await fireEvent.press(screen.getByLabelText('Guardar'));

  await waitFor(() => expect(alNodo).toHaveBeenCalledTimes(1));
  expect(mensajeDe(alNodo.mock.calls[0][0])).toBe('Solo números');
});

// El título es el primer campo de la pantalla: aunque otro también falle, va a él.
// Se rompe con un título demasiado corto, que tiene mensaje en español; un campo
// sin tocar (`undefined`) da el mensaje genérico de Zod en inglés, y eso no es lo
// que se quiere fijar aquí.
test('si falla el título, que es el primero de la pantalla, va al título', async () => {
  const alNodo = await pintar();
  await fireEvent.changeText(screen.getByLabelText('Precio de renta mensual en pesos'), 'abc');
  await fireEvent.changeText(screen.getByLabelText('Título de la publicación'), 'abc');

  await fireEvent.press(screen.getByLabelText('Guardar'));

  await waitFor(() => expect(alNodo).toHaveBeenCalledTimes(1));
  expect(mensajeDe(alNodo.mock.calls[0][0])).toBe('Escribe un título de al menos 5 caracteres');
});

// Un envío válido no mueve la vista: no hay a dónde ir.
test('un formulario válido no desplaza nada', async () => {
  const alNodo = await pintar();

  await fireEvent.press(screen.getByLabelText('Guardar'));
  await waitFor(() => expect(screen.getByLabelText('Guardar')).toBeTruthy());

  expect(alNodo).not.toHaveBeenCalled();
});

// Cada intento fallido vuelve a llevar a la vista al error: quien tocó el botón
// otra vez, ya desplazado a otro sitio, tiene que volver a ser llevado.
test('un segundo intento fallido vuelve a desplazar', async () => {
  const alNodo = await pintar();
  await fireEvent.changeText(screen.getByLabelText('Precio de renta mensual en pesos'), 'abc');

  await fireEvent.press(screen.getByLabelText('Guardar'));
  await waitFor(() => expect(alNodo).toHaveBeenCalledTimes(1));
  await fireEvent.press(screen.getByLabelText('Guardar'));

  await waitFor(() => expect(alNodo).toHaveBeenCalledTimes(2));
});

// Teclear NO debe volver a desplazar, ni tampoco que la pantalla recree su
// `desplazador`. El efecto depende del intento, no de cada render ni de esa prop:
// si dependiera de ella, la vista saltaría de vuelta al error en cada render de la
// pantalla, es decir, con cada tecla.
test('ni teclear ni recibir un desplazador nuevo vuelven a desplazar', async () => {
  const alNodo = jest.fn();
  const elemento = (d: { alNodo: typeof alNodo }) => (
    <FormularioPublicacion
      onGuardar={jest.fn()}
      textoBoton="Guardar"
      valoresIniciales={INICIALES}
      desplazador={d}
    />
  );
  const { rerender } = await render(elemento({ alNodo }));
  await fireEvent.changeText(screen.getByLabelText('Precio de renta mensual en pesos'), 'abc');
  await fireEvent.press(screen.getByLabelText('Guardar'));
  await waitFor(() => expect(alNodo).toHaveBeenCalledTimes(1));

  await fireEvent.changeText(screen.getByLabelText('Precio de renta mensual en pesos'), 'abcd');
  await rerender(elemento({ alNodo })); // un objeto NUEVO, como haría la pantalla
  await rerender(elemento({ alNodo }));

  expect(alNodo).toHaveBeenCalledTimes(1);
});

// El `desplazador` es opcional: el formulario también se usa sin ScrollView propio.
test('sin desplazador un envío inválido sigue funcionando', async () => {
  await render(
    <FormularioPublicacion onGuardar={jest.fn()} textoBoton="Guardar" valoresIniciales={INICIALES} />
  );
  await fireEvent.changeText(screen.getByLabelText('Precio de renta mensual en pesos'), 'abc');

  await fireEvent.press(screen.getByLabelText('Guardar'));

  expect(await screen.findByText('Solo números')).toBeTruthy();
});
