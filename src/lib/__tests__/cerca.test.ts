import { RADIOS_KM, cajaDe, ordenarPorCercania, textoDeCercania } from '../cerca';
import { calcularDistanciaKm } from '../distancia';

// «Cerca de aquí»: la caja del servidor contiene siempre al círculo; el orden es por cercanía; lo que no se puede ubicar se omite; los tiempos son estimaciones rotuladas.

const U = { lat: 19.32568, lng: -99.458244 };

describe('cajaDe', () => {
  it('contiene cualquier punto que esté dentro del radio (en las cuatro direcciones y en diagonal)', () => {
    for (const r of RADIOS_KM) {
      const c = cajaDe(U.lat, U.lng, r);
      for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7]]) {
        // Un punto a casi r km en esa dirección.
        const lat = U.lat + (dy * r * 0.99) / 111.32;
        const lng = U.lng + (dx * r * 0.99) / (111.32 * Math.cos((U.lat * Math.PI) / 180));
        if (calcularDistanciaKm(U.lat, U.lng, lat, lng) <= r) {
          expect(lat).toBeGreaterThanOrEqual(c.latMin);
          expect(lat).toBeLessThanOrEqual(c.latMax);
          expect(lng).toBeGreaterThanOrEqual(c.lngMin);
          expect(lng).toBeLessThanOrEqual(c.lngMax);
        }
      }
    }
  });
});

describe('ordenarPorCercania', () => {
  const lugar = (id: string, lat: number | null, lng: number | null) => ({ id, latitud_aprox: lat, longitud_aprox: lng });
  it('ordena del más cercano al más lejano, omite los que no traen coordenadas y los que quedan fuera del radio', () => {
    const cerca = lugar('cerca', U.lat + 0.005, U.lng);
    const medio = lugar('medio', U.lat + 0.02, U.lng);
    const lejos = lugar('lejos', U.lat + 0.2, U.lng);
    const sinUbicar = lugar('sin', null, null);
    const medioNulo = lugar('mitad', U.lat, null);
    const r = ordenarPorCercania([medio, lejos, sinUbicar, cerca, medioNulo], U.lat, U.lng, 3);
    expect(r.map((x) => x.item.id)).toEqual(['cerca', 'medio']);
    expect(r[0].km).toBeLessThan(r[1].km);
  });
});

describe('textoDeCercania', () => {
  it('cerca: a pie, aproximado', () => {
    expect(textoDeCercania(1.2)).toBe('a ~1 km · ~14 min a pie');
    expect(textoDeCercania(0.5)).toBe('a menos de 1 km · ~6 min a pie');
  });
  it('lejos: en bici', () => {
    expect(textoDeCercania(4.5)).toBe('a ~5 km · ~18 min en bici');
  });
  it('nunca dice 0 minutos', () => {
    expect(textoDeCercania(0.01)).toContain('~1 min');
  });
});
