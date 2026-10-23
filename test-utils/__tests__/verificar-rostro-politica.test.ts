import {
  MAX_SELFIE_B64,
  MAX_INTENTOS,
  rutaDeIneFrente,
  respuestaParaLaPersona,
  validarCuerpo,
} from '../../supabase/functions/verificar-rostro/politica';

// `verificar-rostro` baja la INE con la llave de servicio y la manda al servicio de IA. Lo que se fija aquí:
//  · sin consentimiento expreso no se hace nada;
//  · la persona NUNCA se entera de la identidad, el puntaje ni de si falló por «no es la misma» o «no es una cara viva»
//    (serían un oráculo para afinar un ataque);
//  · un estado desconocido del servicio no se interpreta como éxito;
//  · solo se lee una INE de la propia carpeta.

const U = '00000000-0000-0000-0000-0000000000f7';
const ok = { rol: 'comerciante', selfie: 'AAAA', consentimiento: true, version_aviso: 'v3' };

describe('validarCuerpo', () => {
  it('acepta un cuerpo completo', () => {
    expect(validarCuerpo(ok)).toEqual({ ok: true, rol: 'comerciante', selfie: 'AAAA', versionAviso: 'v3' });
  });

  it.each([null, undefined, 'texto', 5, []])('rechaza %p', (c) => {
    expect(validarCuerpo(c).ok).toBe(false);
  });

  it('sin consentimiento expreso (true exacto) no pasa', () => {
    for (const consentimiento of [false, undefined, 'true', 1, null]) {
      expect(validarCuerpo({ ...ok, consentimiento })).toEqual({ ok: false, codigo: 'sin_consentimiento' });
    }
  });

  it('solo comerciante o arrendador', () => {
    for (const rol of ['admin', 'estudiante', '', undefined, 7]) {
      expect(validarCuerpo({ ...ok, rol })).toEqual({ ok: false, codigo: 'rol_invalido' });
    }
  });

  it('la versión del aviso es obligatoria y acotada', () => {
    expect(validarCuerpo({ ...ok, version_aviso: '' }).ok).toBe(false);
    expect(validarCuerpo({ ...ok, version_aviso: '   ' }).ok).toBe(false);
    expect(validarCuerpo({ ...ok, version_aviso: 'x'.repeat(21) }).ok).toBe(false);
  });

  it('la versión del aviso tiene la forma v<n>, la misma que exige la base (0075)', () => {
    // Antes bastaba una cadena de 1 a 20 caracteres: 'zzz' llegaba a la base como «consentimiento». Si la forma del cliente y la de la base
    // divergen, la función deja pasar lo que la base rechaza (y la persona ve un error genérico en vez de uno claro).
    for (const mala of ['zzz', 'V3', 'v', 'v3.1', 'v3; drop table usuarios', ' v 3', 'v1234']) {
      expect(validarCuerpo({ ...ok, version_aviso: mala })).toEqual({ ok: false, codigo: 'aviso_invalido' });
    }
    for (const buena of ['v2', 'v3', 'v10', 'v999']) {
      expect(validarCuerpo({ ...ok, version_aviso: buena }).ok).toBe(true);
    }
  });

  it('la selfie debe ser base64 no vacío y de tamaño acotado', () => {
    expect(validarCuerpo({ ...ok, selfie: '' })).toEqual({ ok: false, codigo: 'selfie_invalida' });
    expect(validarCuerpo({ ...ok, selfie: 'no es base64!!' })).toEqual({ ok: false, codigo: 'selfie_invalida' });
    expect(validarCuerpo({ ...ok, selfie: 'A'.repeat(MAX_SELFIE_B64 + 4) })).toEqual({ ok: false, codigo: 'selfie_invalida' });
    expect(validarCuerpo({ ...ok, selfie: 5 })).toEqual({ ok: false, codigo: 'selfie_invalida' });
  });

  it('acepta base64 con relleno', () => {
    expect(validarCuerpo({ ...ok, selfie: 'QUJD' }).ok).toBe(true);
    expect(validarCuerpo({ ...ok, selfie: 'QUI=' }).ok).toBe(true);
  });
});

describe('respuestaParaLaPersona', () => {
  it('«repetir_selfie» pide otra foto y dice cuántos intentos quedan', () => {
    expect(respuestaParaLaPersona('repetir_selfie', 2)).toEqual({ resultado: 'repetir', intentos_restantes: MAX_INTENTOS - 2 });
  });

  it.each(['coincide', 'no_coincide', 'no_vivo', 'sin_rostro_ine'])('%s se ve igual: «recibida»', (estado) => {
    expect(respuestaParaLaPersona(estado, 1)).toEqual({ resultado: 'recibida', intentos_restantes: MAX_INTENTOS - 1 });
  });

  it('no_coincide y no_vivo son indistinguibles para quien los recibe', () => {
    expect(respuestaParaLaPersona('no_vivo', 1)).toEqual(respuestaParaLaPersona('no_coincide', 1));
  });

  it('un estado desconocido NO es éxito: se trata como error', () => {
    expect(respuestaParaLaPersona('aprobado', 1)).toBeNull();
    expect(respuestaParaLaPersona(undefined, 1)).toBeNull();
    expect(respuestaParaLaPersona(42, 1)).toBeNull();
  });

  it('los intentos restantes nunca son negativos', () => {
    expect(respuestaParaLaPersona('repetir_selfie', 99)?.intentos_restantes).toBe(0);
  });
});

describe('rutaDeIneFrente', () => {
  it('devuelve la ruta propia', () => {
    expect(rutaDeIneFrente({ usuario_id: U, ine_frente: `${U}/f.jpg`, ine_borrada_en: null })).toBe(`${U}/f.jpg`);
  });

  it.each([
    ['otra carpeta', `00000000-0000-0000-0000-0000000000b2/f.jpg`],
    ['salida con ..', `${U}/../x.jpg`],
    ['prefijo parecido', `${U}x/f.jpg`],
    ['vacía', ''],
  ])('rechaza %s', (_n, ruta) => {
    expect(rutaDeIneFrente({ usuario_id: U, ine_frente: ruta, ine_borrada_en: null })).toBeNull();
  });

  it('con la INE ya borrada (30 días) no hay nada que comparar', () => {
    expect(rutaDeIneFrente({ usuario_id: U, ine_frente: `${U}/f.jpg`, ine_borrada_en: '2026-11-17T00:00:00Z' })).toBeNull();
  });
});
