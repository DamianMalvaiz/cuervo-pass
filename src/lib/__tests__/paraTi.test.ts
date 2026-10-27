import { primerNombre, saludoDe } from '../paraTi';

// La portada de quien ya entró: el saludo cambia con la hora y se dirige a la persona por su primer nombre, si se sabe. Sin nombre no se inventa uno.

describe('saludoDe', () => {
  it('buenos días hasta antes de las 12, buenas tardes hasta antes de las 19, buenas noches después', () => {
    expect(saludoDe(5)).toBe('Buenos días');
    expect(saludoDe(11)).toBe('Buenos días');
    expect(saludoDe(12)).toBe('Buenas tardes');
    expect(saludoDe(18)).toBe('Buenas tardes');
    expect(saludoDe(19)).toBe('Buenas noches');
    expect(saludoDe(23)).toBe('Buenas noches');
  });

  it('la madrugada también es de noche (a las 2 no se dice «buenos días»)', () => {
    expect(saludoDe(0)).toBe('Buenas noches');
    expect(saludoDe(2)).toBe('Buenas noches');
    expect(saludoDe(4)).toBe('Buenas noches');
  });
});

describe('primerNombre', () => {
  it('toma la primera palabra del nombre completo', () => {
    expect(primerNombre('Ana Ruiz López')).toBe('Ana');
    expect(primerNombre('  Ángel Damián ')).toBe('Ángel');
  });

  it('sin nombre (vacío, espacios, nulo) devuelve null: no se inventa uno', () => {
    expect(primerNombre('')).toBeNull();
    expect(primerNombre('   ')).toBeNull();
    expect(primerNombre(null)).toBeNull();
    expect(primerNombre(undefined)).toBeNull();
  });
});
