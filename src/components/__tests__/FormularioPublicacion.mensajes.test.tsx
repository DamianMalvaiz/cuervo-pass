import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// Mensajes de validación en español · el formulario de publicación vacío.
//
// Un campo que nunca se tocó vale `undefined`, y Zod 4 responde en INGLÉS —«Invalid
// input: expected string, received undefined»—. Eso es lo que se leía bajo cada
// campo al tocar «Publicar» con el formulario recién abierto, que es justo el caso
// que más ve quien evalúa la app.

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

import { useToastStore } from '@/store/useToastStore';

import { FormularioPublicacion } from '../FormularioPublicacion';

afterEach(cleanup);

beforeEach(() => {
  jest.clearAllMocks();
  useToastStore.setState({ actual: null });
  mockBuscarCalles.mockResolvedValue([]);
  mockBuscarPorCodigoPostal.mockResolvedValue(null);
});

const enIngles = /invalid input|expected|received|too small|required/i;

test('enviar el formulario vacío no muestra ningún mensaje en inglés', async () => {
  await render(<FormularioPublicacion onGuardar={jest.fn()} textoBoton="Guardar" />);

  await fireEvent.press(screen.getByLabelText('Guardar'));
  await waitFor(() => expect(useToastStore.getState().actual).not.toBeNull());

  expect(screen.queryByText(enIngles)).toBeNull();
});

test('los campos sin tocar dicen que son obligatorios', async () => {
  await render(<FormularioPublicacion onGuardar={jest.fn()} textoBoton="Guardar" />);

  await fireEvent.press(screen.getByLabelText('Guardar'));

  // Título, calle, número exterior, código postal, colonia, localidad, municipio,
  // estado, precio y WhatsApp. No se fija el número exacto: lo que se comprueba es
  // que el aviso es el correcto y que hay varios.
  const avisos = await screen.findAllByText('Este campo es obligatorio');
  expect(avisos.length).toBeGreaterThanOrEqual(5);
});
