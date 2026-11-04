import { MONTOS, TOPES_TRAMO, etiquetaDeTramo, resumirMercado, tramoDe } from '../presupuestoMercado';

// «¿Qué alcanza con tu presupuesto?»: «hasta $X» incluye X; los tramos suman el total; no se cuenta lo que no es una renta.

const p = (precio_renta: number, tipo: 'cuarto' | 'depa' | 'casa_compartida' = 'cuarto') => ({ precio_renta, tipo });

describe('resumirMercado', () => {
  const lista = [p(1800), p(2000), p(2500, 'depa'), p(3000, 'casa_compartida'), p(3200), p(4500, 'depa'), p(7000, 'depa')];

  it('«hasta $X» INCLUYE la renta igual a X', () => {
    expect(resumirMercado(lista, 2000).alcanzan).toBe(2);
    expect(resumirMercado(lista, 1999).alcanzan).toBe(1);
  });

  it('cuenta el total y los que alcanzan', () => {
    const r = resumirMercado(lista, 3200);
    expect(r.total).toBe(7);
    expect(r.alcanzan).toBe(5);
  });

  it('por tipo: total y los que alcanzan', () => {
    const r = resumirMercado(lista, 3200);
    expect(r.porTipo.cuarto).toEqual({ total: 3, alcanzan: 3 });
    expect(r.porTipo.depa).toEqual({ total: 3, alcanzan: 1 });
    expect(r.porTipo.casa_compartida).toEqual({ total: 1, alcanzan: 1 });
  });

  it('los tramos suman el total y los que alcanzan, y cada renta cae en uno solo', () => {
    for (const monto of MONTOS) {
      const r = resumirMercado(lista, monto);
      expect(r.tramos.reduce((n, t) => n + t.total, 0)).toBe(r.total);
      expect(r.tramos.reduce((n, t) => n + t.alcanzan, 0)).toBe(r.alcanzan);
    }
  });

  it('un tramo parcialmente cubierto cuenta solo lo que cabe', () => {
    // monto 4500: el tramo $4,001 a $5,000 trae solo la de 4,500 (y cabe); el de 6,000+ trae la de 7,000 (no cabe).
    const r = resumirMercado(lista, 4500);
    expect(r.tramos[3]).toMatchObject({ total: 1, alcanzan: 1 });
    expect(r.tramos[5]).toMatchObject({ total: 1, alcanzan: 0 });
  });

  it('lo que no es una renta (cero, negativa, NaN) no se cuenta: no se inventa un lugar', () => {
    const r = resumirMercado([p(0), p(-5), p(Number.NaN), p(3000)], 5000);
    expect(r.total).toBe(1);
    expect(r.alcanzan).toBe(1);
  });

  it('sin lugares todo es cero, sin dividir ni fallar', () => {
    const r = resumirMercado([], 4000);
    expect(r).toMatchObject({ total: 0, alcanzan: 0 });
    expect(r.tramos.every((t) => t.total === 0)).toBe(true);
  });

  it('un tipo desconocido cuenta en el total pero no rompe el desglose', () => {
    const r = resumirMercado([{ precio_renta: 3000, tipo: 'castillo' as never }], 5000);
    expect(r.total).toBe(1);
    expect(r.porTipo.cuarto.total + r.porTipo.depa.total + r.porTipo.casa_compartida.total).toBe(0);
  });
});

describe('tramos', () => {
  it('cada tope pertenece a su tramo y el siguiente peso, al de arriba', () => {
    expect(tramoDe(2000)).toBe(0);
    expect(tramoDe(2001)).toBe(1);
    expect(tramoDe(6000)).toBe(TOPES_TRAMO.length - 1);
    expect(tramoDe(6001)).toBe(TOPES_TRAMO.length);
  });
  it('las etiquetas dicen el rango en pesos', () => {
    expect(etiquetaDeTramo(0)).toBe('Hasta $2,000');
    expect(etiquetaDeTramo(1)).toBe('$2,001 a $3,000');
    expect(etiquetaDeTramo(5)).toBe('Más de $6,000');
  });
});
