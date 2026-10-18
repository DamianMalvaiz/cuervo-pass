import { etiquetaDeAjuste, razonesDeAjuste } from '../razonesDeAjuste';

// Cuervo 360 · la ficha deja de enseñar «9.4» y su fórmula (17/10/2026). Dice en palabras POR QUÉ es buena para ti,
// y solo con lo que de verdad se cumple: una razón inventada es peor que ninguna.

describe('razonesDeAjuste', () => {
  const base = { precio: 3000, presupuestoMax: 4000, distanciaKm: 1.2, distanciaMaxKm: 5, permiteMascotas: true, tengoMascotas: true };

  it('dice todo lo que se cumple', () => {
    expect(razonesDeAjuste(base)).toEqual([
      'Está dentro de tu presupuesto',
      'Queda dentro de tu distancia máxima',
      'Acepta mascotas, como pediste',
    ]);
  });

  it('el presupuesto: justo en el tope cuenta; por encima no', () => {
    expect(razonesDeAjuste({ ...base, precio: 4000 })).toContain('Está dentro de tu presupuesto');
    expect(razonesDeAjuste({ ...base, precio: 4001 })).not.toContain('Está dentro de tu presupuesto');
  });

  it('sin tope de presupuesto no se afirma nada del presupuesto', () => {
    expect(razonesDeAjuste({ ...base, presupuestoMax: null })).not.toContain('Está dentro de tu presupuesto');
    expect(razonesDeAjuste({ ...base, presupuestoMax: undefined })).not.toContain('Está dentro de tu presupuesto');
  });

  it('la distancia: justo en el límite cuenta; más lejos no', () => {
    expect(razonesDeAjuste({ ...base, distanciaKm: 5 })).toContain('Queda dentro de tu distancia máxima');
    expect(razonesDeAjuste({ ...base, distanciaKm: 5.1 })).not.toContain('Queda dentro de tu distancia máxima');
  });

  it('sin distancia calculada (geocoding falló) no se inventa', () => {
    expect(razonesDeAjuste({ ...base, distanciaKm: null })).not.toContain('Queda dentro de tu distancia máxima');
    expect(razonesDeAjuste({ ...base, distanciaMaxKm: null })).not.toContain('Queda dentro de tu distancia máxima');
  });

  it('las mascotas solo cuentan si TÚ tienes y la publicación las acepta', () => {
    expect(razonesDeAjuste({ ...base, tengoMascotas: false })).not.toContain('Acepta mascotas, como pediste');
    expect(razonesDeAjuste({ ...base, permiteMascotas: false })).not.toContain('Acepta mascotas, como pediste');
  });

  it('sin nada que se cumpla devuelve una lista vacía', () => {
    expect(razonesDeAjuste({ precio: 9000, presupuestoMax: 4000, distanciaKm: 9, distanciaMaxKm: 5, permiteMascotas: false, tengoMascotas: false })).toEqual([]);
  });
});

describe('etiquetaDeAjuste', () => {
  it.each([
    [0.95, 'Muy compatible contigo'],
    [0.75, 'Muy compatible contigo'],
    [0.74, 'Compatible contigo'],
    [0.5, 'Compatible contigo'],
  ])('score %s → «%s»', (score, etiqueta) => {
    expect(etiquetaDeAjuste(score)).toBe(etiqueta);
  });

  it('por debajo de 0.5 no se pinta nada: no se le dice a nadie que algo «no es compatible» con una heurística', () => {
    expect(etiquetaDeAjuste(0.49)).toBeNull();
    expect(etiquetaDeAjuste(0)).toBeNull();
  });

  it('sin score (o inválido) no hay etiqueta', () => {
    expect(etiquetaDeAjuste(null)).toBeNull();
    expect(etiquetaDeAjuste(undefined)).toBeNull();
    expect(etiquetaDeAjuste(NaN)).toBeNull();
  });
});
