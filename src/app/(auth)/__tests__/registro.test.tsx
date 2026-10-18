import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// V.5 · El registro estaba al 9 % de cobertura.
//
// `src/lib/correoUniversitario.ts` tiene seis pruebas —incluidas las trampas
// tipo `ana@edu.mx.atacante.com`— pero NADIE comprobaba que el formulario
// aplicara la regla. Un `.refine` mal colocado en el esquema Zod, o un mensaje
// que no se pinta, pasan las seis pruebas del módulo y dejan el registro roto.
//
// Es el mismo hueco que tenía el microservicio antes de END-02: la unidad
// probada, la integración no. Y aquí lo que se integra es una regla de
// SEGURIDAD — es lo que encarece crear cuentas desechables, y por tanto lo que
// sostiene el umbral de tres reportes de END-03.

const mockRegistrarse = jest.fn();
const mockReenviar = jest.fn();
const mockReplace = jest.fn();
const mockUpdate = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: (...a: unknown[]) => mockReplace(...a) },
  Link: ({ children }: { children: unknown }) => children,
}));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ registrarse: mockRegistrarse }),
}));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
      resend: (...a: unknown[]) => mockReenviar(...a),
    },
    from: () => ({ update: (...a: unknown[]) => { mockUpdate(...a); return { eq: () => Promise.resolve({ error: null }) }; } }),
  },
}));
jest.mock('@/lib/registro', () => ({ aviso: jest.fn(), fallo: jest.fn() }));

import RegistroScreen from '../registro';

// Con este RNTL sobre React 19, `fireEvent` fuera de `act()` no vacía la cola
// de estado — lo mismo que costó cuatro pruebas en rojo en V.4.
const interactuar = async (fn: () => void) => { await act(async () => { fn(); }); };

/** Rellena todo el formulario menos lo que cada prueba quiera romper. */
interface Datos {
  email?: string;
  password?: string;
  confirmar?: string;
  aceptar?: boolean;
}

async function rellenar({
  email = 'ana@utvtol.edu.mx',
  password = 'Contrasena#2026',
  // Se resuelve dentro y no como valor por omisión del parámetro: `confirmar =
  // password` referencia otro parámetro del mismo destructuring y TypeScript no
  // puede inferir su tipo (TS7022).
  confirmar,
  aceptar = true,
}: Datos = {}) {
  const confirmacion = confirmar ?? password;
  // `await` obligatorio: en esta configuración `render` hay que esperarlo antes
  // de que `screen` quede ligado. Sin él, la primera consulta falla con
  // «`render` function has not been called», que suena a que no se llamó.
  await render(<RegistroScreen />);
  await interactuar(() => fireEvent.changeText(screen.getByPlaceholderText('Angel Damian'), 'Ana'));
  await interactuar(() => fireEvent.changeText(screen.getByPlaceholderText('Malvaiz'), 'Ruiz'));
  await interactuar(() => fireEvent.changeText(screen.getByPlaceholderText('damianml'), 'ana_r'));
  await interactuar(() => fireEvent.changeText(screen.getByPlaceholderText('tucorreo@ejemplo.mx'), email));
  await interactuar(() => fireEvent.changeText(screen.getByPlaceholderText('Al menos 10 caracteres'), password));
  await interactuar(() => fireEvent.changeText(screen.getByPlaceholderText('Escríbela otra vez'), confirmacion));
  if (aceptar) {
    await interactuar(() => fireEvent.press(screen.getByLabelText('Acepto el aviso de privacidad')));
  }
  await interactuar(() => fireEvent.press(screen.getByLabelText('Crear cuenta')));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockReenviar.mockResolvedValue({ error: null });
});

describe('correo institucional · END-07', () => {
  it('rechaza un correo personal y dice qué se acepta', async () => {
    await rellenar({ email: 'ana@gmail.com' });

    await waitFor(() => expect(screen.getByText(/correo de tu universidad/i)).toBeTruthy());
    expect(mockRegistrarse).not.toHaveBeenCalled();
  });

  it('acepta un correo universitario', async () => {
    mockRegistrarse.mockResolvedValue(undefined);
    await rellenar({ email: 'ana@utvtol.edu.mx' });

    await waitFor(() => expect(mockRegistrarse).toHaveBeenCalledTimes(1));
    expect(mockRegistrarse).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ana@utvtol.edu.mx', nombreUsuario: 'ana_r' })
    );
  });
});

describe('consentimiento · §29', () => {
  it('sin marcar la casilla no se crea la cuenta', async () => {
    // La casilla NO viene premarcada, y el registro no avanza sin ella: la
    // marca de tiempo que se guarda es la evidencia que exige la LFPDPPP.
    await rellenar({ aceptar: false });

    // El texto exacto del esquema, no una subcadena: «consentimiento» aparece
    // también en la ayuda de la casilla, y un `/consentimiento/i` encontraba
    // dos elementos y pasaba por el motivo equivocado.
    await waitFor(() =>
      expect(screen.getByText('Necesitamos tu consentimiento para crear la cuenta')).toBeTruthy()
    );
    expect(mockRegistrarse).not.toHaveBeenCalled();
  });
});

describe('contraseñas', () => {
  it('no se crea la cuenta si la confirmación no coincide', async () => {
    await rellenar({ password: 'Contrasena#2026', confirmar: 'Otra#2026Cosa' });

    await waitFor(() => expect(screen.getByText(/no coinciden/i)).toBeTruthy());
    expect(mockRegistrarse).not.toHaveBeenCalled();
  });
});

// Con «Confirm email» activo en Supabase, `signUp` NO devuelve sesión: la cuenta existe pero nadie ha probado
// que el correo sea suyo. Antes el registro seguía como si hubiera sesión y mandaba al cuestionario, donde
// todo falla. Ahora se detiene en «Revisa tu correo».
describe('confirmación de correo', () => {
  it('sin sesión, avisa que revise su correo y NO sigue al cuestionario', async () => {
    mockRegistrarse.mockResolvedValue({ requiereConfirmacion: true });
    await rellenar({ email: 'ana@utvtol.edu.mx' });

    await waitFor(() => expect(screen.getByText('Revisa tu correo')).toBeTruthy());
    expect(screen.getByText(/ana@utvtol\.edu\.mx/)).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
    // Sin sesión no hay quién escriba el consentimiento desde el cliente: lo escribe el trigger.
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('manda la aceptación del aviso en los datos del alta, para que la marque el servidor', async () => {
    mockRegistrarse.mockResolvedValue({ requiereConfirmacion: true });
    await rellenar();

    await waitFor(() => expect(mockRegistrarse).toHaveBeenCalled());
    expect(mockRegistrarse).toHaveBeenCalledWith(expect.objectContaining({ aceptoAviso: true }));
  });

  it('permite reenviar el correo', async () => {
    mockRegistrarse.mockResolvedValue({ requiereConfirmacion: true });
    await rellenar({ email: 'ana@utvtol.edu.mx' });
    await waitFor(() => expect(screen.getByText('Revisa tu correo')).toBeTruthy());

    await interactuar(() => fireEvent.press(screen.getByLabelText('Reenviar correo')));

    await waitFor(() =>
      expect(mockReenviar).toHaveBeenCalledWith({ type: 'signup', email: 'ana@utvtol.edu.mx' })
    );
  });

  it('si el reenvío falla lo dice, no finge que salió', async () => {
    mockRegistrarse.mockResolvedValue({ requiereConfirmacion: true });
    mockReenviar.mockResolvedValue({ error: new Error('rate limit') });
    await rellenar();
    await waitFor(() => expect(screen.getByText('Revisa tu correo')).toBeTruthy());

    await interactuar(() => fireEvent.press(screen.getByLabelText('Reenviar correo')));

    await waitFor(() => expect(screen.getByText(/No pudimos reenviarlo/i)).toBeTruthy());
  });

  it('con sesión (confirmación apagada) sigue el flujo de siempre', async () => {
    mockRegistrarse.mockResolvedValue({ requiereConfirmacion: false });
    await rellenar();

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/cuestionario-inicial'));
    expect(screen.queryByText('Revisa tu correo')).toBeNull();
  });
});
