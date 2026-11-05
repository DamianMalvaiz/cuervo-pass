import { subtituloTarjeta, zonaAproximadaDe, zonaCorta } from '../zona';

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

describe('subtituloTarjeta', () => {
  const base = { titulo_publico: 'Cuarto en Santa María', zona: 'Santa María, Lerma, México, CP 52000', recamaras: null, amueblado: null };
  it('no repite la colonia que el título ya dice: municipio y detalles', () => {
    expect(subtituloTarjeta({ ...base, recamaras: 2, amueblado: true })).toBe('Lerma · 2 recámaras · Amueblado');
    expect(subtituloTarjeta({ ...base, recamaras: 1 })).toBe('Lerma · 1 recámara');
  });
  it('si el título no nombra la colonia, dice la zona completa', () => {
    expect(subtituloTarjeta({ ...base, titulo_publico: 'Departamento' })).toBe('Santa María, Lerma');
  });
  it('sin municipio (una sola parte) dice lo que hay, sin inventar', () => {
    expect(subtituloTarjeta({ ...base, zona: 'Centro' })).toBe('Centro');
  });
  it('sin zona ni detalles es null, y los detalles solos se dicen', () => {
    expect(subtituloTarjeta({ ...base, zona: null })).toBeNull();
    expect(subtituloTarjeta({ ...base, zona: null, amueblado: true })).toBe('Amueblado');
  });
  it('recámaras 0 o amueblado false no se dicen', () => {
    expect(subtituloTarjeta({ ...base, recamaras: 0, amueblado: false })).toBe('Lerma');
  });
});

describe('zonaAproximadaDe (espejo de zona_aproximada de la base)', () => {
  it('quita la calle y número: lo que queda sin el primer tramo', () => {
    expect(zonaAproximadaDe('Calle Hidalgo 12, Centro, Lerma, México')).toBe('Centro, Lerma, México');
  });
  it('una dirección sin comas no tiene zona que decir (no enseña la calle)', () => {
    expect(zonaAproximadaDe('Calle Hidalgo 12')).toBeNull();
    expect(zonaAproximadaDe('')).toBeNull();
    expect(zonaAproximadaDe(null)).toBeNull();
  });
  it('si tras la coma no hay nada, tampoco', () => {
    expect(zonaAproximadaDe('Calle Hidalgo 12,')).toBeNull();
    expect(zonaAproximadaDe('Calle Hidalgo 12,   ')).toBeNull();
    expect(zonaAproximadaDe('Calle Hidalgo 12, ,')).toBeNull(); // la base también descarta una zona que sea solo «,»
  });
});
