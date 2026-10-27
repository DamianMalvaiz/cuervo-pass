import { armarRespuesta, fuenteDe, separarFotos, validarSolicitudFotos, MAX_FOTOS } from '../../supabase/functions/fotos-publicas/politica';

// `fotos-publicas`: las fotos para quien NO tiene cuenta. El almacenamiento es privado y `anon` no firma nada, así que esta función, con la llave de servicio, firma SOLO las
// fotos de lo que las vistas de explorar (0090) ya enseñan. Lo que se prueba aquí es lo que decide qué se firma: el cuerpo solo dice QUÉ cosa (tipo e id), nunca una ruta,
// y las rutas salen de las VISTAS, nunca de las tablas ni del cliente.

const ID = '3b241101-e2bb-4255-8caf-4136c566a962';

describe('validarSolicitudFotos', () => {
  it.each(['publicacion', 'negocio', 'producto'])('acepta «%s» con un id', (tipo) => {
    expect(validarSolicitudFotos({ tipo, id: ID })).toEqual({ ok: true, tipo, id: ID });
  });

  it('rechaza un tipo que no existe', () => {
    expect(validarSolicitudFotos({ tipo: 'perfil', id: ID })).toEqual({ ok: false, error: 'tipo inválido' });
    expect(validarSolicitudFotos({ tipo: 'verificacion', id: ID })).toEqual({ ok: false, error: 'tipo inválido' });
  });

  it('rechaza un id que no es un uuid (incluidas las rutas y los intentos de inyección)', () => {
    for (const id of ['abc', '', '../x', "x' or 1=1 --", 'publicaciones/otro/a.jpg', 12345, null, undefined]) {
      expect(validarSolicitudFotos({ tipo: 'negocio', id })).toEqual({ ok: false, error: 'id inválido' });
    }
  });

  it('rechaza lo que no es un objeto', () => {
    for (const crudo of [null, undefined, 'x', 3, [], [ID]]) expect(validarSolicitudFotos(crudo)).toEqual({ ok: false, error: 'cuerpo inválido' });
  });

  it('IGNORA cualquier otra cosa que mande el cliente: una ruta, un bucket, un usuario', () => {
    const r = validarSolicitudFotos({ tipo: 'publicacion', id: ID, ruta: 'verificacion/otro/ine.jpg', bucket: 'verificacion', usuario_id: ID });
    expect(r).toEqual({ ok: true, tipo: 'publicacion', id: ID });
  });
});

describe('fuenteDe: de dónde salen las rutas', () => {
  it('siempre de una VISTA de lo visible, nunca de la tabla (la tabla incluiría lo oculto y lo inactivo)', () => {
    expect(fuenteDe('publicacion')).toEqual({ vista: 'publicaciones_publicas', columna: 'fotos' });
    expect(fuenteDe('negocio')).toEqual({ vista: 'negocios_publicos', columna: 'fotos' });
    expect(fuenteDe('producto')).toEqual({ vista: 'negocio_items_publicos', columna: 'fotos' });
    for (const t of ['publicacion', 'negocio', 'producto'] as const) {
      expect(['publicaciones', 'negocios', 'negocio_items']).not.toContain(fuenteDe(t).vista);
    }
  });
});

describe('separarFotos', () => {
  it('distingue las rutas del almacenamiento de las URL externas (las de ejemplo vienen de Unsplash)', () => {
    const r = separarFotos(['publicaciones/u1/a.jpg', 'https://images.unsplash.com/foto.jpg']);
    expect(r).toEqual([
      { tipo: 'ruta', ruta: 'publicaciones/u1/a.jpg' },
      { tipo: 'externa', url: 'https://images.unsplash.com/foto.jpg' },
    ]);
  });

  it('descarta lo que no es seguro: http plano, javascript:, data:, rutas con «..» o absolutas, y lo que no es texto', () => {
    const r = separarFotos(['http://x.test/a.jpg', 'javascript:alert(1)', 'data:image/png;base64,AAA', '../secreto.jpg', 'a/../b.jpg', '/etc/passwd', 42, null, '', 'x'.repeat(400)]);
    expect(r).toEqual([]);
  });

  it(`no pasa de ${MAX_FOTOS} fotos`, () => {
    const r = separarFotos(Array.from({ length: 50 }, (_, i) => `negocios/n/${i}.jpg`));
    expect(r).toHaveLength(MAX_FOTOS);
  });

  it('algo que no es una lista no firma nada', () => {
    for (const x of [null, undefined, 'a.jpg', { 0: 'a.jpg' }, 7]) expect(separarFotos(x)).toEqual([]);
  });
});

describe('armarRespuesta', () => {
  it('devuelve las URL en el MISMO orden que las fotos, mezclando firmadas y externas', () => {
    const entradas = separarFotos(['negocios/n/1.jpg', 'https://images.unsplash.com/2.jpg', 'negocios/n/3.jpg']);
    const firmadas = new Map([['negocios/n/1.jpg', 'https://firma.test/1'], ['negocios/n/3.jpg', 'https://firma.test/3']]);
    expect(armarRespuesta(entradas, firmadas)).toEqual(['https://firma.test/1', 'https://images.unsplash.com/2.jpg', 'https://firma.test/3']);
  });

  it('una foto que no se pudo firmar se omite (no se manda su ruta ni un hueco)', () => {
    const entradas = separarFotos(['negocios/n/1.jpg', 'negocios/n/2.jpg']);
    expect(armarRespuesta(entradas, new Map([['negocios/n/2.jpg', 'https://firma.test/2']]))).toEqual(['https://firma.test/2']);
  });

  it('NUNCA devuelve una ruta del almacenamiento: las rutas llevan el id de la cuenta', () => {
    const entradas = separarFotos(['publicaciones/00000000-0000-0000-0000-0000000000b2/a.jpg']);
    const salida = armarRespuesta(entradas, new Map());
    expect(JSON.stringify(salida)).not.toContain('00000000-0000-0000-0000-0000000000b2');
    expect(salida).toEqual([]);
  });
});
