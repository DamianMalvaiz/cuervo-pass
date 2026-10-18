import { BIOMETRIA_HABILITADA, GUIA_SELFIE, TEXTO_CONSENTIMIENTO, interpretarRespuestaRostro } from '../rostro';
import { VERSION_AVISO } from '../verificacion';

// La verificación de rostro es una ayuda para el admin. Aquí se fija lo que la PERSONA llega a saber del resultado (nada de cifras
// ni de la causa) y que el paso no se enciende con un aviso de privacidad que no lo menciona.

describe('BIOMETRIA_HABILITADA', () => {
  it('no puede estar encendida con un aviso de privacidad que no menciona la biometría (v2)', () => {
    // Si alguien enciende la bandera, esta prueba obliga a subir también VERSION_AVISO: un consentimiento sobre un aviso que no
    // habla del rostro no es un consentimiento informado.
    expect(BIOMETRIA_HABILITADA && VERSION_AVISO === 'v2').toBe(false);
  });
});

describe('interpretarRespuestaRostro', () => {
  it('200 «recibida»', () => {
    expect(interpretarRespuestaRostro(200, { resultado: 'recibida', intentos_restantes: 3 })).toEqual({ tipo: 'recibida', intentosRestantes: 3 });
  });

  it('200 «repetir» conserva los intentos restantes', () => {
    expect(interpretarRespuestaRostro(200, { resultado: 'repetir', intentos_restantes: 2 })).toEqual({ tipo: 'repetir', intentosRestantes: 2 });
  });

  it('429 = se acabaron los intentos', () => {
    expect(interpretarRespuestaRostro(429, null)).toEqual({ tipo: 'sin_intentos' });
  });

  it('503 = el servicio no está disponible: la revisión manual sigue', () => {
    expect(interpretarRespuestaRostro(503, null)).toEqual({ tipo: 'no_disponible' });
  });

  it('un 200 con una forma inesperada NO es éxito', () => {
    for (const cuerpo of [null, {}, { resultado: 'aprobada' }, { resultado: 'recibida' }, 'texto', { resultado: 'recibida', intentos_restantes: -1 }]) {
      expect(interpretarRespuestaRostro(200, cuerpo)).toEqual({ tipo: 'error' });
    }
  });

  it('cualquier otro código es error', () => {
    for (const s of [400, 401, 409, 500, 502]) expect(interpretarRespuestaRostro(s, null)).toEqual({ tipo: 'error' });
  });

  it('nunca expone cifras ni la causa', () => {
    const r = interpretarRespuestaRostro(200, { resultado: 'recibida', intentos_restantes: 4, identidad: 0.9, vivo: 0.99, estado: 'coincide' });
    expect(Object.keys(r).sort()).toEqual(['intentosRestantes', 'tipo']);
  });
});

describe('textos', () => {
  it('el consentimiento nombra el rostro, que es optativo y que no se guarda la foto', () => {
    expect(TEXTO_CONSENTIMIENTO.etiqueta).toMatch(/rostro/i);
    expect(TEXTO_CONSENTIMIENTO.ayuda).toMatch(/no guardamos/i);
    expect(TEXTO_CONSENTIMIENTO.ayuda).toMatch(/opcional|sin esto|puedes omitir/i);
  });

  it('la guía de la selfie cubre la causa de «repetir» medida en las rondas: demasiado cerca', () => {
    expect(GUIA_SELFIE.join(' ')).toMatch(/brazo|distancia|lejos/i);
    expect(GUIA_SELFIE.join(' ')).toMatch(/luz/i);
  });
});
