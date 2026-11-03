import { CLAVE_COMPARAR, MAX_COMPARAR, alternarComparar, conComparado, leerComparar, quitarComparar, suscribirComparar, vaciarComparar } from '../comparar';

// Comparar: hasta tres, solo en el navegador, validado al leer; alternar agrega o quita y nunca pasa del tope.

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const g = globalThis as unknown as { localStorage?: unknown };
function ponerAlmacen(inicial?: string) {
  const datos = new Map<string, string>(inicial === undefined ? [] : [[CLAVE_COMPARAR, inicial]]);
  g.localStorage = { getItem: (k: string) => datos.get(k) ?? null, setItem: (k: string, v: string) => void datos.set(k, v), removeItem: (k: string) => void datos.delete(k) };
}
afterEach(() => delete g.localStorage);

describe('conComparado', () => {
  it('agrega al final y quita si ya estaba', () => {
    expect(conComparado([id(1)], id(2))).toEqual([id(1), id(2)]);
    expect(conComparado([id(1), id(2)], id(1))).toEqual([id(2)]);
  });
  it('no pasa del tope: con la lista llena, agregar no cambia nada, pero quitar sí', () => {
    const llena = Array.from({ length: MAX_COMPARAR }, (_, i) => id(i + 1));
    expect(conComparado(llena, id(99))).toEqual(llena);
    expect(conComparado(llena, id(1))).toHaveLength(MAX_COMPARAR - 1);
  });
  it('ignora lo que no es un id', () => {
    expect(conComparado([], 'x')).toEqual([]);
  });
});

describe('lectura y escritura', () => {
  it('sin almacenamiento no hay lista y no falla', () => {
    expect(leerComparar()).toEqual([]);
    expect(() => alternarComparar(id(1))).not.toThrow();
  });
  it('lo roto, ajeno o repetido se descarta, y se recorta al tope', () => {
    expect(leerComparar('{no')).toEqual([]);
    expect(leerComparar('{"a":1}')).toEqual([]);
    expect(leerComparar(JSON.stringify([id(1), 'x', id(1), id(2), id(3), id(4)]))).toEqual([id(1), id(2), id(3)]);
  });
  it('alterna, quita y vacía, y avisa a quien escucha', () => {
    ponerAlmacen();
    const f = jest.fn();
    const baja = suscribirComparar(f);
    alternarComparar(id(1));
    alternarComparar(id(2));
    expect(leerComparar()).toEqual([id(1), id(2)]);
    quitarComparar(id(1));
    expect(leerComparar()).toEqual([id(2)]);
    vaciarComparar();
    expect(leerComparar()).toEqual([]);
    expect(f).toHaveBeenCalledTimes(4);
    baja();
  });
});
