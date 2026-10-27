import { MAX_FOTOS_NEGOCIO, validarNegocio, type DatosNegocioForm } from '../negocio';

const completo: DatosNegocioForm = {
  categoriaId: 'comida', nombre: 'Tacos La Esquina', descripcion: 'Tacos al pastor', direccion: 'Calle 1, Lerma',
  horario: 'Lunes a sábado · 6 pm a 11 pm', fotos: [], totalProductos: 1, activo: true,
};

describe('validarNegocio', () => {
  describe('lo que vende (mínimo un producto)', () => {
    it('visible y sin productos: no se puede publicar, y dice qué hacer', () => {
      expect(validarNegocio({ ...completo, totalProductos: 0 }).productos).toBe('Agrega al menos un producto para publicar tu negocio.');
    });
    it('con un producto basta', () => expect(validarNegocio({ ...completo, totalProductos: 1 }).productos).toBeUndefined());
    it('pausado puede no tener productos: no se está publicando nada', () => {
      expect(validarNegocio({ ...completo, totalProductos: 0, activo: false }).productos).toBeUndefined();
    });
  });

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

  it('la cota técnica de fotos es la del plan más alto (60)', () => {
    expect(MAX_FOTOS_NEGOCIO).toBe(60);
  });

  it('respeta el límite del PLAN y dice cuántas quitar', () => {
    const cinco = Array.from({ length: 5 }, (_, i) => `f${i}`);
    expect(validarNegocio({ ...completo, fotos: cinco }, 4).fotos).toMatch(/hasta 4 fotos.*Quita 1/);
    expect(validarNegocio({ ...completo, fotos: cinco }, 5).fotos).toBeUndefined();
  });

  it('un límite de plan mayor que la cota técnica no la rebasa', () => {
    const muchas = Array.from({ length: MAX_FOTOS_NEGOCIO + 1 }, (_, i) => `f${i}`);
    expect(validarNegocio({ ...completo, fotos: muchas }, 9999).fotos).toBeTruthy();
  });

  it('sin fotos se puede guardar; con más del máximo no', () => {
    expect(validarNegocio({ ...completo, fotos: [] }).fotos).toBeUndefined();
    const demasiadas = Array.from({ length: MAX_FOTOS_NEGOCIO + 1 }, (_, i) => `f${i}`);
    expect(validarNegocio({ ...completo, fotos: demasiadas }).fotos).toBeTruthy();
  });
});
