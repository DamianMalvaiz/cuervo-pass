import { MAX_RESPUESTA, MAX_TEXTO_RESENA, estrellasDe, etiquetaCalificacion, textoCalificacion, textoNumResenas, validarRespuesta, validarResena } from '../resenas';

describe('validarResena', () => {
  it('una reseña de 1 a 5 estrellas, con o sin texto, es válida', () => {
    for (const n of [1, 2, 3, 4, 5]) expect(validarResena(n, '')).toEqual({});
    expect(validarResena(4, 'Muy bien')).toEqual({});
  });
  it.each([0, 6, -1, 2.5, NaN])('«%s» estrellas no es válido', (n) => {
    expect(validarResena(n, '').estrellas).toBeTruthy();
  });
  it('el texto tiene tope, contando sin espacios sobrantes', () => {
    expect(validarResena(5, 'a'.repeat(MAX_TEXTO_RESENA + 1)).texto).toBeTruthy();
    expect(validarResena(5, 'a'.repeat(MAX_TEXTO_RESENA)).texto).toBeUndefined();
    expect(validarResena(5, `  ${'a'.repeat(MAX_TEXTO_RESENA)}  `).texto).toBeUndefined();
  });
});

describe('validarRespuesta', () => {
  it('vacía o dentro del tope es válida (vacía quita la respuesta)', () => {
    expect(validarRespuesta('')).toBeNull();
    expect(validarRespuesta('a'.repeat(MAX_RESPUESTA))).toBeNull();
  });
  it('pasarse del tope se señala', () => expect(validarRespuesta('a'.repeat(MAX_RESPUESTA + 1))).toBeTruthy());
});

describe('textos', () => {
  it('la calificación lleva una cifra decimal', () => {
    expect(textoCalificacion(4.5)).toBe('4.5');
    expect(textoCalificacion(4)).toBe('4.0');
  });
  it('«1 reseña» en singular y «N reseñas» en plural', () => {
    expect(textoNumResenas(1)).toBe('1 reseña');
    expect(textoNumResenas(12)).toBe('12 reseñas');
  });
  it('la etiqueta accesible dice las estrellas y cuántas reseñas', () => {
    expect(etiquetaCalificacion(4.5, 12)).toBe('4.5 de 5 estrellas, 12 reseñas');
  });
  it('sin reseñas no inventa una calificación', () => {
    expect(etiquetaCalificacion(null, 0)).toBe('Sin reseñas todavía');
    expect(etiquetaCalificacion(undefined, 0)).toBe('Sin reseñas todavía');
    expect(etiquetaCalificacion(4, 0)).toBe('Sin reseñas todavía');
  });
});

describe('estrellasDe', () => {
  it.each([
    [5, { llenas: 5, media: false, vacias: 0 }],
    [4.5, { llenas: 4, media: true, vacias: 0 }],
    [4.2, { llenas: 4, media: false, vacias: 1 }],
    [4.3, { llenas: 4, media: true, vacias: 0 }],
    [3.0, { llenas: 3, media: false, vacias: 2 }],
    [1, { llenas: 1, media: false, vacias: 4 }],
    [0, { llenas: 0, media: false, vacias: 5 }],
  ])('%s → %j', (c, esperado) => {
    expect(estrellasDe(c)).toEqual(esperado);
  });
  it('siempre suman cinco, aunque el valor se salga de rango', () => {
    for (const c of [-2, 0.4, 2.7, 5.9, 99]) {
      const e = estrellasDe(c);
      expect(e.llenas + (e.media ? 1 : 0) + e.vacias).toBe(5);
    }
  });
});
