import { carpetasDeLaCuenta, rutasDeEntradas } from '../../supabase/functions/eliminar-cuenta/politica';

// Eliminar la cuenta borra archivos con la llave de servicio. Lo que se fija aquí: se barren SOLO carpetas de la propia cuenta (y de sus propios
// negocios), con ids que tienen forma de uuid, y de un listado de Storage solo salen ARCHIVOS, con su ruta completa y sin «..».

const U = '00000000-0000-0000-0000-0000000000f7';
const N1 = '00000000-0000-0000-0000-00000000b001';
const N2 = '00000000-0000-0000-0000-00000000b002';

describe('carpetasDeLaCuenta', () => {
  it('fotos: perfil y publicaciones de la cuenta, y cada negocio propio con su subcarpeta de productos', () => {
    const c = carpetasDeLaCuenta(U, [N1, N2]);
    expect(c.fotos).toEqual([
      `publicaciones/${U}`,
      `negocios/${N1}`, `negocios/${N1}/p`,
      `negocios/${N2}`, `negocios/${N2}/p`,
    ]);
  });

  it('verificación: la carpeta de la cuenta y la de cada rol', () => {
    expect(carpetasDeLaCuenta(U, []).verificacion).toEqual([U, `${U}/comerciante`, `${U}/arrendador`]);
  });

  it('sin negocios no hay carpetas de negocios', () => {
    expect(carpetasDeLaCuenta(U, []).fotos).toEqual([`publicaciones/${U}`]);
  });

  it('un id de cuenta que no es uuid lanza: nunca se barre una carpeta adivinable', () => {
    expect(() => carpetasDeLaCuenta('../otra', [])).toThrow();
    expect(() => carpetasDeLaCuenta('', [])).toThrow();
    expect(() => carpetasDeLaCuenta(`${U}/../x`, [])).toThrow();
  });

  it('un id de negocio raro se descarta en vez de formar una ruta', () => {
    const c = carpetasDeLaCuenta(U, [N1, '../publicaciones', 'x', `${N2}/p`]);
    expect(c.fotos).toEqual([`publicaciones/${U}`, `negocios/${N1}`, `negocios/${N1}/p`]);
  });
});

describe('rutasDeEntradas', () => {
  it('solo salen los ARCHIVOS (los que traen id), con la ruta completa', () => {
    const r = rutasDeEntradas(`negocios/${N1}`, [
      { name: 'a.jpg', id: 'x1' },
      { name: 'p', id: null },          // subcarpeta: no es archivo
      { name: 'b.jpg', id: 'x2' },
    ]);
    expect(r).toEqual([`negocios/${N1}/a.jpg`, `negocios/${N1}/b.jpg`]);
  });

  it('descarta nombres con «..» o con «/»', () => {
    const r = rutasDeEntradas(`negocios/${N1}`, [
      { name: '../otro.jpg', id: 'x' },
      { name: 'a/b.jpg', id: 'x' },
      { name: 'ok.jpg', id: 'x' },
    ]);
    expect(r).toEqual([`negocios/${N1}/ok.jpg`]);
  });

  it('listado vacío o nulo no rompe', () => {
    expect(rutasDeEntradas('x', [])).toEqual([]);
    expect(rutasDeEntradas('x', null)).toEqual([]);
  });
});
