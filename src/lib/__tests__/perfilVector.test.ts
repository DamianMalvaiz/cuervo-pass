import { avisoVector, campoVector, resolverPerfilVector } from '@/lib/perfilVector';
import { ServicioIaError, generarEmbedding } from '@/lib/aiService';

jest.mock('@/lib/aiService', () => {
  class ServicioIaError extends Error {
    constructor(mensaje: string, readonly cuotaAgotada = false) {
      super(mensaje);
      this.name = 'ServicioIaError';
    }
  }
  return { ServicioIaError, generarEmbedding: jest.fn() };
});

const generar = generarEmbedding as jest.MockedFunction<typeof generarEmbedding>;
const vector = Array.from({ length: 384 }, (_, i) => i / 384);

beforeEach(() => generar.mockReset());

describe('resolverPerfilVector', () => {
  it('sin consentimiento no llama al servicio siquiera', async () => {
    expect(await resolverPerfilVector(false, 'texto')).toEqual({ estado: 'sin-consentimiento' });
    expect(generar).not.toHaveBeenCalled();
  });

  it('con consentimiento devuelve el vector generado', async () => {
    generar.mockResolvedValue(vector);
    expect(await resolverPerfilVector(true, 'texto')).toEqual({ estado: 'generado', vector });
  });

  it('un fallo del servicio es su propio estado, no un null', async () => {
    generar.mockRejectedValue(new Error('sin conexión'));
    expect(await resolverPerfilVector(true, 'texto')).toEqual({ estado: 'fallo', cuotaAgotada: false });
  });

  it('distingue la cuota agotada de un fallo de red', async () => {
    generar.mockRejectedValue(new ServicioIaError('límite diario', true));
    expect(await resolverPerfilVector(true, 'texto')).toEqual({ estado: 'fallo', cuotaAgotada: true });
  });
});

describe('campoVector', () => {
  it('retirar el consentimiento SÍ borra el vector', () => {
    expect(campoVector({ estado: 'sin-consentimiento' })).toEqual({ perfil_vector: null });
  });

  it('un vector nuevo se escribe', () => {
    expect(campoVector({ estado: 'generado', vector })).toEqual({ perfil_vector: vector });
  });

  // Esta es LA aserción: la que habría atrapado el fallo del 18/09/2026, en que
  // una cuenta acabó con consentimiento puesto y vector en null porque el
  // microservicio no respondió durante el guardado.
  //
  // No basta con `toEqual({})`: lo que importa es que la clave ESTÉ AUSENTE.
  // `{ perfil_vector: undefined }` pasaría un toEqual y en cambio mandaría a
  // PostgREST una columna que no queremos tocar.
  it('un fallo del servicio NO toca la columna', () => {
    const campos = campoVector({ estado: 'fallo', cuotaAgotada: false });
    expect(Object.prototype.hasOwnProperty.call(campos, 'perfil_vector')).toBe(false);
    expect(Object.keys(campos)).toHaveLength(0);
  });
});

describe('avisoVector', () => {
  it('no avisa nada cuando todo salió bien', () => {
    expect(avisoVector({ estado: 'generado', vector }, true)).toBeNull();
    expect(avisoVector({ estado: 'sin-consentimiento' }, true)).toBeNull();
  });

  it('un fallo siempre avisa: el silencio era la mitad del bug', () => {
    expect(avisoVector({ estado: 'fallo', cuotaAgotada: false }, true)).not.toBeNull();
  });

  it('con vector previo dice que el orden quedó desfasado', () => {
    const aviso = avisoVector({ estado: 'fallo', cuotaAgotada: false }, true)!;
    expect(aviso.cuerpo).toContain('anterior');
    expect(aviso.cuerpo).not.toContain('Nivel 1');
  });

  it('sin vector previo dice que se cae a Nivel 1', () => {
    const aviso = avisoVector({ estado: 'fallo', cuotaAgotada: false }, false)!;
    expect(aviso.cuerpo).toContain('Nivel 1');
  });

  it('la cuota agotada se explica como límite, no como caída', () => {
    const aviso = avisoVector({ estado: 'fallo', cuotaAgotada: true }, false)!;
    expect(aviso.cuerpo).toContain('límite');
  });
});
