import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// Recuperar contraseña con el código de 6 dígitos del correo.
//
// Lo delicado no es cambiar la contraseña: es lo que pasa ENTRE verificar el código y cambiarla. Verificar abre
// sesión (Supabase deja entrar a quien prueba tener el correo) y el código sirve una sola vez. De ahí salen
// cuatro reglas que estas pruebas fijan:
//
//   · Una contraseña que no cumple NO gasta el código: se valida en el teléfono ANTES de verificar.
//   · Si cambiar la contraseña falla después de verificar, se reintenta SIN pedir otro código.
//   · Quien verifica y se va sin cambiarla no se queda dentro de la cuenta: se le cierra la sesión.
//   · Al terminar bien, se cierra la sesión y se manda al inicio de sesión (no se entra con la contraseña vieja
//     ni con la nueva sin haberla escrito).

const mockPedir = jest.fn();
const mockCambiar = jest.fn();
const mockVerificar = jest.fn();
const mockCerrarSesion = jest.fn();
const mockReplace = jest.fn();
const mockToastExito = jest.fn();

jest.mock('expo-router', () => ({ router: { replace: (...a: unknown[]) => mockReplace(...a), back: jest.fn(), push: jest.fn() } }));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: (...a: unknown[]) => mockPedir(...a),
      updateUser: (...a: unknown[]) => mockCambiar(...a),
    },
  },
}));
jest.mock('@/lib/codigoCorreo', () => ({
  ...jest.requireActual('@/lib/codigoCorreo'),
  verificarCodigo: (...a: unknown[]) => mockVerificar(...a),
}));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ cerrarSesion: mockCerrarSesion }),
}));
jest.mock('@/lib/toast', () => ({ toast: { exito: (...a: unknown[]) => mockToastExito(...a), error: jest.fn(), info: jest.fn() } }));
jest.mock('@/lib/registro', () => ({ aviso: jest.fn(), fallo: jest.fn() }));

import RecuperarScreen from '../recuperar-contrasena';

const interactuar = async (fn: () => void) => { await act(async () => { fn(); }); };

const CORREO = 'ana@utvtol.edu.mx';
const BUENA = 'Contrasena#2026';

const llegarAlCodigo = async (correo = CORREO) => {
  await render(<RecuperarScreen />);
  await interactuar(() => fireEvent.changeText(screen.getByPlaceholderText('tucorreo@ejemplo.mx'), correo));
  await interactuar(() => fireEvent.press(screen.getByLabelText('Enviar código')));
  await waitFor(() => expect(screen.getByLabelText('Código de 6 dígitos')).toBeTruthy());
};
// `repite` se resuelve dentro y no como valor por omisión de otro parámetro del mismo destructuring: TypeScript no
// puede inferir su tipo (TS7022), la misma trampa que documenta `registro.test.tsx`.
const rellenar = async ({ codigo = '123456', nueva = BUENA, repite }: { codigo?: string; nueva?: string; repite?: string } = {}) => {
  await interactuar(() => fireEvent.changeText(screen.getByLabelText('Código de 6 dígitos'), codigo));
  await interactuar(() => fireEvent.changeText(screen.getByLabelText('Contraseña nueva'), nueva));
  await interactuar(() => fireEvent.changeText(screen.getByLabelText('Repite la contraseña nueva'), repite ?? nueva));
};
const cambiar = () => interactuar(() => fireEvent.press(screen.getByLabelText('Cambiar contraseña')));

beforeEach(() => {
  jest.clearAllMocks();
  mockPedir.mockResolvedValue({ error: null });
  mockCambiar.mockResolvedValue({ error: null });
  mockCerrarSesion.mockResolvedValue(undefined);
  mockVerificar.mockResolvedValue({ estado: 'ok', session: { user: { id: 'u1' } } });
});

describe('pedir el código', () => {
  it('un correo registrado y uno que no existe llegan al MISMO paso: no se filtra quién tiene cuenta', async () => {
    await llegarAlCodigo('noexiste@utvtol.edu.mx');

    expect(screen.getByLabelText('Contraseña nueva')).toBeTruthy();
    expect(screen.queryByText(/no (está|esta) registrad/i)).toBeNull();
  });
});

describe('cambiar la contraseña', () => {
  it('camino feliz: verifica, cambia, cierra sesión y manda al inicio de sesión', async () => {
    await llegarAlCodigo();
    await rellenar();
    await cambiar();

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/login'));
    expect(mockVerificar).toHaveBeenCalledWith(CORREO, '123456', 'recovery');
    expect(mockCambiar).toHaveBeenCalledWith({ password: BUENA });
    expect(mockCerrarSesion).toHaveBeenCalledTimes(1);
    expect(mockToastExito).toHaveBeenCalledTimes(1);
  });

  it('una contraseña que no cumple NO gasta el código', async () => {
    await llegarAlCodigo();
    await rellenar({ nueva: 'corta1' });
    await cambiar();

    expect(mockVerificar).not.toHaveBeenCalled();
    expect(mockCambiar).not.toHaveBeenCalled();
  });

  it('si la confirmación no coincide, no se envía nada', async () => {
    await llegarAlCodigo();
    await rellenar({ repite: 'Otra#2026Cosa' });
    await cambiar();

    await waitFor(() => expect(screen.getByText(/no coinciden/i)).toBeTruthy());
    expect(mockVerificar).not.toHaveBeenCalled();
  });

  it('código incorrecto o vencido: lo dice, no cambia nada y no hay sesión que cerrar', async () => {
    mockVerificar.mockResolvedValue({ estado: 'invalido' });
    await llegarAlCodigo();
    await rellenar();
    await cambiar();

    await waitFor(() => expect(screen.getByText(/Código incorrecto o vencido/i)).toBeTruthy());
    expect(mockCambiar).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('demasiados intentos: dice que espere, no que el código esté mal', async () => {
    mockVerificar.mockResolvedValue({ estado: 'limite' });
    await llegarAlCodigo();
    await rellenar();
    await cambiar();

    await waitFor(() => expect(screen.getByText(/Demasiados intentos/i)).toBeTruthy());
    expect(screen.queryByText(/Código incorrecto/i)).toBeNull();
  });

  it('un fallo de red NO se pinta como «código incorrecto»', async () => {
    mockVerificar.mockResolvedValue({ estado: 'fallo' });
    await llegarAlCodigo();
    await rellenar();
    await cambiar();

    await waitFor(() => expect(screen.getByText(/No pudimos verificar el código/i)).toBeTruthy());
    expect(screen.queryByText(/Código incorrecto/i)).toBeNull();
  });

  it('si cambiar la contraseña falla tras verificar, se reintenta SIN verificar otra vez el código', async () => {
    mockCambiar.mockResolvedValueOnce({ error: new Error('weak_password') }).mockResolvedValueOnce({ error: null });
    await llegarAlCodigo();
    await rellenar();
    await cambiar();

    await waitFor(() => expect(screen.getByText(/No pudimos cambiar la contraseña/i)).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();

    await cambiar();

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/login'));
    expect(mockVerificar).toHaveBeenCalledTimes(1);
    expect(mockCambiar).toHaveBeenCalledTimes(2);
  });

  it('un doble toque verifica UNA vez: el código sirve una sola vez', async () => {
    mockVerificar.mockImplementation(() => new Promise(() => {}));
    await llegarAlCodigo();
    await rellenar();

    await cambiar();
    await cambiar();

    expect(mockVerificar).toHaveBeenCalledTimes(1);
  });
});

// Van al final: `unmount()` envenena los renders posteriores del archivo (ver bitacora-semanal.md).
describe('abandonar la pantalla', () => {
  it('sin haber verificado, no hay sesión que cerrar', async () => {
    await llegarAlCodigo();
    await interactuar(() => screen.unmount());

    expect(mockCerrarSesion).not.toHaveBeenCalled();
  });

  it('tras verificar y sin cambiar la contraseña, se cierra la sesión que abrió el código', async () => {
    mockCambiar.mockResolvedValue({ error: new Error('weak_password') });
    await llegarAlCodigo();
    await rellenar();
    await cambiar();
    await waitFor(() => expect(screen.getByText(/No pudimos cambiar la contraseña/i)).toBeTruthy());
    expect(mockCerrarSesion).not.toHaveBeenCalled();

    await interactuar(() => screen.unmount());

    expect(mockCerrarSesion).toHaveBeenCalledTimes(1);
  });

  it('tras cambiarla bien, salir no cierra la sesión por segunda vez', async () => {
    await llegarAlCodigo();
    await rellenar();
    await cambiar();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/login'));

    await interactuar(() => screen.unmount());

    expect(mockCerrarSesion).toHaveBeenCalledTimes(1);
  });
});
