const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => mockRpc(...a) } }));

import { aceptarAviso } from '../aviso.service';

beforeEach(() => mockRpc.mockReset());

describe('aceptarAviso', () => {
  it('llama a la RPC con la versión', async () => {
    mockRpc.mockResolvedValue({ error: null });
    await aceptarAviso('v3');
    expect(mockRpc).toHaveBeenCalledWith('aceptar_aviso', { p_version: 'v3' });
  });

  it('un error se propaga: aceptar y que no quede registrado no es aceptar', async () => {
    mockRpc.mockResolvedValue({ error: { code: '22023', message: 'x' } });
    await expect(aceptarAviso('v3')).rejects.toMatchObject({ code: '22023' });
  });
});
