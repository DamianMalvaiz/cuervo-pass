// Verificación de vendedor · 0049. El cliente solo LEE su fila y envía por la RPC.

const mockDesde = jest.fn();
const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { from: (...a: unknown[]) => mockDesde(...a), rpc: (...a: unknown[]) => mockRpc(...a) },
}));

import { enviarVerificacion, obtenerMiVerificacion } from '../verificacion.service';

function cadena(resultado: { data?: unknown; error?: unknown }) {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'maybeSingle']) c[m] = jest.fn(() => c);
  c.then = (f: (v: unknown) => unknown) => Promise.resolve(resultado).then(f);
  return c;
}

beforeEach(() => {
  mockDesde.mockReset();
  mockRpc.mockReset();
});

describe('obtenerMiVerificacion', () => {
  test('lee solo la de esta cuenta y este rol, sin las rutas de la INE', async () => {
    const c = cadena({ data: { nombre_legal: 'Ana', direccion: 'Calle 1', enviada_en: 'x', revisada_en: null, motivo_rechazo: null } });
    mockDesde.mockReturnValue(c);
    const r = await obtenerMiVerificacion('u1', 'comerciante');
    expect(r?.nombre_legal).toBe('Ana');
    expect(mockDesde).toHaveBeenCalledWith('verificaciones_vendedor');
    expect(c.eq).toHaveBeenCalledWith('usuario_id', 'u1');
    expect(c.eq).toHaveBeenCalledWith('rol', 'comerciante');
    const [columnas] = (c.select as jest.Mock).mock.calls[0];
    expect(columnas).not.toContain('ine_');
    expect(columnas).not.toBe('*');
  });

  test('si nunca envió, devuelve null (no es un fallo)', async () => {
    mockDesde.mockReturnValue(cadena({ data: null }));
    await expect(obtenerMiVerificacion('u1', 'arrendador')).resolves.toBeNull();
  });

  test('si la lectura falla, LANZA', async () => {
    mockDesde.mockReturnValue(cadena({ error: { message: 'sin red' } }));
    await expect(obtenerMiVerificacion('u1', 'arrendador')).rejects.toMatchObject({ message: 'sin red' });
  });
});

describe('enviarVerificacion', () => {
  const datos = {
    rol: 'comerciante' as const, nombreLegal: '  Ana Prueba Ruiz ', direccion: ' Calle 1, Lerma ',
    ineFrente: 'u1/comerciante/f.jpg', ineReverso: 'u1/comerciante/r.jpg', fotos: ['u1/comerciante/l.jpg'], versionAviso: 'v2',
  };

  test('llama a la RPC con los parámetros de la base y los textos sin espacios sobrantes', async () => {
    mockRpc.mockResolvedValue({ error: null });
    await enviarVerificacion(datos);
    expect(mockRpc).toHaveBeenCalledWith('enviar_verificacion', {
      p_rol: 'comerciante', p_nombre_legal: 'Ana Prueba Ruiz', p_direccion: 'Calle 1, Lerma',
      p_ine_frente: 'u1/comerciante/f.jpg', p_ine_reverso: 'u1/comerciante/r.jpg',
      p_fotos: ['u1/comerciante/l.jpg'], p_version_aviso: 'v2',
    });
  });

  test('el error conserva su código (CP005) para leerlo por código', async () => {
    mockRpc.mockResolvedValue({ error: { code: 'CP005', message: 'verificacion no enviable' } });
    await expect(enviarVerificacion(datos)).rejects.toMatchObject({ code: 'CP005' });
  });
});
