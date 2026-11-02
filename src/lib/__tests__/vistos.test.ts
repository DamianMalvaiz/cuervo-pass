import { CLAVE_VISTOS, MAX_VISTOS, borrarVistos, conVisto, leerVistos, registrarVisto, suscribirVistos } from '../vistos';

// «Vistos recientemente»: solo en el navegador, validado al leer, el más reciente primero, sin repetidos y con tope.

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function ponerAlmacen(inicial?: string) {
  const datos = new Map<string, string>(inicial === undefined ? [] : [[CLAVE_VISTOS, inicial]]);
  (globalThis as unknown as { localStorage: unknown }).localStorage = {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => void datos.set(k, v),
    removeItem: (k: string) => void datos.delete(k),
  };
  return datos;
}
afterEach(() => {
  delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
});

describe('conVisto', () => {
  it('pone el nuevo al frente y quita su repetido', () => {
    expect(conVisto([id(1), id(2), id(3)], id(3))).toEqual([id(3), id(1), id(2)]);
  });
  it('recorta al tope', () => {
    const muchos = Array.from({ length: MAX_VISTOS }, (_, i) => id(i + 1));
    const r = conVisto(muchos, id(99));
    expect(r).toHaveLength(MAX_VISTOS);
    expect(r[0]).toBe(id(99));
    expect(r).not.toContain(id(MAX_VISTOS));
  });
  it('ignora lo que no es un id', () => {
    expect(conVisto([id(1)], '<script>')).toEqual([id(1)]);
  });
});

describe('leerVistos y registrarVisto', () => {
  it('sin almacenamiento disponible no hay vistos y no falla', () => {
    expect(leerVistos()).toEqual([]);
    expect(() => registrarVisto(id(1))).not.toThrow();
  });
  it('un JSON roto o de otra forma es «no hay vistos»', () => {
    ponerAlmacen('{no es json');
    expect(leerVistos()).toEqual([]);
    ponerAlmacen('{"a":1}');
    expect(leerVistos()).toEqual([]);
  });
  it('descarta lo que no es id y los repetidos', () => {
    ponerAlmacen(JSON.stringify([id(1), 'x', 5, id(1), id(2)]));
    expect(leerVistos()).toEqual([id(1), id(2)]);
  });
  it('registra y borra', () => {
    ponerAlmacen();
    registrarVisto(id(1));
    registrarVisto(id(2));
    expect(leerVistos()).toEqual([id(2), id(1)]);
    borrarVistos();
    expect(leerVistos()).toEqual([]);
  });
});

describe('suscripción', () => {
  it('avisa al registrar y al borrar', () => {
    ponerAlmacen();
    const f = jest.fn();
    const baja = suscribirVistos(f);
    registrarVisto(id(1));
    borrarVistos();
    expect(f).toHaveBeenCalledTimes(2);
    baja();
    registrarVisto(id(2));
    expect(f).toHaveBeenCalledTimes(2);
  });
});
