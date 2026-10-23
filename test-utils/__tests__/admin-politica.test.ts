import { interpretarSaludIa, rutasDeDocumentos, validarSolicitud } from '../../supabase/functions/admin/politica';

// La Edge Function `admin` ejecuta cosas poderosas con la llave de servicio (ver documentos de identidad, aprobar, ocultar contenido).
// Lo que se fija aquí es que NADA llegue a esas funciones sin pasar por una validación estricta del cuerpo: acciones cerradas, ids con
// forma de uuid, textos acotados.

const U = '00000000-0000-0000-0000-0000000000f7';

describe('validarSolicitud', () => {
  it.each([null, undefined, 'texto', 5, [], {}])('rechaza %p', (c) => {
    expect(validarSolicitud(c).ok).toBe(false);
  });

  it('rechaza una acción que no existe', () => {
    expect(validarSolicitud({ accion: 'borrar_todo' })).toEqual({ ok: false, codigo: 'accion_invalida' });
  });

  it.each(['resumen', 'resumen_detalle', 'verificaciones', 'moderacion', 'errores', 'auditoria', 'ingresos', 'salud', 'eventos_pago'])('«%s» no necesita más datos', (accion) => {
    expect(validarSolicitud({ accion })).toEqual({ ok: true, solicitud: { accion } });
  });

  describe('documentos', () => {
    it('acepta usuario y rol', () => {
      expect(validarSolicitud({ accion: 'documentos', usuario_id: U, rol: 'comerciante' })).toEqual({
        ok: true,
        solicitud: { accion: 'documentos', usuarioId: U, rol: 'comerciante' },
      });
    });
    it.each([
      [{ usuario_id: 'no-es-uuid', rol: 'comerciante' }],
      [{ usuario_id: U, rol: 'admin' }],
      [{ usuario_id: U }],
      [{ rol: 'arrendador' }],
      [{ usuario_id: `${U}; drop table usuarios`, rol: 'arrendador' }],
    ])('rechaza %j', (extra) => {
      expect(validarSolicitud({ accion: 'documentos', ...extra }).ok).toBe(false);
    });
  });

  describe('resolver', () => {
    it('aprobar no necesita motivo', () => {
      expect(validarSolicitud({ accion: 'resolver', usuario_id: U, rol: 'comerciante', aprobar: true })).toEqual({
        ok: true,
        solicitud: { accion: 'resolver', usuarioId: U, rol: 'comerciante', aprobar: true, motivo: null },
      });
    });
    it('rechazar exige un motivo de al menos 3 caracteres', () => {
      const base = { accion: 'resolver', usuario_id: U, rol: 'comerciante', aprobar: false };
      expect(validarSolicitud(base)).toEqual({ ok: false, codigo: 'motivo_requerido' });
      expect(validarSolicitud({ ...base, motivo: '  ' })).toEqual({ ok: false, codigo: 'motivo_requerido' });
      expect(validarSolicitud({ ...base, motivo: 'ab' })).toEqual({ ok: false, codigo: 'motivo_requerido' });
      expect(validarSolicitud({ ...base, motivo: 'La INE no se lee' }).ok).toBe(true);
    });
    it('el motivo se recorta y se acota a 400', () => {
      const base = { accion: 'resolver', usuario_id: U, rol: 'arrendador', aprobar: false };
      expect(validarSolicitud({ ...base, motivo: 'x'.repeat(401) }).ok).toBe(false);
      const r = validarSolicitud({ ...base, motivo: '  Foto borrosa  ' });
      expect(r.ok && r.solicitud.accion === 'resolver' && r.solicitud.motivo).toBe('Foto borrosa');
    });
    it('«aprobar» tiene que ser un booleano de verdad', () => {
      for (const aprobar of ['true', 1, null, undefined]) {
        expect(validarSolicitud({ accion: 'resolver', usuario_id: U, rol: 'comerciante', aprobar }).ok).toBe(false);
      }
    });
  });

  describe('moderar', () => {
    const base = { accion: 'moderar', tipo: 'resena', id: U, ocultar: false };
    it('restaurar no necesita motivo', () => {
      expect(validarSolicitud(base).ok).toBe(true);
    });
    it('ocultar exige motivo', () => {
      expect(validarSolicitud({ ...base, ocultar: true })).toEqual({ ok: false, codigo: 'motivo_requerido' });
      expect(validarSolicitud({ ...base, ocultar: true, motivo: 'Insulta' }).ok).toBe(true);
    });
    it('solo reseñas y negocios', () => {
      for (const tipo of ['usuario', 'publicacion', '', undefined]) {
        expect(validarSolicitud({ ...base, tipo }).ok).toBe(false);
      }
    });
    it('el id tiene forma de uuid', () => {
      expect(validarSolicitud({ ...base, id: '1; select 1' }).ok).toBe(false);
    });
  });

  describe('borrar_error', () => {
    it('acepta un uuid', () => {
      expect(validarSolicitud({ accion: 'borrar_error', id: U })).toEqual({ ok: true, solicitud: { accion: 'borrar_error', id: U } });
    });
    it.each([undefined, '', 'no-uuid', `${U}; drop table errores_app`, 5])('rechaza %p', (id) => {
      expect(validarSolicitud({ accion: 'borrar_error', id }).ok).toBe(false);
    });
  });

  describe('modo_demo', () => {
    it('acepta true o false', () => {
      expect(validarSolicitud({ accion: 'modo_demo', activo: true }).ok).toBe(true);
      expect(validarSolicitud({ accion: 'modo_demo', activo: false }).ok).toBe(true);
    });
    it('rechaza lo que no es booleano', () => {
      for (const activo of ['true', 1, null, undefined]) expect(validarSolicitud({ accion: 'modo_demo', activo }).ok).toBe(false);
    });
  });
});

describe('rutasDeDocumentos', () => {
  const fila = (extra = {}) => ({
    usuario_id: U,
    ine_frente: `${U}/comerciante/ine-frente-1.jpg`,
    ine_reverso: `${U}/comerciante/ine-reverso-1.jpg`,
    fotos: [`${U}/comerciante/lugar-1-1.jpg`],
    ine_borrada_en: null,
    ...extra,
  });

  it('devuelve las rutas propias, con cada INE etiquetada', () => {
    expect(rutasDeDocumentos(fila())).toEqual([
      { etiqueta: 'INE (frente)', ruta: `${U}/comerciante/ine-frente-1.jpg` },
      { etiqueta: 'INE (reverso)', ruta: `${U}/comerciante/ine-reverso-1.jpg` },
      { etiqueta: 'Foto 1', ruta: `${U}/comerciante/lugar-1-1.jpg` },
    ]);
  });

  it('descarta rutas de otra carpeta o con «..»', () => {
    const r = rutasDeDocumentos(fila({ ine_frente: '00000000-0000-0000-0000-0000000000b2/x.jpg', fotos: [`${U}/../x.jpg`] }));
    expect(r.map((x) => x.etiqueta)).toEqual(['INE (reverso)']);
  });

  it('con la INE ya borrada no ofrece la INE, pero sí las fotos del lugar', () => {
    const r = rutasDeDocumentos(fila({ ine_borrada_en: '2026-11-17T00:00:00Z' }));
    expect(r.map((x) => x.etiqueta)).toEqual(['Foto 1']);
  });
});

// ── Salud del servicio de IA (`GET /salud`, público) ────────────────────────
// La función `admin` mide el servicio y esta función pura interpreta lo medido. Lo que se protege: «no hay respuesta» y «cargando» no se confunden con «ok», un
// 200 sin el modelo cargado no cuenta como sano, y el commit solo sale si tiene forma de commit.
describe('interpretarSaludIa', () => {
  const ok = { status: 'ok', api_llm_configurada: true, modelo_cargado: true, commit: 'a3b1c2d4e5f60718293a4b5c6d7e8f9012345678' };

  it('sin AI_SERVICE_URL: «sin_configurar», sin tocar nada más', () => {
    expect(interpretarSaludIa({ configurado: false })).toEqual({ estado: 'sin_configurar', latencia_ms: null, api_llm_configurada: null, commit: null });
  });

  it('200 con el modelo cargado: «ok», con la latencia y el commit corto', () => {
    expect(interpretarSaludIa({ configurado: true, status: 200, cuerpo: ok, latenciaMs: 123 })).toEqual({
      estado: 'ok', latencia_ms: 123, api_llm_configurada: true, commit: 'a3b1c2d',
    });
  });

  it('200 pero con la API del LLM sin configurar: sigue «ok» y lo dice', () => {
    expect(interpretarSaludIa({ configurado: true, status: 200, cuerpo: { ...ok, api_llm_configurada: false }, latenciaMs: 5 }).api_llm_configurada).toBe(false);
  });

  it('503 «cargando»: «cargando», no «caído» (el modelo tarda en arrancar)', () => {
    expect(interpretarSaludIa({ configurado: true, status: 503, cuerpo: { status: 'cargando' }, latenciaMs: 9 }).estado).toBe('cargando');
  });

  it.each([
    ['fallo de red', { configurado: true as const, fallo: 'red' as const }],
    ['timeout', { configurado: true as const, fallo: 'timeout' as const }],
    ['500', { configurado: true as const, status: 500, cuerpo: null, latenciaMs: 1 }],
    ['502', { configurado: true as const, status: 502, cuerpo: 'Bad Gateway', latenciaMs: 1 }],
    ['200 sin cuerpo', { configurado: true as const, status: 200, cuerpo: null, latenciaMs: 1 }],
    ['200 con el modelo sin cargar', { configurado: true as const, status: 200, cuerpo: { ...ok, modelo_cargado: false }, latenciaMs: 1 }],
    ['200 con un estado que no es ok', { configurado: true as const, status: 200, cuerpo: { ...ok, status: 'raro' }, latenciaMs: 1 }],
    ['503 con otro cuerpo', { configurado: true as const, status: 503, cuerpo: { status: 'apagado' }, latenciaMs: 1 }],
  ])('%s → «caido»', (_nombre, medida) => {
    expect(interpretarSaludIa(medida).estado).toBe('caido');
  });

  it.each([['no-es-un-commit'], ['<script>'], [''], [42], [null]])('un commit con forma rara (%p) no se muestra', (commit) => {
    expect(interpretarSaludIa({ configurado: true, status: 200, cuerpo: { ...ok, commit }, latenciaMs: 1 }).commit).toBeNull();
  });
});
