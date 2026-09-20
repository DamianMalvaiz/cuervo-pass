import { codigoDe, CP, esCodigo, SQL } from '@/lib/erroresPostgres';

// END-27 · La detección por subcadena dependía del texto de Postgres, que
// cambia por versión y por locale.

test('lee el codigo de un error de supabase-js', () => {
  expect(codigoDe({ code: '23505', message: 'duplicate key value' })).toBe('23505');
});

test('un error sin codigo no inventa uno', () => {
  expect(codigoDe(new Error('se cayó la red'))).toBeNull();
  expect(codigoDe(null)).toBeNull();
  expect(codigoDe('texto')).toBeNull();
});

test('esCodigo acepta varios a la vez', () => {
  const e = { code: SQL.UNIQUE_VIOLATION };
  expect(esCodigo(e, SQL.UNIQUE_VIOLATION, SQL.FOREIGN_KEY_VIOLATION)).toBe(true);
  expect(esCodigo(e, SQL.CHECK_VIOLATION)).toBe(false);
});

// LA prueba: un error de red NO puede confundirse con una regla de negocio. Con
// subcadenas, un mensaje cualquiera que contuviera «cuota» habría coincidido.
test('un fallo de red no se confunde con una regla de negocio', () => {
  expect(esCodigo(new Error('network request failed'), CP.CUOTA_AGOTADA)).toBe(false);
  expect(esCodigo({ message: 'no hay cuota de disco en el servidor' }, CP.CUOTA_AGOTADA)).toBe(false);
});

// Los dos errores propios son DISTINGUIBLES, que es lo que no eran cuando
// ambos usaban check_violation.
test('la cuota y el limite de publicaciones no comparten codigo', () => {
  expect(CP.CUOTA_AGOTADA).not.toBe(CP.LIMITE_PUBLICACIONES);
  expect(esCodigo({ code: CP.CUOTA_AGOTADA }, CP.LIMITE_PUBLICACIONES)).toBe(false);
});

// Y no se reetiqueta lo que el estándar ya distingue.
test('la violacion de unicidad conserva su codigo estandar', () => {
  expect(SQL.UNIQUE_VIOLATION).toBe('23505');
});
