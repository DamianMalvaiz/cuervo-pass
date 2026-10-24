import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// El guardia de entrada · v5 §26. Estaba al 0 % de ramas con 17 de 17 sin
// cubrir, y es el archivo que decide QUIÉN ENTRA A LA APP. Diecisiete ramas en
// setenta líneas: la densidad más alta del repositorio, y ninguna probada.
//
// Tiene TRES destinos y no dos, que es lo que v3 olvidaba:
//
//   sin sesión                      → login
//   con sesión, sin cuestionario    → cuestionario
//   con sesión y cuestionario       → pestañas
//
// Y un cuarto estado que no es destino sino espera, que es el que de verdad
// importa: MIENTRAS no se sabe si el cuestionario está completo, no se puede
// redirigir. `cuestionarioCompleto` arranca en `null`, y `null` es falso — así
// que sin ese guardia alguien que YA completó el cuestionario sería mandado a
// repetirlo en cuanto abriera la app. No es una pantalla fea: es perder el
// acceso a lo que ya hiciste.

const mockRedirigir = jest.fn();
const mockCargarSesion = jest.fn();
const mockDesde = jest.fn();
const mockAuth: { session: unknown; cargando: boolean } = { session: null, cargando: false };
const mockConfig = { ok: true };

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    mockRedirigir(href);
    return null;
  },
}));
jest.mock('@/store/useAuthStore', () => ({
  useAuthStore: () => ({
    session: mockAuth.session,
    cargando: mockAuth.cargando,
    cargarSesionInicial: mockCargarSesion,
  }),
}));
jest.mock('@/lib/supabase', () => ({
  get supabaseConfigurado() {
    return mockConfig.ok;
  },
  supabase: { from: (...a: unknown[]) => mockDesde(...a) },
}));

import { VERSION_AVISO } from '@/lib/verificacion';

import Index from '../index';

/**
 * Doble de la consulta del cuestionario. `resolver` permite dejarla EN VUELO,
 * que es el único modo de comprobar el estado de espera — con una promesa ya
 * resuelta, el render inicial y el final son indistinguibles.
 *
 * La interfaz va declarada y no inferida porque `select` y `eq` devuelven la
 * propia cadena, y eso es una referencia circular: sin ella tsc falla con
 * TS7022. Segunda vez en este repositorio, por la misma razón.
 */
interface Cadena {
  select: jest.Mock;
  eq: jest.Mock;
  maybeSingle: jest.Mock;
}

type Respuesta = { data: unknown; error?: { message: string } | null };

const consulta = (resultado?: Respuesta) => {
  let resolver!: (v: Respuesta) => void;
  const promesa = new Promise<Respuesta>((r) => {
    resolver = r;
    if (resultado) r(resultado);
  });
  const c: Cadena = {
    select: jest.fn(() => c),
    eq: jest.fn(() => c),
    maybeSingle: jest.fn(() => promesa),
  };
  return { cadena: c, resolver };
};

const SESION = { user: { id: 'u1' } };

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.session = null;
  mockAuth.cargando = false;
  mockConfig.ok = true;
});

// ── Los tres destinos ────────────────────────────────────────────────────────

test('sin sesión manda al login', async () => {
  await render(<Index />);
  expect(mockRedirigir).toHaveBeenCalledWith('/(auth)/login');
});

test('con cuestionario completo manda a las pestañas', async () => {
  mockAuth.session = SESION;
  mockDesde.mockReturnValue(consulta({ data: { cuestionario_completo: true, version_aviso_aceptada: VERSION_AVISO } }).cadena);

  await render(<Index />);
  await waitFor(() => expect(mockRedirigir).toHaveBeenCalledWith('/(tabs)/inicio'));
});

// 0083 · un vendedor entra por SU panel. El cuestionario es de quien busca (universidad, presupuesto, hábitos): mandarlo ahí en cada entrada sería pedirle
// a un negocio que diga cuánto quiere pagar de renta.
describe('perfil de vendedor · 0083', () => {
  it('con perfil de vendedor entra al panel', async () => {
    mockAuth.session = SESION;
    mockDesde.mockReturnValue(consulta({ data: { cuestionario_completo: true, version_aviso_aceptada: VERSION_AVISO, perfil_activo: 'vendedor' } }).cadena);
    await render(<Index />);
    await waitFor(() => expect(mockRedirigir).toHaveBeenCalledWith('/(tabs)/panel'));
  });

  it('un vendedor SIN cuestionario tampoco va al cuestionario: va al panel', async () => {
    mockAuth.session = SESION;
    mockDesde.mockReturnValue(consulta({ data: { cuestionario_completo: false, version_aviso_aceptada: VERSION_AVISO, perfil_activo: 'vendedor' } }).cadena);
    await render(<Index />);
    await waitFor(() => expect(mockRedirigir).toHaveBeenCalledWith('/(tabs)/panel'));
    expect(mockRedirigir).not.toHaveBeenCalledWith('/(auth)/cuestionario-inicial');
  });

  it('el aviso de privacidad va ANTES que el panel', async () => {
    mockAuth.session = SESION;
    mockDesde.mockReturnValue(consulta({ data: { cuestionario_completo: true, version_aviso_aceptada: 'v0', perfil_activo: 'vendedor' } }).cadena);
    await render(<Index />);
    await waitFor(() => expect(mockRedirigir).toHaveBeenCalledWith('/aviso-actualizado'));
    expect(mockRedirigir).not.toHaveBeenCalledWith('/(tabs)/panel');
  });

  it('un estudiante sigue entrando a Inicio', async () => {
    mockAuth.session = SESION;
    mockDesde.mockReturnValue(consulta({ data: { cuestionario_completo: true, version_aviso_aceptada: VERSION_AVISO, perfil_activo: 'estudiante' } }).cadena);
    await render(<Index />);
    await waitFor(() => expect(mockRedirigir).toHaveBeenCalledWith('/(tabs)/inicio'));
  });
});

// El destino que v3 no tenía. Un usuario con sesión y sin cuestionario llegaba a
// una pantalla de sugerencias vacía y la app parecía rota.
test('con sesión y sin cuestionario manda al cuestionario', async () => {
  mockAuth.session = SESION;
  mockDesde.mockReturnValue(consulta({ data: { cuestionario_completo: false, version_aviso_aceptada: VERSION_AVISO } }).cadena);

  await render(<Index />);
  await waitFor(() => expect(mockRedirigir).toHaveBeenCalledWith('/(auth)/cuestionario-inicial'));
});

// Existe en Auth pero no en `usuarios` — pasa si el registro se interrumpió
// entre el `signUp` y la inserción del perfil. `Boolean(data?.…)` lo trata como
// «sin cuestionario», que es lo correcto: que lo haga ahora.
test('sin fila en usuarios manda al cuestionario, no a las pestañas', async () => {
  mockAuth.session = SESION;
  mockDesde.mockReturnValue(consulta({ data: null }).cadena);

  await render(<Index />);
  await waitFor(() => expect(mockRedirigir).toHaveBeenCalledWith('/(auth)/cuestionario-inicial'));
  expect(mockRedirigir).not.toHaveBeenCalledWith('/(tabs)/inicio');
});

// ── La espera · LA prueba de este archivo ────────────────────────────────────

// Con la consulta EN VUELO no se redirige a ninguna parte. Sin este guardia,
// `cuestionarioCompleto` valdría `null`, `null` es falso, y quien ya completó el
// cuestionario sería mandado a repetirlo cada vez que abriera la app.
test('mientras no se sabe, NO redirige a ningún sitio', async () => {
  mockAuth.session = SESION;
  const { cadena, resolver } = consulta();
  mockDesde.mockReturnValue(cadena);

  await render(<Index />);
  expect(mockRedirigir).not.toHaveBeenCalled();

  // Y al llegar la respuesta, sí.
  resolver({ data: { cuestionario_completo: true, version_aviso_aceptada: VERSION_AVISO } });
  await waitFor(() => expect(mockRedirigir).toHaveBeenCalledWith('/(tabs)/inicio'));
});

// Mientras la sesión se restaura del almacenamiento tampoco. Redirigir aquí
// mandaría al login a alguien que sí tiene sesión guardada: el parpadeo al
// login es el síntoma clásico de este guardia mal puesto.
test('mientras se restaura la sesión no manda al login', async () => {
  mockAuth.cargando = true;
  await render(<Index />);
  expect(mockRedirigir).not.toHaveBeenCalled();
});

// ── Sin configurar ───────────────────────────────────────────────────────────

// La pantalla que salva la primera ejecución de cualquiera que clone el
// repositorio. Sin ella, la app arranca y falla al primer fetch con un error de
// red incomprensible en vez de decir qué falta.
test('sin Supabase configurado explica qué falta y no redirige', async () => {
  mockConfig.ok = false;
  await render(<Index />);

  expect(screen.getByText('Falta configurar Supabase')).toBeTruthy();
  expect(screen.getByText(/EXPO_PUBLIC_SUPABASE_ANON_KEY/)).toBeTruthy();
  expect(mockRedirigir).not.toHaveBeenCalled();
  // Y no se intenta cargar la sesión: sin URL ni clave no hay a qué preguntar.
  expect(mockCargarSesion).not.toHaveBeenCalled();
});

test('configurado, sí carga la sesión al montar', async () => {
  await render(<Index />);
  expect(mockCargarSesion).toHaveBeenCalledTimes(1);
});

// La consulta pregunta por el usuario de la sesión y por la columna explícita.
// v3 usaba `universidad is not null` como proxy, y alguien que guardaba la
// universidad y abandonaba antes del presupuesto pasaba el filtro igual.
test('pregunta por cuestionario_completo del usuario de la sesión', async () => {
  mockAuth.session = SESION;
  const { cadena } = consulta({ data: { cuestionario_completo: true, version_aviso_aceptada: VERSION_AVISO } });
  mockDesde.mockReturnValue(cadena);

  await render(<Index />);
  await waitFor(() => expect(mockRedirigir).toHaveBeenCalled());

  expect(mockDesde).toHaveBeenCalledWith('usuarios');
  expect(cadena.select).toHaveBeenCalledWith('cuestionario_completo, version_aviso_aceptada, perfil_activo');
  expect(cadena.eq).toHaveBeenCalledWith('id', 'u1');
});

test('sin sesión no consulta nada', async () => {
  await render(<Index />);
  expect(mockDesde).not.toHaveBeenCalled();
});

// ── Fallar no es «no hay dato» · invariante 2 · hallazgo 4 ───────────────────

// El defecto. La consulta ignoraba `error`: con la red caída `data` era null,
// `Boolean(null?.cuestionario_completo)` es false, y alguien que YA completó el
// cuestionario era mandado a repetirlo —y a sobrescribir sus preferencias— por
// un fallo de wifi. Un fallo de lectura jamás debe presentarse como contenido
// borrado.
test('si la lectura FALLA, no manda al cuestionario ni a las pestañas', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockAuth.session = SESION;
  mockDesde.mockReturnValue(
    consulta({ data: null, error: { message: 'network request failed' } }).cadena
  );

  await render(<Index />);

  // Primero lo que importa, esperando a que la consulta ya se haya resuelto: así
  // el rojo apunta a la redirección equivocada y no solo a un texto que falta.
  await waitFor(() => expect(mockDesde).toHaveBeenCalledTimes(1));
  await act(async () => {});
  expect(mockRedirigir).not.toHaveBeenCalled();
  expect(await screen.findByText(/No pudimos comprobar tu cuenta/)).toBeTruthy();
});

// Segundo hueco del mismo `.then`: sin `.catch`, una excepción dejaba el
// indicador de carga girando para siempre, sin salida.
test('si la consulta LANZA, tampoco se queda cargando para siempre', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockAuth.session = SESION;
  const c: Cadena = {
    select: jest.fn(() => c),
    eq: jest.fn(() => c),
    maybeSingle: jest.fn(() => Promise.reject(new Error('se cayó la red'))),
  };
  mockDesde.mockReturnValue(c);

  await render(<Index />);

  expect(await screen.findByText(/No pudimos comprobar tu cuenta/)).toBeTruthy();
  expect(mockRedirigir).not.toHaveBeenCalled();
});

// La salida del estado de error: sin ella la persona queda atrapada en una
// pantalla que no se puede cerrar.
test('Reintentar vuelve a preguntar y, si ahora responde, entra', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockAuth.session = SESION;
  mockDesde
    .mockReturnValueOnce(consulta({ data: null, error: { message: 'sin red' } }).cadena)
    .mockReturnValue(consulta({ data: { cuestionario_completo: true, version_aviso_aceptada: VERSION_AVISO } }).cadena);

  await render(<Index />);
  fireEvent.press(await screen.findByLabelText('Reintentar'));

  await waitFor(() => expect(mockRedirigir).toHaveBeenCalledWith('/(tabs)/inicio'));
  expect(mockDesde).toHaveBeenCalledTimes(2);
});

// Reintentar no puede mandar al cuestionario si vuelve a fallar.
test('si Reintentar vuelve a fallar, sigue en el aviso y no redirige', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockAuth.session = SESION;
  mockDesde.mockImplementation(() => consulta({ data: null, error: { message: 'sin red' } }).cadena);

  await render(<Index />);
  fireEvent.press(await screen.findByLabelText('Reintentar'));

  await waitFor(() => expect(mockDesde).toHaveBeenCalledTimes(2));
  expect(await screen.findByText(/No pudimos comprobar tu cuenta/)).toBeTruthy();
  expect(mockRedirigir).not.toHaveBeenCalled();
});

// El resultado lleva el id de quien lo pidió. Si la sesión cambia a otra cuenta
// con la pregunta nueva todavía en vuelo, la respuesta de la cuenta anterior no
// puede decidir el destino de la nueva: Ana ya completó el cuestionario, Beto
// quizá no, y mandar a Beto a las pestañas por lo que contestó Ana es abrirle una
// app sin su ficha.
test('al cambiar de cuenta no se reutiliza la respuesta de la anterior', async () => {
  mockAuth.session = { user: { id: 'u1' } };
  mockDesde.mockReturnValue(consulta({ data: { cuestionario_completo: true, version_aviso_aceptada: VERSION_AVISO } }).cadena);

  const { rerender } = await render(<Index />);
  await waitFor(() => expect(mockRedirigir).toHaveBeenCalledWith('/(tabs)/inicio'));

  mockRedirigir.mockClear();
  mockAuth.session = { user: { id: 'u2' } };
  mockDesde.mockReturnValue(consulta().cadena); // la de u2, todavía en vuelo
  await rerender(<Index />);

  expect(mockRedirigir).not.toHaveBeenCalled();
});

// ── El aviso de privacidad vigente (0059) ────────────────────────────────────
// Quien no aceptó la versión actual pasa primero por la pantalla que se la pide. Va ANTES del cuestionario: no tiene sentido pedir más datos
// a quien no aceptó cómo se tratan.
describe('aviso de privacidad vigente', () => {
  it('sin versión registrada (cuenta anterior al registro de versiones) pide aceptar el aviso', async () => {
    mockAuth.session = SESION;
    mockDesde.mockReturnValue(consulta({ data: { cuestionario_completo: true, version_aviso_aceptada: null } }).cadena);
    await render(<Index />);
    await waitFor(() => expect(mockRedirigir).toHaveBeenCalledWith('/aviso-actualizado'));
    expect(mockRedirigir).not.toHaveBeenCalledWith('/(tabs)/inicio');
  });

  it('con una versión anterior también', async () => {
    mockAuth.session = SESION;
    mockDesde.mockReturnValue(consulta({ data: { cuestionario_completo: true, version_aviso_aceptada: 'v2' } }).cadena);
    await render(<Index />);
    await waitFor(() => expect(mockRedirigir).toHaveBeenCalledWith('/aviso-actualizado'));
  });

  it('va antes que el cuestionario', async () => {
    mockAuth.session = SESION;
    mockDesde.mockReturnValue(consulta({ data: { cuestionario_completo: false, version_aviso_aceptada: null } }).cadena);
    await render(<Index />);
    await waitFor(() => expect(mockRedirigir).toHaveBeenCalledWith('/aviso-actualizado'));
    expect(mockRedirigir).not.toHaveBeenCalledWith('/(auth)/cuestionario-inicial');
  });

  it('con la versión vigente entra normal', async () => {
    mockAuth.session = SESION;
    mockDesde.mockReturnValue(consulta({ data: { cuestionario_completo: true, version_aviso_aceptada: VERSION_AVISO } }).cadena);
    await render(<Index />);
    await waitFor(() => expect(mockRedirigir).toHaveBeenCalledWith('/(tabs)/inicio'));
    expect(mockRedirigir).not.toHaveBeenCalledWith('/aviso-actualizado');
  });

  it('un fallo de lectura NO manda a aceptar el aviso: se dice y se reintenta', async () => {
    mockAuth.session = SESION;
    mockDesde.mockReturnValue(consulta({ data: null, error: { message: 'sin red' } }).cadena);
    await render(<Index />);
    expect(await screen.findByText(/No pudimos comprobar tu cuenta/)).toBeTruthy();
    expect(mockRedirigir).not.toHaveBeenCalledWith('/aviso-actualizado');
  });
});
