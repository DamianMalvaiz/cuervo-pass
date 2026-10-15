import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// Mensajes de validación en español · el cuestionario sin valores iniciales.
//
// El presupuesto nace `undefined` cuando no hay perfil previo, y Zod 4 responde
// en INGLÉS. Es el primer formulario que ve una cuenta nueva.

import { useToastStore } from '@/store/useToastStore';

import { FormularioCuestionario } from '../FormularioCuestionario';

afterEach(cleanup);

beforeEach(() => {
  jest.clearAllMocks();
  useToastStore.setState({ actual: null });
});

const enIngles = /invalid input|expected|received|too small|required/i;

test('enviar sin presupuesto no muestra ningún mensaje en inglés', async () => {
  await render(<FormularioCuestionario onCompletar={jest.fn()} />);

  await fireEvent.press(screen.getByLabelText('Guardar y continuar'));
  await waitFor(() => expect(useToastStore.getState().actual).not.toBeNull());

  expect(screen.queryByText(enIngles)).toBeNull();
});

test('el presupuesto sin tocar dice que es obligatorio', async () => {
  await render(<FormularioCuestionario onCompletar={jest.fn()} />);

  await fireEvent.press(screen.getByLabelText('Guardar y continuar'));

  // Mínimo y máximo.
  const avisos = await screen.findAllByText('Este campo es obligatorio');
  expect(avisos).toHaveLength(2);
});
