const mockInvoke = jest.fn();
jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => mockInvoke(...a) } } }));

import { enviarSelfie } from '../rostro.service';

beforeEach(() => mockInvoke.mockReset());

describe('enviarSelfie', () => {
  it('manda rol, selfie, consentimiento EXPRESO y la versión del aviso', async () => {
    mockInvoke.mockResolvedValue({ data: { resultado: 'recibida', intentos_restantes: 4 }, error: null });
    const r = await enviarSelfie('comerciante', 'QUJD', 'v3');
    expect(mockInvoke).toHaveBeenCalledWith('verificar-rostro', {
      body: { rol: 'comerciante', selfie: 'QUJD', consentimiento: true, version_aviso: 'v3' },
    });
    expect(r).toEqual({ tipo: 'recibida', intentosRestantes: 4 });
  });

  it('un 429 de la función se lee por su código HTTP', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'x', context: { status: 429 } } });
    expect(await enviarSelfie('arrendador', 'QUJD', 'v3')).toEqual({ tipo: 'sin_intentos' });
  });

  it('un 503 se lee como «no disponible»', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'x', context: { status: 503 } } });
    expect(await enviarSelfie('arrendador', 'QUJD', 'v3')).toEqual({ tipo: 'no_disponible' });
  });

  it('un fallo de red (sin respuesta HTTP) es error, no «recibida»', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } });
    expect(await enviarSelfie('arrendador', 'QUJD', 'v3')).toEqual({ tipo: 'error' });
  });

  it('si invoke lanza, tampoco es éxito', async () => {
    mockInvoke.mockRejectedValue(new Error('boom'));
    expect(await enviarSelfie('arrendador', 'QUJD', 'v3')).toEqual({ tipo: 'error' });
  });
});
