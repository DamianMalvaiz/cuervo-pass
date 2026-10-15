import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// Toast propio · paso 2 · el cuestionario avisa.
//
// Mismo defecto que el formulario de publicación: el botón vive en un pie fijo y
// los errores salen junto a cada campo, que puede estar fuera de pantalla. El
// error de envío —«no se pudo escribir el perfil»— se pintaba al final.

import { useToastStore } from '@/store/useToastStore';
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

const aviso = () => useToastStore.getState().actual;

const pintar = async (onCompletar = jest.fn().mockResolvedValue(undefined)) => {
  await render(<FormularioCuestionario valoresIniciales={COMPLETO} onCompletar={onCompletar} />);
  return onCompletar;
};

const enviar = async () => {
  await fireEvent.press(screen.getByLabelText('Guardar y continuar'));
};

afterEach(cleanup);

beforeEach(() => {
  jest.clearAllMocks();
  useToastStore.setState({ actual: null });
});

test('enviar con un campo inválido avisa cuál', async () => {
  const onCompletar = await pintar();
  // «Otra» sin nombre: el campo que aparece vacío y es obligatorio.
  await fireEvent.press(screen.getByLabelText(/Otra \(escribir\)/));
  await enviar();

  await waitFor(() => expect(aviso()).not.toBeNull());
  expect(aviso()).toMatchObject({ tipo: 'error', mensaje: 'Revisa el campo: Nombre de la universidad' });
  expect(onCompletar).not.toHaveBeenCalled();
});

test('el error junto al campo sigue ahí', async () => {
  await pintar();
  await fireEvent.press(screen.getByLabelText(/Otra \(escribir\)/));
  await enviar();

  expect(await screen.findByText('Escribe el nombre completo de tu universidad')).toBeTruthy();
});

test('un cuestionario válido no muestra ningún aviso', async () => {
  const onCompletar = await pintar();
  await enviar();
  await waitFor(() => expect(onCompletar).toHaveBeenCalled());

  expect(aviso()).toBeNull();
});

test('si guardar falla, avisa el motivo y lo deja también en el formulario', async () => {
  await pintar(jest.fn().mockRejectedValue(new Error('no se pudo escribir el perfil')));
  await enviar();

  await waitFor(() => expect(aviso()).not.toBeNull());
  expect(aviso()).toMatchObject({ tipo: 'error', mensaje: 'no se pudo escribir el perfil' });
  expect(await screen.findByText('no se pudo escribir el perfil')).toBeTruthy();
});
