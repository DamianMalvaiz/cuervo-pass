import {
  MAX_PRODUCTOS_TECNICO, agruparPorSeccion, buscarEnMenu, claveNueva, parsearPrecio, productoVacio, seccionesDe,
  validarMenu, validarProducto, type ProductoEditable,
} from '../menu';

const p = (nombre: string, seccion = '', extra: Partial<ProductoEditable> = {}): ProductoEditable => ({
  clave: nombre, nombre, precio: '10', seccion, descripcion: '', foto: null, fotoNueva: null, ...extra,
});

describe('parsearPrecio', () => {
  it.each([['35', 35], ['35.5', 35.5], ['35,50', 35.5], [' 12 ', 12], ['0', 0]])('«%s» → %s', (t, n) => {
    expect(parsearPrecio(t)).toBe(n);
  });
  it('vacío es «consultar precio» (null), nunca un cero inventado', () => {
    expect(parsearPrecio('')).toBeNull();
    expect(parsearPrecio('  ')).toBeNull();
  });
  it.each(['abc', '-5', '1.234', '$35', '35 pesos'])('«%s» no es un precio', (t) => {
    expect(parsearPrecio(t)).toBeNaN();
  });
});

describe('validarProducto', () => {
  it('uno completo no falla', () => expect(validarProducto(p('Taco'))).toEqual({}));
  it('el nombre es obligatorio y tiene tope', () => {
    expect(validarProducto(p('  ')).nombre).toBeTruthy();
    expect(validarProducto(p('a'.repeat(81))).nombre).toBeTruthy();
    expect(validarProducto(p('a'.repeat(80))).nombre).toBeUndefined();
  });
  it('un precio vacío es válido; uno inválido se señala', () => {
    expect(validarProducto(p('Taco', '', { precio: '' })).precio).toBeUndefined();
    expect(validarProducto(p('Taco', '', { precio: 'mucho' })).precio).toBeTruthy();
  });
  it('sección y descripción tienen sus topes (40 y 200)', () => {
    expect(validarProducto(p('Taco', 'a'.repeat(41))).seccion).toBeTruthy();
    expect(validarProducto(p('Taco', '', { descripcion: 'a'.repeat(201) })).descripcion).toBeTruthy();
    expect(validarProducto(p('Taco', 'a'.repeat(40), { descripcion: 'a'.repeat(200) }))).toEqual({});
  });
});

describe('validarMenu', () => {
  it('un menú válido devuelve null', () => expect(validarMenu([p('A'), p('B')])).toBeNull());
  it('señala el producto con problema, por su nombre', () => {
    expect(validarMenu([p('A'), p('Taco', '', { precio: 'x' })])).toMatch(/«Taco»/);
  });
  it('un producto sin nombre se señala sin comillas vacías', () => {
    expect(validarMenu([p('  ')])).toBe('Escribe el nombre del producto');
  });
  it('respeta el tope del plan y dice cuántos quitar', () => {
    const tres = [p('A'), p('B'), p('C')];
    expect(validarMenu(tres, 2)).toMatch(/hasta 2 productos.*Quita 1/);
    expect(validarMenu(tres, 3)).toBeNull();
  });
  it('nunca pasa de la cota técnica, aunque el plan diga más', () => {
    const muchos = Array.from({ length: MAX_PRODUCTOS_TECNICO + 1 }, (_, i) => p(`P${i}`));
    expect(validarMenu(muchos, 9999)).toMatch(new RegExp(`${MAX_PRODUCTOS_TECNICO}`));
  });
});

describe('agruparPorSeccion', () => {
  it('cada sección aparece donde aparece su primer producto', () => {
    const g = agruparPorSeccion([p('a', 'Tacos'), p('b', 'Bebidas'), p('c', 'Tacos')]);
    expect(g.map((x) => x.seccion)).toEqual(['Tacos', 'Bebidas']);
    expect(g[0].productos.map((x) => x.nombre)).toEqual(['a', 'c']);
  });
  it('los productos sin sección van al final', () => {
    const g = agruparPorSeccion([p('a'), p('b', 'Tacos'), p('c', '  ')]);
    expect(g.map((x) => x.seccion)).toEqual(['Tacos', null]);
    expect(g[1].productos.map((x) => x.nombre)).toEqual(['a', 'c']);
  });
  it('«Tacos» y «tacos » son la misma sección, con la escritura de la primera', () => {
    const g = agruparPorSeccion([p('a', 'Tacos'), p('b', 'tacos ')]);
    expect(g).toHaveLength(1);
    expect(g[0].seccion).toBe('Tacos');
  });
  it('un menú vacío no tiene grupos', () => expect(agruparPorSeccion([])).toEqual([]));
});

describe('seccionesDe', () => {
  it('devuelve las secciones distintas, sin la de «sin sección»', () => {
    expect(seccionesDe([p('a', 'Tacos'), p('b'), p('c', 'Bebidas'), p('d', 'tacos')])).toEqual(['Tacos', 'Bebidas']);
  });
});

describe('buscarEnMenu', () => {
  const menu = [p('Café americano', 'Bebidas'), p('Pan dulce', 'Panadería', { descripcion: 'Concha de vainilla' })];
  it('busca por nombre sin importar mayúsculas ni acentos', () => {
    expect(buscarEnMenu(menu, 'CAFE').map((x) => x.nombre)).toEqual(['Café americano']);
  });
  it('busca también en la descripción y en la sección', () => {
    expect(buscarEnMenu(menu, 'vainilla')).toHaveLength(1);
    expect(buscarEnMenu(menu, 'panaderia')).toHaveLength(1);
  });
  it('texto vacío devuelve todo; sin coincidencias, nada', () => {
    expect(buscarEnMenu(menu, '  ')).toHaveLength(2);
    expect(buscarEnMenu(menu, 'zzz')).toEqual([]);
  });
});

describe('claves nuevas', () => {
  it('dos claves nuevas no chocan', () => expect(claveNueva()).not.toBe(claveNueva()));
  it('un producto vacío arranca sin foto ni id', () => {
    const v = productoVacio();
    expect(v.id).toBeUndefined();
    expect(v.foto).toBeNull();
    expect(v.fotoNueva).toBeNull();
    expect(v.nombre).toBe('');
  });
});
