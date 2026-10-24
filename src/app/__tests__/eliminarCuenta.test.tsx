import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// «Eliminar mi cuenta», en su propia pantalla (antes era el bloque rojo más grande de Configuración). Es el derecho de CANCELACIÓN (§29): irreversible y en
// cascada, así que se dice exactamente qué desaparece y se pide la contraseña. Lo que se fija: nada se borra sin la contraseña correcta; un fallo NO lleva al
// login (la persona se iría creyendo que ejerció su derecho sin haberlo ejercido: entre el 16 y el 19 de septiembre esta llamada falló de verdad en
// producción); y «Mejor no» no toca nada.

const mockSignIn = jest.fn();
const mockEliminar = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({ router: { replace: (...a: unknown[]) => mockReplace(...a), back: (...a: unknown[]) => mockBack(...a) } }));
jest.mock('@/lib/supabase', () => ({ supabase: { auth: { signInWithPassword: (...a: unknown[]) => mockSignIn(...a) } } }));
jest.mock('@/services/usuarios.service', () => ({ eliminarMiCuenta: (...a: unknown[]) => mockEliminar(...a) }));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: { user: { id: 'u1', email: 'yo@utvtol.edu.mx' } } }),
}));

import EliminarCuentaScreen from '../eliminar-cuenta';

const escribirClave = async (texto: string) => {
  await act(async () => { fireEvent.changeText(screen.getByLabelText('Tu contraseña'), texto); });
};
const eliminar = async () => { await act(async () => { fireEvent.press(screen.getByLabelText('Eliminar mi cuenta para siempre')); }); };

beforeEach(() => {
  jest.clearAllMocks();
  mockSignIn.mockResolvedValue({ error: null });
  mockEliminar.mockResolvedValue(undefined);
});

describe('lo que dice', () => {
  // Decir QUE desaparece no es cortesía: es lo que hace que el consentimiento sea informado. Un «¿estás seguro?» a secas no lo es.
  it('enumera lo que se pierde y avisa que no hay vuelta atrás', async () => {
    await render(<EliminarCuentaScreen />);
    for (const cosa of [/perfil/i, /publicaciones/i, /fotos/i, /mensajes/i, /favoritos/i, /plan/i]) {
      expect(screen.getByText(cosa)).toBeTruthy();
    }
    expect(screen.getByText(/no se puede deshacer/i)).toBeTruthy();
  });
});

describe('antes de borrar', () => {
  it('el botón está apagado hasta escribir la contraseña, y no borra nada', async () => {
    await render(<EliminarCuentaScreen />);
    expect(screen.getByLabelText('Eliminar mi cuenta para siempre').props.accessibilityState?.disabled).toBe(true);
    await eliminar();
    expect(mockEliminar).not.toHaveBeenCalled();
  });

  it('con la contraseña escrita se enciende', async () => {
    await render(<EliminarCuentaScreen />);
    await escribirClave('algo');
    expect(screen.getByLabelText('Eliminar mi cuenta para siempre').props.accessibilityState?.disabled).toBe(false);
  });

  it('«Mejor no» vuelve y no borra nada', async () => {
    await render(<EliminarCuentaScreen />);
    await act(async () => { fireEvent.press(screen.getByLabelText('Mejor no, conservar mi cuenta')); });
    expect(mockBack).toHaveBeenCalled();
    expect(mockEliminar).not.toHaveBeenCalled();
    expect(mockSignIn).not.toHaveBeenCalled();
  });
});

describe('al borrar', () => {
  it('comprueba la contraseña con el correo de la sesión ANTES de borrar', async () => {
    const orden: string[] = [];
    mockSignIn.mockImplementation(async () => { orden.push('comprobar'); return { error: null }; });
    mockEliminar.mockImplementation(async () => { orden.push('borrar'); });
    await render(<EliminarCuentaScreen />);
    await escribirClave('MiClave#2026');
    await eliminar();
    expect(mockSignIn).toHaveBeenCalledWith({ email: 'yo@utvtol.edu.mx', password: 'MiClave#2026' });
    expect(orden).toEqual(['comprobar', 'borrar']);
  });

  it('con contraseña incorrecta lo dice y NO borra', async () => {
    mockSignIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    await render(<EliminarCuentaScreen />);
    await escribirClave('mal');
    await eliminar();
    expect(screen.getByText('La contraseña no es correcta.')).toBeTruthy();
    expect(mockEliminar).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('borrada, lleva al login', async () => {
    await render(<EliminarCuentaScreen />);
    await escribirClave('MiClave#2026');
    await eliminar();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/login'));
  });

  // LA prueba que importa: si la pantalla navegara igual al login, la persona se iría creyendo que ejerció su derecho de cancelación sin haberlo ejercido.
  it('si el borrado falla NO se navega al login y se dice el motivo', async () => {
    mockEliminar.mockRejectedValue(new Error('Edge Function returned a non-2xx status code'));
    await render(<EliminarCuentaScreen />);
    await escribirClave('MiClave#2026');
    await eliminar();
    expect(await screen.findByText(/No se pudo eliminar la cuenta/)).toBeTruthy();
    expect(screen.getByText(/non-2xx/)).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('tras un fallo el botón vuelve a funcionar', async () => {
    mockEliminar.mockRejectedValueOnce(new Error('falló')).mockResolvedValueOnce(undefined);
    await render(<EliminarCuentaScreen />);
    await escribirClave('MiClave#2026');
    await eliminar();
    await screen.findByText(/No se pudo eliminar la cuenta/);
    await eliminar();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/login'));
  });

  it('dos toques seguidos borran UNA vez', async () => {
    let seguir!: () => void;
    mockSignIn.mockReturnValue(new Promise((r) => { seguir = () => r({ error: null }); }));
    await render(<EliminarCuentaScreen />);
    await escribirClave('MiClave#2026');
    await eliminar();
    await eliminar();
    expect(mockSignIn).toHaveBeenCalledTimes(1);
    await act(async () => { seguir(); });
  });
});
