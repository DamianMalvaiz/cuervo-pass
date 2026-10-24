import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// V.8 · `app/(auth)` estaba al 9 %, y lo que había cubría solo `registro.tsx`.
//
// Login tiene una rama que no es evidente y que nadie probaba: si la cuenta se
// quedó a medias del cuestionario inicial —salió de la app antes de
// terminarlo— entrar NO lleva a Sugerencias, lleva de vuelta al cuestionario.
// Sin eso, esa persona llega a un motor sin universidad ni presupuesto: filtro
// duro sin datos, lista vacía, y ninguna pista de por qué.

const mockIniciarSesion = jest.fn();
const mockReplace = jest.fn();
const mockSingle = jest.fn();
const mockReenviar = jest.fn();

jest.mock('expo-router', () => ({
  router: { replace: (...a: unknown[]) => mockReplace(...a), push: jest.fn() },
  Link: ({ children }: { children: unknown }) => children,
}));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ iniciarSesion: mockIniciarSesion }),
}));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
      resend: (...a: unknown[]) => mockReenviar(...a),
    },
    from: () => ({ select: () => ({ eq: () => ({ single: () => mockSingle() }) }) }),
  },
}));
jest.mock('@/lib/registro', () => ({ aviso: jest.fn(), fallo: jest.fn() }));

import LoginScreen from '../login';

const interactuar = async (fn: () => void) => { await act(async () => { fn(); }); };

const entrar = async (email = 'ana@utvtol.edu.mx', password = 'Contrasena#2026') => {
  await render(<LoginScreen />);
  await interactuar(() => fireEvent.changeText(screen.getByPlaceholderText('tucorreo@ejemplo.mx'), email));
  await interactuar(() => fireEvent.changeText(screen.getByPlaceholderText('Tu contraseña'), password));
  await interactuar(() => fireEvent.press(screen.getByLabelText('Entrar')));
};

beforeEach(() => {
  jest.clearAllMocks();
  mockIniciarSesion.mockResolvedValue(undefined);
  mockSingle.mockResolvedValue({ data: { cuestionario_completo: true } });
  mockReenviar.mockResolvedValue({ error: null });
});

// Cuervo 360 · la portada de entrada lleva el logo y el nombre nuevo, y ya no el anterior.
describe('la marca en la portada', () => {
  it('muestra el logo y el nombre Cuervo 360', async () => {
    await render(<LoginScreen />);
    expect(screen.getByLabelText('Cuervo 360')).toBeTruthy();
    expect(screen.getByText('Cuervo 360')).toBeTruthy();
    expect(screen.getByText('Todo en un solo lugar.')).toBeTruthy();
  });

  it('ya no dice Cuervo Pass', async () => {
    await render(<LoginScreen />);
    expect(screen.queryByText('Cuervo Pass')).toBeNull();
  });
});

describe('a dónde lleva entrar', () => {
  it('con el cuestionario terminado, a Sugerencias', async () => {
    await entrar();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)/inicio'));
  });

  it('con el cuestionario a medias, DE VUELTA al cuestionario', async () => {
    // `cuestionario_completo` y no `universidad` (la proxy frágil de la que habla `app/index.tsx`): un arrendador o un negocio no tiene
    // universidad y su alta ya deja el cuestionario como hecho (0082); con `universidad` volverían a él en cada entrada.
    // Sin universidad, el filtro duro no tiene con qué filtrar: la lista sale
    // vacía y nada explica por qué. Mandar a Sugerencias a esta persona es
    // enseñarle un motor roto que no lo está.
    mockSingle.mockResolvedValue({ data: { cuestionario_completo: false } });
    await entrar();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/cuestionario-inicial'));
  });
});

describe('cuando falla', () => {
  it('traduce el error de Supabase en vez de enseñarlo en inglés', async () => {
    mockIniciarSesion.mockRejectedValue(new Error('Invalid login credentials'));
    await entrar();

    // «Invalid login credentials» no le sirve a nadie, y menos a alguien de
    // dieciocho años que no sabe si escribió mal el correo o la contraseña.
    await waitFor(() =>
      expect(screen.getByText(/El correo o la contraseña no coinciden/i)).toBeTruthy()
    );
    expect(screen.queryByText(/Invalid login credentials/i)).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('un fallo de red dice que es de conexión, no que las credenciales estén mal', async () => {
    // Acusar a la persona de escribir mal su contraseña cuando lo que pasa es
    // que no hay señal la manda a cambiarla sin necesidad.
    mockIniciarSesion.mockRejectedValue(new Error('network request failed'));
    await entrar();

    await waitFor(() => expect(screen.getByText(/network request failed/i)).toBeTruthy());
    expect(screen.queryByText(/no coinciden/i)).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

// «Email not confirmed» es el error que verá quien se registró y aún no abrió el correo. En inglés no dice qué
// hacer; y acusarle de contraseña incorrecta lo mandaría a cambiarla sin necesidad.
describe('correo sin confirmar', () => {
  it('lo dice en español y ofrece reenviar el correo', async () => {
    mockIniciarSesion.mockRejectedValue(new Error('Email not confirmed'));
    await entrar('ana@utvtol.edu.mx');

    await waitFor(() => expect(screen.getByText(/Aún no confirmas tu correo/i)).toBeTruthy());
    expect(screen.queryByText(/Email not confirmed/i)).toBeNull();
    expect(screen.queryByText(/no coinciden/i)).toBeNull();

    await interactuar(() => fireEvent.press(screen.getByLabelText('Reenviar correo de confirmación')));
    await waitFor(() =>
      expect(mockReenviar).toHaveBeenCalledWith({ type: 'signup', email: 'ana@utvtol.edu.mx' })
    );
  });

  it('con otro error no ofrece reenviar nada', async () => {
    mockIniciarSesion.mockRejectedValue(new Error('Invalid login credentials'));
    await entrar();
    await waitFor(() => expect(screen.getByText(/no coinciden/i)).toBeTruthy());
    expect(screen.queryByLabelText('Reenviar correo de confirmación')).toBeNull();
  });
});
