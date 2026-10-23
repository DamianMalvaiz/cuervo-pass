import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// V.8 · Recuperar contraseña.
//
// Lo que esta pantalla tiene que hacer bien no es enviar un correo: es NO
// decir si esa cuenta existe. Un formulario que responde «ese correo no está
// registrado» es un oráculo de enumeración: se le prueban correos hasta saber
// quién tiene cuenta. En una app universitaria, donde los correos siguen un
// patrón previsible, eso es una lista de quién vive fuera de casa.
//
// `resetPasswordForEmail` de Supabase ya responde igual exista o no; lo que se
// fija aquí es que la PANTALLA no introduzca la diferencia por su cuenta.

const mockReset = jest.fn();

jest.mock('expo-router', () => ({ router: { replace: jest.fn(), back: jest.fn(), push: jest.fn() } }));
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { resetPasswordForEmail: (...a: unknown[]) => mockReset(...a) } },
}));
jest.mock('@/lib/registro', () => ({ aviso: jest.fn(), fallo: jest.fn() }));
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ cerrarSesion: jest.fn() }) }));
jest.mock('@/lib/toast', () => ({ toast: { exito: jest.fn(), error: jest.fn(), info: jest.fn() } }));

import RecuperarScreen from '../recuperar-contrasena';

const interactuar = async (fn: () => void) => { await act(async () => { fn(); }); };

const pedirEnlace = async (email: string) => {
  await render(<RecuperarScreen />);
  await interactuar(() => fireEvent.changeText(screen.getByPlaceholderText('tucorreo@ejemplo.mx'), email));
  await interactuar(() => fireEvent.press(screen.getByLabelText('Enviar código')));
};

beforeEach(() => {
  jest.clearAllMocks();
  mockReset.mockResolvedValue({ error: null });
});

it('un correo registrado y uno que no existe dan EL MISMO mensaje', async () => {
  await pedirEnlace('ana@utvtol.edu.mx');
  await waitFor(() => expect(screen.getByText(/Revisa tu correo/i)).toBeTruthy());
  const conCuenta = screen.getByText(/Revisa tu correo/i).props.children;

  await pedirEnlace('noexiste@utvtol.edu.mx');
  await waitFor(() => expect(screen.getByText(/Revisa tu correo/i)).toBeTruthy());

  expect(screen.getByText(/Revisa tu correo/i).props.children).toEqual(conCuenta);
});

it('nunca dice que la cuenta no existe', async () => {
  await pedirEnlace('noexiste@utvtol.edu.mx');
  await waitFor(() => expect(screen.getByText(/Revisa tu correo/i)).toBeTruthy());

  for (const delator of [/no (está|esta) registrad/i, /no existe/i, /no encontr/i, /sin cuenta/i]) {
    expect(screen.queryByText(delator)).toBeNull();
  }
});

it('si el envío falla de verdad, lo dice — eso sí es información del sistema', async () => {
  // Distinto del caso anterior: «no pudimos enviar» habla del servicio, no de
  // si esa persona tiene cuenta. No filtra nada.
  mockReset.mockResolvedValue({ error: new Error('smtp caido') });
  await pedirEnlace('ana@utvtol.edu.mx');

  await waitFor(() => expect(screen.getByText(/No se pudo enviar el correo/i)).toBeTruthy());
});

it('no envía nada si el correo no es válido', async () => {
  await pedirEnlace('esto-no-es-un-correo');
  expect(mockReset).not.toHaveBeenCalled();
});
