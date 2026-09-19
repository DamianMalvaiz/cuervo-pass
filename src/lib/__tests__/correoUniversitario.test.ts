import {
  dominioDe,
  esCorreoUniversitario,
} from '@/lib/correoUniversitario';

describe('dominioDe', () => {
  it('extrae el dominio tras la última arroba', () => {
    expect(dominioDe('ana@utvtol.edu.mx')).toBe('utvtol.edu.mx');
    expect(dominioDe('  Ana@UTVTOL.edu.mx  ')).toBe('utvtol.edu.mx');
  });

  it('rechaza lo que no es un correo', () => {
    for (const malo of ['', 'ana', 'ana@', '@utvtol.edu.mx', 'ana@sinpunto', 'ana@.edu.mx', 'ana@edu.mx.', 'ana@a..mx', 'ana@ dominio.mx']) {
      expect(dominioDe(malo)).toBeNull();
    }
  });
});

describe('esCorreoUniversitario', () => {
  it('acepta dominios universitarios', () => {
    expect(esCorreoUniversitario('ana@utvtol.edu.mx')).toBe(true);
    expect(esCorreoUniversitario('ana@unam.edu.mx')).toBe(true);
    expect(esCorreoUniversitario('ana@alumnos.uaemex.edu.mx')).toBe(true);
  });

  it('rechaza correos personales', () => {
    expect(esCorreoUniversitario('ana@gmail.com')).toBe(false);
    expect(esCorreoUniversitario('ana@hotmail.com')).toBe(false);
  });

  // Las que de verdad importan: un endsWith ingenuo sobre la cadena completa,
  // o un includes, aceptarían las tres.
  it('rechaza dominios que solo PARECEN universitarios', () => {
    expect(esCorreoUniversitario('ana@edu.mx.atacante.com')).toBe(false);
    expect(esCorreoUniversitario('ana@malo.edu.mx.co')).toBe(false);
    expect(esCorreoUniversitario('ana@noesedu.mx')).toBe(false);
    expect(esCorreoUniversitario('ana@utvtol.edu.mx.evil.net')).toBe(false);
    expect(esCorreoUniversitario('.edu.mx@gmail.com')).toBe(false);
  });

  it('no distingue mayúsculas ni espacios al borde', () => {
    expect(esCorreoUniversitario('  ANA@UTVTOL.EDU.MX ')).toBe(true);
  });
});
