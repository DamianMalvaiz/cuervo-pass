import { MAX_FOTOS_NEGOCIO, validarNegocio, type DatosNegocioForm } from '../negocio';

const completo: DatosNegocioForm = {
  categoriaId: 'comida', nombre: 'Tacos La Esquina', descripcion: 'Tacos al pastor', direccion: 'Calle 1, Lerma',
  rangoPrecio: 1, horario: 'Lun a sáb · 6 pm a 11 pm', fotos: [],
};

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

  it('la cota técnica de fotos es la del plan más alto (60)', () => {
    expect(MAX_FOTOS_NEGOCIO).toBe(60);
  });

  it('sin fotos se puede guardar; con más del máximo no', () => {
    expect(validarNegocio({ ...completo, fotos: [] }).fotos).toBeUndefined();
    const demasiadas = Array.from({ length: MAX_FOTOS_NEGOCIO + 1 }, (_, i) => `f${i}`);
    expect(validarNegocio({ ...completo, fotos: demasiadas }).fotos).toBeTruthy();
  });
});
