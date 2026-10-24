import { readFileSync } from 'node:fs';

import { carpetasDeLaCuenta, ejecutarBorrado, rutasDeEntradas } from '../../supabase/functions/eliminar-cuenta/politica';

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


// Hallazgo 5 de la auditoría del 23/10/2026. `eliminar-cuenta` borraba los ARCHIVOS (fotos, INE) y solo al final llamaba a `deleteUser`. Si
// `deleteUser` fallaba por un error transitorio, la cuenta seguía viva pero con sus fotos y su evidencia ya borradas: publicaciones con
// imágenes rotas, y un borrado «fallido» que había destruido datos igualmente. Además devolvía `error.message` crudo al cliente.
//
// El orden correcto es: calcular las rutas (después las filas que las nombran ya no existen), BORRAR LA CUENTA y solo entonces los archivos.
// Si la cuenta no se borra, no se toca nada. Si los archivos fallan después, no se pierde nada: quedan en las colas de huérfanos que barren
// `barrer-fotos` y `barrer-verificaciones` (la cuenta ya no existe, pero la cola vive aparte).
describe('ejecutarBorrado', () => {
  const rutas = { fotos: ['perfiles/a.jpg', 'publicaciones/u/1.jpg'], verificacion: ['u/comerciante/ine-frente-1.jpg'] };

  function pasos(opciones: { falla?: string | null } = {}) {
    const llamadas: string[] = [];
    return {
      llamadas,
      p: {
        recogerRutas: async () => { llamadas.push('recoger'); return rutas; },
        borrarCuenta: async () => { llamadas.push('cuenta'); return opciones.falla ?? null; },
        borrarFotos: async (r: string[]) => { llamadas.push(`fotos:${r.length}`); },
        borrarVerificacion: async (r: string[]) => { llamadas.push(`verificacion:${r.length}`); },
      },
    };
  }

  it('recoge las rutas, borra la CUENTA y solo después los archivos', async () => {
    const { p, llamadas } = pasos();
    expect(await ejecutarBorrado(p)).toEqual({ ok: true, fotos: 2, evidencia: 1 });
    expect(llamadas).toEqual(['recoger', 'cuenta', 'fotos:2', 'verificacion:1']);
  });

  it('si la cuenta NO se borra, no se toca ni un archivo', async () => {
    const { p, llamadas } = pasos({ falla: 'Database error deleting user' });
    expect(await ejecutarBorrado(p)).toEqual({ ok: false });
    expect(llamadas).toEqual(['recoger', 'cuenta']);
  });

  it('el motivo del fallo no sale en el resultado: puede traer nombres internos', async () => {
    const { p } = pasos({ falla: 'violates foreign key constraint "pagos_usuario_fkey"' });
    expect(JSON.stringify(await ejecutarBorrado(p))).not.toContain('pagos_usuario_fkey');
  });
});

describe('index.ts de eliminar-cuenta aplica el orden', () => {
  const fuente = readFileSync('supabase/functions/eliminar-cuenta/index.ts', 'utf8');

  it('usa ejecutarBorrado en vez de borrar los archivos por su cuenta', () => {
    expect(fuente).toContain('ejecutarBorrado(');
  });

  it('ya no devuelve el mensaje crudo de deleteUser al cliente', () => {
    expect(fuente).not.toMatch(/json\(\{ error: error\.message \}/);
  });
});
