import { render, screen, waitFor } from '@testing-library/react-native';

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

const consulta = (resultado?: { data: unknown }) => {
  let resolver!: (v: { data: unknown }) => void;
  const promesa = new Promise<{ data: unknown }>((r) => {
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
  mockDesde.mockReturnValue(consulta({ data: { cuestionario_completo: true } }).cadena);

  await render(<Index />);
  await waitFor(() => expect(mockRedirigir).toHaveBeenCalledWith('/(tabs)/inicio'));
});

// El destino que v3 no tenía. Un usuario con sesión y sin cuestionario llegaba a
// una pantalla de sugerencias vacía y la app parecía rota.
test('con sesión y sin cuestionario manda al cuestionario', async () => {
  mockAuth.session = SESION;
  mockDesde.mockReturnValue(consulta({ data: { cuestionario_completo: false } }).cadena);

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
  resolver({ data: { cuestionario_completo: true } });
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
  const { cadena } = consulta({ data: { cuestionario_completo: true } });
  mockDesde.mockReturnValue(cadena);

  await render(<Index />);
  await waitFor(() => expect(mockRedirigir).toHaveBeenCalled());

  expect(mockDesde).toHaveBeenCalledWith('usuarios');
  expect(cadena.select).toHaveBeenCalledWith('cuestionario_completo');
  expect(cadena.eq).toHaveBeenCalledWith('id', 'u1');
});

test('sin sesión no consulta nada', async () => {
  await render(<Index />);
  expect(mockDesde).not.toHaveBeenCalled();
});
