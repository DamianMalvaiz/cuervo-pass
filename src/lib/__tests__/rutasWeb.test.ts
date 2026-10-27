import { FILTROS_VACIOS } from '../filtrosWeb';
import { deParametros, aParametros, RutasWeb } from '../rutasWeb';

// Cada sección de la web es su propia página con su propia dirección, y una búsqueda se puede compartir como enlace. Lo que se fija: las direcciones, y que un parámetro roto o malicioso nunca se vuelva un filtro.

describe('RutasWeb', () => {
  it('cada sección tiene su dirección', () => {
    expect(RutasWeb.inicio).toBe('/');
    expect(RutasWeb.departamentos).toBe('/departamentos');
    expect(RutasWeb.roomies).toBe('/roomies');
    expect(RutasWeb.servicios).toBe('/servicios');
  });

  it('las fichas cuelgan de su sección', () => {
    expect(RutasWeb.ficha('abc')).toBe('/departamentos/abc');
    expect(RutasWeb.negocio('xyz')).toBe('/servicios/xyz');
  });
});

describe('aParametros', () => {
  it('sin filtros no lleva nada', () => {
    expect(aParametros(FILTROS_VACIOS)).toEqual({});
  });

  it('solo lleva lo que se llenó', () => {
    expect(aParametros({ ...FILTROS_VACIOS, zona: ' Lerma ', presupuesto: '4000', tipo: 'cuarto', amueblado: true })).toEqual({ zona: 'Lerma', presupuesto: '4000', tipo: 'cuarto', amueblado: '1' });
  });

  it('un presupuesto sin cifras no viaja', () => {
    expect(aParametros({ ...FILTROS_VACIOS, presupuesto: 'abc' })).toEqual({});
  });
});

describe('deParametros', () => {
  it('es la inversa de aParametros', () => {
    const f = { ...FILTROS_VACIOS, zona: 'Toluca', presupuesto: '3500', tipo: 'depa' as const, mascotas: true, serviciosIncluidos: true };
    expect(deParametros(aParametros(f))).toEqual(f);
  });

  it('sin parámetros, filtros vacíos', () => {
    expect(deParametros({})).toEqual(FILTROS_VACIOS);
  });

  it('un tipo que no existe se ignora (no se vuelve filtro)', () => {
    expect(deParametros({ tipo: 'mansion' }).tipo).toBeNull();
    expect(deParametros({ tipo: 'casa_compartida' }).tipo).toBe('casa_compartida');
  });

  it('el presupuesto solo conserva cifras', () => {
    expect(deParametros({ presupuesto: '4,0a00; drop table' }).presupuesto).toBe('4000');
  });

  it('un parámetro repetido toma el primero; los de sí/no solo valen con «1»', () => {
    expect(deParametros({ zona: ['Lerma', 'Toluca'] }).zona).toBe('Lerma');
    expect(deParametros({ amueblado: 'true' }).amueblado).toBe(false);
    expect(deParametros({ amueblado: '1' }).amueblado).toBe(true);
  });

  it('la zona se recorta y no pasa de un largo razonable', () => {
    expect(deParametros({ zona: '  Lerma  ' }).zona).toBe('Lerma');
    expect(deParametros({ zona: 'x'.repeat(500) }).zona).toHaveLength(80);
  });
});
