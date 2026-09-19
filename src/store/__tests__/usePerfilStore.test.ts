// END-11 · `cargarPerfil` hacía `set({ perfil: error ? null : data })`.
//
// Al fallar la lectura, el perfil se ponía en null y `ResumenFiltros` pintaba
// «Sin presupuesto · Sin distancia · Sin universidad». Un fallo de red
// presentado como pérdida de datos, a alguien que acababa de llenar ese
// cuestionario. Y `src/store` estaba al 0 % de cobertura.

const mockMaybeSingle = jest.fn();
const mockSingle = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => mockMaybeSingle() }) }),
      update: () => ({ eq: () => ({ select: () => ({ single: () => mockSingle() }) }) }),
    }),
  },
}));

import { usePerfilStore } from '../usePerfilStore';

const PERFIL = { id: 'u1', nombre_usuario: 'ana', presupuesto_max: 4000, universidad: 'UTVT' };

beforeEach(() => {
  jest.clearAllMocks();
  usePerfilStore.setState({ perfil: null, cargando: false, error: null });
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test('una lectura buena deja el perfil y sin error', async () => {
  mockMaybeSingle.mockResolvedValue({ data: PERFIL, error: null });
  await usePerfilStore.getState().cargarPerfil('u1');
  expect(usePerfilStore.getState().perfil).toEqual(PERFIL);
  expect(usePerfilStore.getState().error).toBeNull();
  expect(usePerfilStore.getState().cargando).toBe(false);
});

// LA prueba. Antes esto dejaba el perfil en null.
test('si la lectura falla se CONSERVA el ultimo perfil conocido', async () => {
  mockMaybeSingle.mockResolvedValue({ data: PERFIL, error: null });
  await usePerfilStore.getState().cargarPerfil('u1');

  mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'network request failed' } });
  await usePerfilStore.getState().cargarPerfil('u1');

  expect(usePerfilStore.getState().perfil).toEqual(PERFIL);
  expect(usePerfilStore.getState().error).toBeTruthy();
});

test('una excepcion tambien conserva el perfil, no solo un error de PostgREST', async () => {
  mockMaybeSingle.mockResolvedValue({ data: PERFIL, error: null });
  await usePerfilStore.getState().cargarPerfil('u1');

  mockMaybeSingle.mockRejectedValue(new Error('se cayo la red'));
  await usePerfilStore.getState().cargarPerfil('u1');

  expect(usePerfilStore.getState().perfil).toEqual(PERFIL);
  expect(usePerfilStore.getState().error).toBeTruthy();
  expect(usePerfilStore.getState().cargando).toBe(false);
});

// Una cuenta recién creada SÍ puede no tener fila todavía: el trigger de alta
// tarda una fracción de segundo. Eso es vacío legítimo, no un fallo.
test('sin fila y sin error, el perfil queda en null sin marcar error', async () => {
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  await usePerfilStore.getState().cargarPerfil('u1');
  expect(usePerfilStore.getState().perfil).toBeNull();
  expect(usePerfilStore.getState().error).toBeNull();
});

test('una lectura buena posterior limpia el error', async () => {
  mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'falló' } });
  await usePerfilStore.getState().cargarPerfil('u1');
  expect(usePerfilStore.getState().error).toBeTruthy();

  mockMaybeSingle.mockResolvedValue({ data: PERFIL, error: null });
  await usePerfilStore.getState().cargarPerfil('u1');
  expect(usePerfilStore.getState().error).toBeNull();
});

// actualizarPerfil SÍ debe lanzar: quien guarda tiene que enterarse de que no
// se guardó. Es lo contrario de leer.
test('actualizarPerfil propaga el fallo en vez de tragárselo', async () => {
  mockSingle.mockResolvedValue({ data: null, error: { message: 'no se pudo' } });
  await expect(usePerfilStore.getState().actualizarPerfil('u1', { universidad: 'x' }))
    .rejects.toMatchObject({ message: 'no se pudo' });
});

test('actualizarPerfil deja el perfil devuelto por la base', async () => {
  mockSingle.mockResolvedValue({ data: { ...PERFIL, universidad: 'Otra' }, error: null });
  await usePerfilStore.getState().actualizarPerfil('u1', { universidad: 'Otra' });
  expect(usePerfilStore.getState().perfil).toMatchObject({ universidad: 'Otra' });
});
