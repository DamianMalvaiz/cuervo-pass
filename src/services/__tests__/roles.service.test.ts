// Roles de usuario · Cuervo 360 · migración 0043.
//
// El cliente solo LEE sus roles; agregarse una función pasa por la RPC
// `agregar_funcion`, que decide en el servidor. Estas pruebas fijan el contrato del lado de la
// app: qué se pide, y que un fallo de lectura NO se confunde con «no tienes roles» (END-11).

const mockDesde = jest.fn();
const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]) => mockDesde(...a),
    rpc: (...a: unknown[]) => mockRpc(...a),
  },
}));

import { agregarFuncion, obtenerMisRoles } from '../roles.service';

function cadena(resultado: { data?: unknown; error?: unknown }) {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order']) c[m] = jest.fn(() => c);
  c.then = (f: (v: unknown) => unknown) => Promise.resolve(resultado).then(f);
  return c;
}

beforeEach(() => {
  mockDesde.mockReset();
  mockRpc.mockReset();
});

describe('obtenerMisRoles', () => {
  test('lee de roles_usuario y filtra por la cuenta', async () => {
    const c = cadena({ data: [{ usuario_id: 'u1', rol: 'arrendador', estado: 'aprobado', origen: 'migracion', desde: 'x' }] });
    mockDesde.mockReturnValue(c);

    const roles = await obtenerMisRoles('u1');

    expect(mockDesde).toHaveBeenCalledWith('roles_usuario');
    expect(c.eq).toHaveBeenCalledWith('usuario_id', 'u1');
    expect(roles).toHaveLength(1);
    expect(roles[0].rol).toBe('arrendador');
  });

  test('sin filas devuelve una lista vacía: es el caso normal de casi todas las cuentas', async () => {
    mockDesde.mockReturnValue(cadena({ data: [] }));
    await expect(obtenerMisRoles('u1')).resolves.toEqual([]);
  });

  // END-11 · «falló la lectura» NO puede salir como «no tienes roles».
  test('si la lectura falla, LANZA: nunca devuelve una lista vacía', async () => {
    mockDesde.mockReturnValue(cadena({ error: { message: 'sin red', code: '08006' } }));
    await expect(obtenerMisRoles('u1')).rejects.toMatchObject({ message: 'sin red' });
  });
});

describe('agregarFuncion', () => {
  test.each(['comerciante', 'arrendador'] as const)('pide %s a la RPC', async (rol) => {
    mockRpc.mockResolvedValue({ error: null });
    await agregarFuncion(rol);
    expect(mockRpc).toHaveBeenCalledWith('agregar_funcion', { p_rol: rol });
  });

  test('conserva el código del error para que la pantalla lo lea por código (END-27)', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'funcion no permitida', code: 'CP003' } });
    await expect(agregarFuncion('comerciante')).rejects.toMatchObject({ code: 'CP003' });
  });
});
