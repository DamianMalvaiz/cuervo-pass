import { FILTROS_VACIOS, aFiltroPublicaciones, etiquetaDeTipo, hayFiltros, parsearPresupuesto, siguienteTipo } from '../filtrosWeb';

// El buscador de la portada pública. Lo que se fija: qué número es un presupuesto, cómo se vuelve filtro del servidor y que un filtro vacío NO filtra nada.

describe('parsearPresupuesto', () => {
  it('acepta pesos con comas, signo o espacios', () => {
    expect(parsearPresupuesto('4000')).toBe(4000);
    expect(parsearPresupuesto('$4,000')).toBe(4000);
    expect(parsearPresupuesto(' 3 500 ')).toBe(3500);
  });

  it('vacío, cero o texto sin cifras no es un tope', () => {
    for (const t of ['', '   ', '0', '$', 'abc', '-5']) expect(parsearPresupuesto(t)).toBeUndefined();
  });

  it('descarta decimales sin redondear hacia arriba (un tope no se infla)', () => {
    expect(parsearPresupuesto('3999.99')).toBe(3999);
  });

  it('un número absurdo no pasa: más de nueve cifras no es una renta', () => {
    expect(parsearPresupuesto('99999999999')).toBeUndefined();
  });
});

describe('siguienteTipo', () => {
  it('recorre todos → cuarto → departamento → casa compartida → todos', () => {
    expect(siguienteTipo(null)).toBe('cuarto');
    expect(siguienteTipo('cuarto')).toBe('depa');
    expect(siguienteTipo('depa')).toBe('casa_compartida');
    expect(siguienteTipo('casa_compartida')).toBeNull();
  });

  it('cada tipo tiene su nombre en español', () => {
    expect(etiquetaDeTipo(null)).toBe('Todos');
    expect(etiquetaDeTipo('cuarto')).toBe('Cuarto');
    expect(etiquetaDeTipo('depa')).toBe('Departamento');
    expect(etiquetaDeTipo('casa_compartida')).toBe('Casa compartida');
  });
});

describe('aFiltroPublicaciones', () => {
  it('con los filtros vacíos solo lleva el límite', () => {
    expect(aFiltroPublicaciones(FILTROS_VACIOS, 12)).toEqual({ limite: 12 });
  });

  it('traduce cada campo y omite lo que no se llenó', () => {
    const f = { ...FILTROS_VACIOS, zona: ' Lerma ', presupuesto: '$4,000', tipo: 'cuarto' as const, amueblado: true };
    expect(aFiltroPublicaciones(f, 8)).toEqual({ limite: 8, zona: 'Lerma', precioMax: 4000, tipo: 'cuarto', amueblado: true });
  });

  it('mascotas y servicios incluidos solo van cuando están activos', () => {
    expect(aFiltroPublicaciones({ ...FILTROS_VACIOS, mascotas: true, serviciosIncluidos: true }, 8)).toEqual({ limite: 8, mascotas: true, serviciosIncluidos: true });
  });
});

describe('hayFiltros', () => {
  it('vacío no cuenta como filtro; cualquier campo lleno sí', () => {
    expect(hayFiltros(FILTROS_VACIOS)).toBe(false);
    expect(hayFiltros({ ...FILTROS_VACIOS, zona: '  ' })).toBe(false);
    expect(hayFiltros({ ...FILTROS_VACIOS, zona: 'Toluca' })).toBe(true);
    expect(hayFiltros({ ...FILTROS_VACIOS, tipo: 'depa' })).toBe(true);
    expect(hayFiltros({ ...FILTROS_VACIOS, presupuesto: 'abc' })).toBe(false);
    expect(hayFiltros({ ...FILTROS_VACIOS, mascotas: true })).toBe(true);
  });
});
