import { igualEnTiempoConstante, rutasDeIne } from '../../supabase/functions/barrer-verificaciones/politica';

// El barrido de la INE borra archivos con la llave de servicio. Lo que se fija aquí es lo que NO debe poder borrar:
// nada fuera de la carpeta de la propia cuenta, y nunca las fotos del local.

const U = '00000000-0000-0000-0000-0000000000f7';

describe('rutasDeIne', () => {
  it('devuelve el frente y el reverso de la propia carpeta', () => {
    expect(rutasDeIne({ usuario_id: U, ine_frente: `${U}/f.jpg`, ine_reverso: `${U}/r.jpg` })).toEqual([
      `${U}/f.jpg`,
      `${U}/r.jpg`,
    ]);
  });

  it('descarta una ruta de la carpeta de OTRA cuenta', () => {
    const otra = '00000000-0000-0000-0000-0000000000b2';
    expect(rutasDeIne({ usuario_id: U, ine_frente: `${otra}/f.jpg`, ine_reverso: `${U}/r.jpg` })).toEqual([`${U}/r.jpg`]);
  });

  it('descarta rutas con «..» que intentan salir de la carpeta', () => {
    expect(rutasDeIne({ usuario_id: U, ine_frente: `${U}/../x.jpg`, ine_reverso: `${U}/r.jpg` })).toEqual([`${U}/r.jpg`]);
  });

  it('descarta un prefijo parecido pero no igual', () => {
    expect(rutasDeIne({ usuario_id: U, ine_frente: `${U}x/f.jpg`, ine_reverso: `${U}/r.jpg` })).toEqual([`${U}/r.jpg`]);
  });

  it('sin rutas válidas devuelve vacío: no se borra nada ni se marca', () => {
    expect(rutasDeIne({ usuario_id: U, ine_frente: '', ine_reverso: 'x/y.jpg' })).toEqual([]);
  });

  it('no trae las fotos del local: la fila ni siquiera las recibe', () => {
    const fila = { usuario_id: U, ine_frente: `${U}/f.jpg`, ine_reverso: `${U}/r.jpg`, fotos: [`${U}/local.jpg`] };
    expect(rutasDeIne(fila)).not.toContain(`${U}/local.jpg`);
  });
});

describe('igualEnTiempoConstante', () => {
  it('iguales', () => expect(igualEnTiempoConstante('Bearer abc', 'Bearer abc')).toBe(true));
  it('distintas del mismo largo', () => expect(igualEnTiempoConstante('Bearer abc', 'Bearer abd')).toBe(false));
  it('de distinto largo', () => expect(igualEnTiempoConstante('Bearer abc', 'Bearer abcd')).toBe(false));
  it('vacías contra algo', () => expect(igualEnTiempoConstante('', 'Bearer x')).toBe(false));
});
