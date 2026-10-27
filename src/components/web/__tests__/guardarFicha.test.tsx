import { fireEvent, render, screen } from '@testing-library/react-native';

// El botón «Guardar» de la barra de una ficha. Sin sesión pide entrar; con sesión guarda o quita de verdad y lo dice con su texto («Guardar» / «Guardado»), no solo con el color del corazón.

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a), canGoBack: () => true, back: jest.fn() } }));
const mockSesion = { valor: null as null | { user: { id: string; email: string; user_metadata: object } } };
jest.mock('@/store/useAuthStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ session: mockSesion.valor, cerrarSesion: jest.fn() }) }));
const mockGuardado = { guardado: false, cargando: false, alternar: jest.fn() };
jest.mock('@/hooks/use-guardado', () => ({ useGuardado: () => mockGuardado }));
jest.mock('@/hooks/queries/usePerfilActivo', () => ({ usePerfilActivo: () => ({ perfil: 'estudiante' }) }));
jest.mock('@/hooks/queries/useRoles', () => ({ useMisRoles: () => ({ roles: [] }) }));

import { BarraFichaWeb } from '../BarraFichaWeb';

beforeEach(() => {
  jest.clearAllMocks();
  mockSesion.valor = null;
  Object.assign(mockGuardado, { guardado: false, cargando: false });
});

describe('«Guardar» en la ficha', () => {
  it('sin sesión lleva a entrar', async () => {
    await render(<BarraFichaWeb escritorio guardar={{ tipo: 'publicacion', id: 'p1' }} />);
    await fireEvent.press(screen.getByLabelText('Guardar: inicia sesión para guardar'));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/login');
    expect(mockGuardado.alternar).not.toHaveBeenCalled();
  });

  it('con sesión guarda, y el texto lo dice', async () => {
    mockSesion.valor = { user: { id: 'u1', email: 'a@b.mx', user_metadata: {} } };
    await render(<BarraFichaWeb escritorio guardar={{ tipo: 'publicacion', id: 'p1' }} />);
    expect(screen.getByText('Guardar')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Guardar en favoritos'));
    expect(mockGuardado.alternar).toHaveBeenCalledTimes(1);
  });

  it('si ya está guardada dice «Guardado» y al tocar la quita', async () => {
    mockSesion.valor = { user: { id: 'u1', email: 'a@b.mx', user_metadata: {} } };
    mockGuardado.guardado = true;
    await render(<BarraFichaWeb escritorio guardar={{ tipo: 'negocio', id: 'n1' }} />);
    expect(screen.getByText('Guardado')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Quitar de favoritos'));
    expect(mockGuardado.alternar).toHaveBeenCalledTimes(1);
  });

  it('mientras no se sabe qué hay guardado no responde', async () => {
    mockSesion.valor = { user: { id: 'u1', email: 'a@b.mx', user_metadata: {} } };
    mockGuardado.cargando = true;
    await render(<BarraFichaWeb escritorio guardar={{ tipo: 'publicacion', id: 'p1' }} />);
    await fireEvent.press(screen.getByLabelText('Guardar en favoritos'));
    expect(mockGuardado.alternar).not.toHaveBeenCalled();
  });
});
