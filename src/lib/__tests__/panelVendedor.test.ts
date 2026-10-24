import { pasoDeVerificacion, tituloDeLoPropio } from '../panelVendedor';

const rol = (r: string, estado: string, origen = 'solicitud') => ({ usuario_id: 'u1', rol: r, estado, origen, desde: 'x' }) as never;

// El panel enseña UN paso de verificación: el que más urge. Lo que se fija: lo pendiente de la persona va antes que esperar, esperar antes que
// nada, y un admin o un estudiante sin funciones no tiene paso (el panel de un vendedor no se pinta a quien no vende).

describe('pasoDeVerificacion', () => {
  it('sin funciones de vendedor no hay paso', () => {
    expect(pasoDeVerificacion([])).toBeNull();
    expect(pasoDeVerificacion([rol('admin', 'aprobado')])).toBeNull();
  });

  it('una función sin verificar pide empezar la verificación, de ESE rol', () => {
    expect(pasoDeVerificacion([rol('arrendador', 'sin_verificar')])).toEqual({ tipo: 'empezar', rol: 'arrendador' });
  });

  it('una rechazada pide volver a enviarla', () => {
    expect(pasoDeVerificacion([rol('comerciante', 'rechazado')])).toEqual({ tipo: 'reenviar', rol: 'comerciante' });
  });

  it('una en revisión solo pide esperar', () => {
    expect(pasoDeVerificacion([rol('comerciante', 'pendiente')])).toEqual({ tipo: 'esperar', rol: 'comerciante' });
  });

  it('todo aprobado: no hay paso pendiente', () => {
    expect(pasoDeVerificacion([rol('arrendador', 'aprobado'), rol('comerciante', 'aprobado')])).toEqual({ tipo: 'listo', rol: null });
  });

  it('lo que hay que HACER va antes que lo que hay que esperar', () => {
    const paso = pasoDeVerificacion([rol('comerciante', 'pendiente'), rol('arrendador', 'sin_verificar')]);
    expect(paso).toEqual({ tipo: 'empezar', rol: 'arrendador' });
  });

  it('una función heredada de la migración cuenta como aprobada (no inventa un paso)', () => {
    expect(pasoDeVerificacion([rol('arrendador', 'aprobado', 'migracion')])).toEqual({ tipo: 'listo', rol: null });
  });
});

describe('tituloDeLoPropio', () => {
  it('un arrendador tiene «Mis publicaciones»', () => {
    expect(tituloDeLoPropio([rol('arrendador', 'aprobado')])).toBe('Mis publicaciones');
  });

  it('un comerciante tiene «Mis negocios»', () => {
    expect(tituloDeLoPropio([rol('comerciante', 'sin_verificar')])).toBe('Mis negocios');
  });

  it('con las dos funciones, «Lo que ofrezco»', () => {
    expect(tituloDeLoPropio([rol('arrendador', 'aprobado'), rol('comerciante', 'aprobado')])).toBe('Lo que ofrezco');
  });
});
