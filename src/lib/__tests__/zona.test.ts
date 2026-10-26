import { zonaCorta } from '../zona';

// La zona que llega de la base («colonia, municipio, estado, CP») es larga para una tarjeta: se enseña colonia y municipio. Nunca se inventa: lo que no hay no se muestra.

describe('zonaCorta', () => {
  it('deja colonia y municipio', () => {
    expect(zonaCorta('Lerma de Villada Centro, Lerma, México, CP 52000')).toBe('Lerma de Villada Centro, Lerma');
  });

  it('con una o dos partes no recorta nada', () => {
    expect(zonaCorta('Lerma')).toBe('Lerma');
    expect(zonaCorta('Colonia Centro, Lerma')).toBe('Colonia Centro, Lerma');
  });

  it('sin zona no inventa nada', () => {
    expect(zonaCorta(null)).toBeNull();
    expect(zonaCorta(undefined)).toBeNull();
    expect(zonaCorta('')).toBeNull();
    expect(zonaCorta(' , ')).toBeNull();
  });

  it('ignora espacios y partes vacías', () => {
    expect(zonaCorta('  Centro ,, Toluca , México ')).toBe('Centro, Toluca');
  });

  it('si el segundo tramo es solo un código postal, no lo toma por municipio', () => {
    expect(zonaCorta('Barrio Alto, CP 52000')).toBe('Barrio Alto');
  });
});
