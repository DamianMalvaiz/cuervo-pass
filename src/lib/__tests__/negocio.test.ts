import { MAX_FOTOS_NEGOCIO, MAX_ITEMS_MENU, parsearPrecio, validarNegocio, type DatosNegocioForm } from '../negocio';

const completo: DatosNegocioForm = {
  categoriaId: 'comida', nombre: 'Tacos La Esquina', descripcion: 'Tacos al pastor', direccion: 'Calle 1, Lerma',
  rangoPrecio: 1, horario: 'Lun a sáb · 6 pm a 11 pm', fotos: [], items: [{ nombre: 'Taco', precio: '18' }],
};

describe('parsearPrecio', () => {
  it.each([['35', 35], ['35.5', 35.5], ['35.50', 35.5], ['35,50', 35.5], [' 12 ', 12], ['0', 0]])('«%s» → %s', (t, n) => {
    expect(parsearPrecio(t)).toBe(n);
  });
  it('vacío es «consultar precio» (null), nunca un cero inventado', () => {
    expect(parsearPrecio('')).toBeNull();
    expect(parsearPrecio('   ')).toBeNull();
  });
  it.each(['abc', '-5', '1.234', '1.2.3', '$35', '35 pesos'])('«%s» no es un precio', (t) => {
    expect(parsearPrecio(t)).toBeNaN();
  });
});

describe('validarNegocio', () => {
  it('completo, no falta nada', () => expect(validarNegocio(completo)).toEqual({}));

  it('una ficha vacía dice qué falta', () => {
    const e = validarNegocio({ ...completo, categoriaId: null, nombre: '', direccion: '' });
    expect(Object.keys(e).sort()).toEqual(['categoriaId', 'direccion', 'nombre']);
  });

  it('descripción y horario son opcionales pero con tope', () => {
    expect(validarNegocio({ ...completo, descripcion: '', horario: '' })).toEqual({});
    expect(validarNegocio({ ...completo, descripcion: 'a'.repeat(601) }).descripcion).toBeTruthy();
    expect(validarNegocio({ ...completo, descripcion: 'a'.repeat(600) }).descripcion).toBeUndefined();
    expect(validarNegocio({ ...completo, horario: 'a'.repeat(121) }).horario).toBeTruthy();
  });

  it('los límites de nombre y dirección son los de la base', () => {
    expect(validarNegocio({ ...completo, nombre: 'a' }).nombre).toBeTruthy();
    expect(validarNegocio({ ...completo, nombre: 'ab' }).nombre).toBeUndefined();
    expect(validarNegocio({ ...completo, nombre: 'a'.repeat(81) }).nombre).toBeTruthy();
    expect(validarNegocio({ ...completo, direccion: 'a'.repeat(201) }).direccion).toBeTruthy();
  });

  it('sin fotos se puede guardar; con más del máximo no', () => {
    expect(validarNegocio({ ...completo, fotos: [] }).fotos).toBeUndefined();
    const demasiadas = Array.from({ length: MAX_FOTOS_NEGOCIO + 1 }, (_, i) => `f${i}`);
    expect(validarNegocio({ ...completo, fotos: demasiadas }).fotos).toBeTruthy();
  });

  it('un producto sin nombre o con precio inválido se señala', () => {
    expect(validarNegocio({ ...completo, items: [{ nombre: '  ', precio: '10' }] }).items).toMatch(/nombre/);
    expect(validarNegocio({ ...completo, items: [{ nombre: 'Taco', precio: 'mucho' }] }).items).toMatch(/Taco/);
  });

  it('un producto sin precio es válido: se dirá «Consultar precio»', () => {
    expect(validarNegocio({ ...completo, items: [{ nombre: 'Revisión', precio: '' }] }).items).toBeUndefined();
  });

  it('más de 40 productos no', () => {
    const muchos = Array.from({ length: MAX_ITEMS_MENU + 1 }, (_, i) => ({ nombre: `P${i}`, precio: '1' }));
    expect(validarNegocio({ ...completo, items: muchos }).items).toMatch(/40/);
  });
});
