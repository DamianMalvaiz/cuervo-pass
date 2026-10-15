import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// Scroll al primer error · el cuestionario.
//
// Mismo mecanismo que el formulario de publicación: el formulario no mueve el
// ScrollView —es de la pantalla—, solo le pasa al `desplazador` el nodo del
// mensaje de error del PRIMER campo que falla, en el orden de la pantalla. Aquí
// se comprueba a qué nodo; que el desplazamiento llegue bien en un teléfono no se
// puede juzgar en Jest.

import { UNIVERSIDADES } from '@/lib/universidades';

import { FormularioCuestionario } from '../FormularioCuestionario';

const UTVT = UNIVERSIDADES[0];

const COMPLETO = {
  universidad: UTVT.nombre,
  presupuestoMin: 2000,
  presupuestoMax: 5000,
  distanciaMaxKm: 10,
  mascotas: false,
  fuma: false,
  nivelRuido: 'medio' as const,
  buscaRoomie: false,
  textoLibre: undefined,
  consienteIa: false,
};

/** El mensaje de error que contiene el nodo al que se pidió desplazarse. */
const mensajeDe = (nodo: { props: { children: { props: { children: string } } } }) =>
  nodo.props.children.props.children;

const pintar = async (alNodo = jest.fn()) => {
  await render(
    <FormularioCuestionario
      valoresIniciales={COMPLETO}
      onCompletar={jest.fn().mockResolvedValue(undefined)}
      desplazador={{ alNodo }}
    />
  );
  return alNodo;
};

const enviar = () => fireEvent.press(screen.getByLabelText('Guardar y continuar'));

afterEach(cleanup);

beforeEach(() => {
  jest.clearAllMocks();
});

test('con dos errores, va al PRIMERO de la pantalla', async () => {
  const alNodo = await pintar();
  // La distancia está DESPUÉS del presupuesto en la pantalla, y aquí se rompe antes.
  await fireEvent.changeText(screen.getByPlaceholderText(/^5$/), '0');
  await fireEvent.changeText(screen.getByPlaceholderText(/^2000$/), 'dos mil');

  await enviar();

  await waitFor(() => expect(alNodo).toHaveBeenCalledTimes(1));
  expect(mensajeDe(alNodo.mock.calls[0][0])).toBe('Solo números');
});

// «Otra» sin nombre es un error de un campo que aparece solo con esa opción, y
// ese mensaje no pasa por `Campo`: es otra ruta de anclaje.
test('«Otra» sin nombre lleva al campo del nombre', async () => {
  const alNodo = await pintar();
  await fireEvent.press(screen.getByLabelText(/Otra \(escribir\)/));

  await enviar();

  await waitFor(() => expect(alNodo).toHaveBeenCalledTimes(1));
  expect(mensajeDe(alNodo.mock.calls[0][0])).toBe('Escribe el nombre completo de tu universidad');
});

test('un cuestionario válido no desplaza nada', async () => {
  const alNodo = await pintar();

  await enviar();
  await waitFor(() => expect(screen.getByLabelText('Guardar y continuar')).toBeTruthy());

  expect(alNodo).not.toHaveBeenCalled();
});

test('un segundo intento fallido vuelve a desplazar', async () => {
  const alNodo = await pintar();
  await fireEvent.changeText(screen.getByPlaceholderText(/^2000$/), 'dos mil');

  await enviar();
  await waitFor(() => expect(alNodo).toHaveBeenCalledTimes(1));
  await enviar();

  await waitFor(() => expect(alNodo).toHaveBeenCalledTimes(2));
});

test('sin desplazador un envío inválido sigue funcionando', async () => {
  await render(
    <FormularioCuestionario
      valoresIniciales={COMPLETO}
      onCompletar={jest.fn().mockResolvedValue(undefined)}
    />
  );
  await fireEvent.changeText(screen.getByPlaceholderText(/^2000$/), 'dos mil');

  await enviar();

  expect(await screen.findByText('Solo números')).toBeTruthy();
});
