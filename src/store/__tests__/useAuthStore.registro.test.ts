// `registrarse` debe decir si la cuenta quedó a la espera de confirmar el correo. Con «Confirm email» activo
// Supabase devuelve usuario SIN sesión; con un correo ya registrado devuelve un usuario falso (identities
// vacío) también sin sesión y sin error, para no revelar qué correos existen. En ambos casos lo correcto es
// el mismo: «revisa tu correo».

const mockSignUp = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: (...a: unknown[]) => mockSignUp(...a),
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: jest.fn(),
    },
  },
}));
jest.mock('@/lib/tokenPush', () => ({ borrarTokenPush: jest.fn() }));

import { useAuthStore } from '../useAuthStore';

const datos = {
  email: 'ana@utvtol.edu.mx',
  password: 'Contrasena#2026',
  nombreUsuario: 'ana_r',
  nombreCompleto: 'Ana Ruiz',
  aceptoAviso: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ session: null });
});

describe('registrarse', () => {
  it('sin sesión: requiere confirmación', async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: 'u1' }, session: null }, error: null });
    await expect(useAuthStore.getState().registrarse(datos)).resolves.toEqual({ requiereConfirmacion: true });
    expect(useAuthStore.getState().session).toBeNull();
  });

  it('con sesión: no requiere confirmación y la guarda', async () => {
    const session = { user: { id: 'u1' } };
    mockSignUp.mockResolvedValue({ data: { user: { id: 'u1' }, session }, error: null });
    await expect(useAuthStore.getState().registrarse(datos)).resolves.toEqual({ requiereConfirmacion: false });
    expect(useAuthStore.getState().session).toBe(session);
  });

  it('manda la aceptación del aviso en los metadatos', async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: 'u1' }, session: null }, error: null });
    await useAuthStore.getState().registrarse(datos);
    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: { data: expect.objectContaining({ acepto_aviso: true, nombre_usuario: 'ana_r' }) },
      })
    );
  });

  it('un error de Supabase se propaga', async () => {
    mockSignUp.mockResolvedValue({ data: { user: null, session: null }, error: new Error('boom') });
    await expect(useAuthStore.getState().registrarse(datos)).rejects.toThrow('boom');
  });
});
