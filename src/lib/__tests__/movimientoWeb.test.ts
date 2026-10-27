import { anim, animTarjeta, valorContado } from '../movimientoWeb';

// Los dos ayudantes del movimiento de la web: los atributos que enciende cada animación del CSS global (con su «escalera» de retraso, acotada) y la curva de la cifra que cuenta hasta su valor.

describe('anim', () => {
  it('marca el tipo de animación', () => {
    expect(anim('sube')).toEqual({ dataSet: { anim: 'sube' } });
  });

  it('con paso añade el escalón, entero y acotado a 1–8 (el retraso total tiene tope)', () => {
    expect(anim('sube', 3)).toEqual({ dataSet: { anim: 'sube', paso: '3' } });
    expect(anim('sube', 40)).toEqual({ dataSet: { anim: 'sube', paso: '8' } });
    expect(anim('sube', 2.6)).toEqual({ dataSet: { anim: 'sube', paso: '3' } });
  });

  it('el primero de la fila (paso 0 o negativo) no lleva retraso', () => {
    expect(anim('sube', 0)).toEqual({ dataSet: { anim: 'sube' } });
    expect(anim('sube', -2)).toEqual({ dataSet: { anim: 'sube' } });
  });
});

describe('valorContado', () => {
  it('empieza en 0, termina EXACTO en el valor y nunca lo pasa', () => {
    expect(valorContado(94, 0, 1000)).toBe(0);
    expect(valorContado(94, 1000, 1000)).toBe(94);
    expect(valorContado(94, 5000, 1000)).toBe(94);
    for (let t = 0; t <= 1000; t += 50) expect(valorContado(94, t, 1000)).toBeLessThanOrEqual(94);
  });

  it('solo sube (nunca da marcha atrás) y llega rápido: a media duración ya pasó de la mitad', () => {
    let anterior = -1;
    for (let t = 0; t <= 1000; t += 25) {
      const v = valorContado(94, t, 1000);
      expect(v).toBeGreaterThanOrEqual(anterior);
      anterior = v;
    }
    expect(valorContado(94, 500, 1000)).toBeGreaterThan(47);
  });

  it('entrega enteros (una cifra de ajuste no tiene decimales)', () => {
    for (let t = 0; t <= 1000; t += 37) expect(Number.isInteger(valorContado(94, t, 1000))).toBe(true);
  });

  it('sin duración no hay nada que contar: devuelve el valor', () => {
    expect(valorContado(94, 0, 0)).toBe(94);
  });
});

describe('animTarjeta', () => {
  it('marca la tarjeta (para el levantado al pasar el cursor) y su entrada en escalera', () => {
    expect(animTarjeta(2)).toEqual({ dataSet: { tarjeta: '1', anim: 'sube', paso: '2' } });
  });

  it('sin lugar en la fila (o el primero) no lleva retraso, pero sigue siendo tarjeta', () => {
    expect(animTarjeta()).toEqual({ dataSet: { tarjeta: '1', anim: 'sube' } });
    expect(animTarjeta(0)).toEqual({ dataSet: { tarjeta: '1', anim: 'sube' } });
  });
});
