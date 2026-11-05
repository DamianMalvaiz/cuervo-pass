import { fireEvent, render, screen } from '@testing-library/react-native';

// La barra inferior del teléfono con sesión: lleva a lo de dentro (Chats, Cuenta) en vez de «Entrar», y un vendedor ve lo suyo y no los lugares de un estudiante.

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
const mockEstado = { session: { user: { id: 'u1', email: 'a@b.mx', user_metadata: {} } } as unknown };
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: (sel: (s: typeof mockEstado) => unknown) => sel(mockEstado) }));
const mockPerfil = { valor: 'estudiante' as 'estudiante' | 'vendedor' };
jest.mock('@/hooks/queries/usePerfilActivo', () => ({ usePerfilActivo: () => ({ perfil: mockPerfil.valor }) }));

import { BarraInferiorWeb } from '../BarraInferiorWeb';

beforeEach(() => {
  jest.clearAllMocks();
  mockPerfil.valor = 'estudiante';
});

describe('BarraInferiorWeb con sesión', () => {
  it('un estudiante: lugares, roomies, servicios, chats y cuenta; ya no «Entrar»', async () => {
    await render(<BarraInferiorWeb activa={null} />);
    expect(screen.queryByLabelText('Iniciar sesión')).toBeNull();
    const casos: [string, string][] = [['Departamentos', '/departamentos'], ['Roomies', '/roomies'], ['Servicios', '/servicios'], ['Chats', '/(tabs)/chats'], ['Mi cuenta', '/(tabs)/perfil']];
    for (const [etiqueta, ruta] of casos) {
      await fireEvent.press(screen.getByLabelText(etiqueta));
      expect(mockPush).toHaveBeenLastCalledWith(ruta);
    }
  });

  it('un vendedor: su panel, chats y cuenta, y no los lugares de quien busca', async () => {
    mockPerfil.valor = 'vendedor';
    await render(<BarraInferiorWeb activa={null} />);
    for (const e of ['Mi panel', 'Chats', 'Mi cuenta']) expect(screen.getByLabelText(e)).toBeTruthy();
    expect(screen.queryByLabelText('Departamentos')).toBeNull();
    expect(screen.queryByLabelText('Roomies')).toBeNull();
  });

  it('marca la página actual también en lo de dentro', async () => {
    await render(<BarraInferiorWeb activa="chats" />);
    expect(screen.getByLabelText('Chats').props['aria-current']).toBe('page');
    expect(screen.getByLabelText('Mi cuenta').props['aria-current']).toBeUndefined();
  });
});
