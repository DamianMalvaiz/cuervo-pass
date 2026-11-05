import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// «Cambiar contraseña», dentro de la app (antes solo existía «Olvidé mi contraseña»). Lo que se fija: pide la ACTUAL y la comprueba contra el servidor ANTES de
// tocar nada; la nueva cumple los mismos requisitos que al registrarse y es distinta de la actual; un fallo se dice y NO da aviso de éxito; y la promesa de
// «cerramos tus otras sesiones» se cumple de verdad (`signOut({ scope: 'others' })`), no se escribe a la ligera.

const mockSignIn = jest.fn();
const mockUpdate = jest.fn();
const mockSignOut = jest.fn();
const mockBack = jest.fn();
const mockExito = jest.fn();
const mockError = jest.fn();

jest.mock('expo-router', () => ({ router: { back: (...a: unknown[]) => mockBack(...a) } }));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...a: unknown[]) => mockSignIn(...a),
      updateUser: (...a: unknown[]) => mockUpdate(...a),
      signOut: (...a: unknown[]) => mockSignOut(...a),
    },
  },
}));
jest.mock('@/lib/toast', () => ({ toast: { exito: (...a: unknown[]) => mockExito(...a), error: (...a: unknown[]) => mockError(...a), info: jest.fn() } }));
jest.mock('@/lib/registro', () => ({ aviso: jest.fn(), fallo: jest.fn() }));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1', email: 'yo@utvtol.edu.mx' } } }),
}));
jest.mock('@/store/usePerfilStore', () => ({
  usePerfilStore: () => ({ perfil: { id: 'u1', nombre_usuario: 'yo_uno', nombre_completo: 'Yo Uno' } }),
}));

import CambiarContrasenaScreen from '../cambiar-contrasena';

const ACTUAL = 'ContrasenaVieja#1';
const NUEVA = 'ContrasenaNueva#2026';

const escribir = async (etiqueta: string, texto: string) => {
  await act(async () => { fireEvent.changeText(screen.getByLabelText(etiqueta), texto); });
};
const llenar = async (actual = ACTUAL, nueva = NUEVA, repite = nueva) => {
  await escribir('Contraseña actual', actual);
  await escribir('Contraseña nueva', nueva);
  await escribir('Repite la contraseña nueva', repite);
};
const guardar = async () => { await act(async () => { fireEvent.press(screen.getByLabelText('Guardar contraseña')); }); };

beforeEach(() => {
  jest.clearAllMocks();
  mockSignIn.mockResolvedValue({ error: null });
  mockUpdate.mockResolvedValue({ error: null });
  mockSignOut.mockResolvedValue({ error: null });
});

describe('antes de enviar', () => {
  it('el botón está apagado hasta que todo está bien', async () => {
    await render(<CambiarContrasenaScreen />);
    expect(screen.getByLabelText('Guardar contraseña').props.accessibilityState?.disabled).toBe(true);
    await llenar();
    expect(screen.getByLabelText('Guardar contraseña').props.accessibilityState?.disabled).toBe(false);
  });

  it('muestra los requisitos de la contraseña nueva, los mismos que al registrarse', async () => {
    await render(<CambiarContrasenaScreen />);
    await escribir('Contraseña nueva', 'abc');
    expect(screen.getByText(/10 caracteres/i)).toBeTruthy();
  });

  it('una contraseña nueva que no cumple deja el botón apagado', async () => {
    await render(<CambiarContrasenaScreen />);
    await llenar(ACTUAL, 'corta', 'corta');
    expect(screen.getByLabelText('Guardar contraseña').props.accessibilityState?.disabled).toBe(true);
  });

  it('si no coincide la repetición, lo dice y deja el botón apagado', async () => {
    await render(<CambiarContrasenaScreen />);
    await llenar(ACTUAL, NUEVA, NUEVA + 'x');
    expect(screen.getByText('Las contraseñas no coinciden')).toBeTruthy();
    expect(screen.getByLabelText('Guardar contraseña').props.accessibilityState?.disabled).toBe(true);
  });

  it('una nueva IGUAL a la actual se dice y no se envía', async () => {
    await render(<CambiarContrasenaScreen />);
    await llenar(NUEVA, NUEVA, NUEVA);
    expect(screen.getByText('La contraseña nueva debe ser distinta de la actual')).toBeTruthy();
    expect(screen.getByLabelText('Guardar contraseña').props.accessibilityState?.disabled).toBe(true);
  });
});

describe('al guardar', () => {
  it('comprueba la actual con el correo de la sesión ANTES de cambiar nada', async () => {
    const orden: string[] = [];
    mockSignIn.mockImplementation(async () => { orden.push('comprobar'); return { error: null }; });
    mockUpdate.mockImplementation(async () => { orden.push('cambiar'); return { error: null }; });
    await render(<CambiarContrasenaScreen />);
    await llenar();
    await guardar();
    expect(mockSignIn).toHaveBeenCalledWith({ email: 'yo@utvtol.edu.mx', password: ACTUAL });
    expect(mockUpdate).toHaveBeenCalledWith({ password: NUEVA });
    expect(orden).toEqual(['comprobar', 'cambiar']);
  });

  it('si la actual está mal, lo dice y NO cambia nada', async () => {
    mockSignIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    await render(<CambiarContrasenaScreen />);
    await llenar();
    await guardar();
    expect(screen.getByText('La contraseña actual no es correcta.')).toBeTruthy();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockExito).not.toHaveBeenCalled();
  });

  it('cambiada: cierra las OTRAS sesiones, avisa y vuelve', async () => {
    await render(<CambiarContrasenaScreen />);
    await llenar();
    await guardar();
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'others' });
    expect(mockExito).toHaveBeenCalledWith('Contraseña actualizada');
  });

  it('si no se pudieron cerrar las otras sesiones, la contraseña igual se cambió y se dice', async () => {
    mockSignOut.mockResolvedValue({ error: { message: 'x' } });
    await render(<CambiarContrasenaScreen />);
    await llenar();
    await guardar();
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(mockExito).toHaveBeenCalled();
  });

  it('si el servidor rechaza el cambio, se dice y NO hay aviso de éxito ni se vuelve', async () => {
    mockUpdate.mockResolvedValue({ error: { message: 'weak password' } });
    await render(<CambiarContrasenaScreen />);
    await llenar();
    await guardar();
    expect(screen.getByText(/No pudimos cambiar la contraseña/)).toBeTruthy();
    expect(mockExito).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('dos toques seguidos cambian la contraseña UNA vez', async () => {
    let seguir!: () => void;
    mockSignIn.mockReturnValue(new Promise((r) => { seguir = () => r({ error: null }); }));
    await render(<CambiarContrasenaScreen />);
    await llenar();
    await guardar();
    await guardar();
    expect(mockSignIn).toHaveBeenCalledTimes(1);
    await act(async () => { seguir(); });
  });
});

describe('lo que dice', () => {
  it('avisa que cierra las otras sesiones (y es verdad: lo hace)', async () => {
    await render(<CambiarContrasenaScreen />);
    expect(screen.getByText(/cerramos tu sesión en los demás dispositivos/i)).toBeTruthy();
  });
});
