// `registrarse` debe decir si la cuenta quedó a la espera de confirmar el correo. Con «Confirm email» activo
// Supabase devuelve usuario SIN sesión; con un correo ya registrado devuelve un usuario falso (identities
// vacío) también sin sesión y sin error. Eso último se dice en claro: un correo solo se registra una vez, y
// callar dejaba a la persona esperando un código que nunca iba a llegar (decisión del 23/10/2026).

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

  it('manda la versión del aviso que se aceptó, no solo que se aceptó', async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: 'u1' }, session: null }, error: null });
    await useAuthStore.getState().registrarse(datos);
    const { VERSION_AVISO } = jest.requireActual('@/lib/verificacion');
    expect(mockSignUp.mock.calls[0][0].options.data.aviso_version).toBe(VERSION_AVISO);
  });

  it('un correo que ya tiene cuenta se dice en claro y NO queda esperando un código', async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: 'falso', identities: [] }, session: null }, error: null });
    await expect(useAuthStore.getState().registrarse(datos)).rejects.toThrow(/ya tiene una cuenta/i);
    expect(useAuthStore.getState().session).toBeNull();
  });

  it('una cuenta nueva trae su identidad y no se confunde con una repetida', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'u1', identities: [{ id: 'i1' }] }, session: null },
      error: null,
    });
    await expect(useAuthStore.getState().registrarse(datos)).resolves.toEqual({ requiereConfirmacion: true });
  });

  it('un vendedor manda su tipo en los metadatos; un estudiante no manda ninguno', async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: 'u1' }, session: null }, error: null });
    await useAuthStore.getState().registrarse({ ...datos, tipoCuenta: 'arrendador' });
    expect(mockSignUp.mock.calls[0][0].options.data.tipo_cuenta).toBe('arrendador');

    await useAuthStore.getState().registrarse(datos);
    expect(mockSignUp.mock.calls[1][0].options.data).not.toHaveProperty('tipo_cuenta');
  });

  it('un error de Supabase se propaga', async () => {
    mockSignUp.mockResolvedValue({ data: { user: null, session: null }, error: new Error('boom') });
    await expect(useAuthStore.getState().registrarse(datos)).rejects.toThrow('boom');
  });
});
