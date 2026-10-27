import { fireEvent, render, screen } from '@testing-library/react-native';

// El grupo de cuenta de los encabezados de la web: sin sesión, entrar y crear cuenta; con sesión, Favoritos, Chats y el menú de la cuenta (inicial de la persona). El menú ofrece lo que el perfil de la
// cuenta permite (un vendedor ve su panel; un estudiante, sus favoritos) y «Cerrar sesión» cierra y vuelve a la portada.

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a), replace: (...a: unknown[]) => mockReplace(...a) } }));

const mockCerrar = jest.fn();
const mockEstado = {
  session: null as null | { user: { id: string; email: string; user_metadata: Record<string, string> } },
  cerrarSesion: () => mockCerrar(),
};
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: (sel: (s: typeof mockEstado) => unknown) => sel(mockEstado) }));

const mockPerfil = { valor: 'estudiante' as 'estudiante' | 'vendedor' | null };
jest.mock('@/hooks/queries/usePerfilActivo', () => ({ usePerfilActivo: () => ({ perfil: mockPerfil.valor }) }));
jest.mock('@/hooks/queries/useRoles', () => ({ useMisRoles: () => ({ roles: [] }) }));

import { CuentaWeb } from '../CuentaWeb';

const conSesion = (meta: Record<string, string> = { nombre_completo: 'Ana Ruiz' }) => {
  mockEstado.session = { user: { id: 'u1', email: 'ana@correo.mx', user_metadata: meta } };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockEstado.session = null;
  mockPerfil.valor = 'estudiante';
});

describe('CuentaWeb sin sesión', () => {
  it('ofrece iniciar sesión y crear cuenta', async () => {
    await render(<CuentaWeb escritorio tono="claro" />);
    await fireEvent.press(screen.getByLabelText('Iniciar sesión'));
    expect(mockPush).toHaveBeenLastCalledWith('/(auth)/login');
    await fireEvent.press(screen.getByLabelText('Crear cuenta'));
    expect(mockPush).toHaveBeenLastCalledWith('/(auth)/registro');
  });

  it('en el teléfono solo «Iniciar sesión»', async () => {
    await render(<CuentaWeb escritorio={false} telefono tono="claro" />);
    expect(screen.getByLabelText('Iniciar sesión')).toBeTruthy();
    expect(screen.queryByLabelText('Crear cuenta')).toBeNull();
  });
});

describe('CuentaWeb con sesión', () => {
  it('ya no ofrece entrar: enseña Favoritos, Chats y el menú con la inicial', async () => {
    conSesion();
    await render(<CuentaWeb escritorio tono="claro" />);
    expect(screen.queryByLabelText('Iniciar sesión')).toBeNull();
    expect(screen.getByLabelText('Favoritos')).toBeTruthy();
    expect(screen.getByLabelText('Chats')).toBeTruthy();
    expect(screen.getByLabelText('Menú de la cuenta')).toBeTruthy();
    expect(screen.getByText('A')).toBeTruthy();
  });

  it('sin nombre usa la primera letra del correo', async () => {
    conSesion({});
    await render(<CuentaWeb escritorio tono="claro" />);
    expect(screen.getByText('A')).toBeTruthy();
  });

  it('el menú está cerrado hasta que se abre, y entonces ofrece perfil, configuración y cerrar sesión', async () => {
    conSesion();
    await render(<CuentaWeb escritorio tono="claro" />);
    expect(screen.queryByText('Cerrar sesión')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Menú de la cuenta'));
    for (const t of ['Perfil', 'Configuración', 'Cerrar sesión']) expect(screen.getByText(t)).toBeTruthy();
  });

  it('los accesos llevan a su página', async () => {
    conSesion();
    await render(<CuentaWeb escritorio tono="claro" />);
    await fireEvent.press(screen.getByLabelText('Favoritos'));
    expect(mockPush).toHaveBeenLastCalledWith('/(tabs)/favoritos');
    await fireEvent.press(screen.getByLabelText('Chats'));
    expect(mockPush).toHaveBeenLastCalledWith('/(tabs)/chats');
    await fireEvent.press(screen.getByLabelText('Menú de la cuenta'));
    await fireEvent.press(screen.getByText('Perfil'));
    expect(mockPush).toHaveBeenLastCalledWith('/(tabs)/perfil');
  });

  it('«Cerrar sesión» cierra y vuelve a la portada', async () => {
    conSesion();
    await render(<CuentaWeb escritorio tono="claro" />);
    await fireEvent.press(screen.getByLabelText('Menú de la cuenta'));
    await fireEvent.press(screen.getByText('Cerrar sesión'));
    expect(mockCerrar).toHaveBeenCalledTimes(1);
  });

  it('un vendedor ve su panel y no los favoritos de un estudiante', async () => {
    conSesion();
    mockPerfil.valor = 'vendedor';
    await render(<CuentaWeb escritorio tono="claro" />);
    expect(screen.queryByLabelText('Favoritos')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Menú de la cuenta'));
    expect(screen.getByText('Mi panel')).toBeTruthy();
  });

  it('en el teléfono arriba solo queda el menú, y Favoritos pasa DENTRO del menú', async () => {
    conSesion();
    await render(<CuentaWeb escritorio={false} telefono tono="claro" />);
    expect(screen.getByLabelText('Menú de la cuenta')).toBeTruthy();
    expect(screen.queryByLabelText('Favoritos')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Menú de la cuenta'));
    await fireEvent.press(screen.getByLabelText('Favoritos'));
    expect(mockPush).toHaveBeenLastCalledWith('/(tabs)/favoritos');
  });
});
