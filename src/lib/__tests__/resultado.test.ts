import { desde, ok, problema, tieneDatos, vacio, type Resultado } from '@/lib/resultado';

// END-11 · La distinción entera del módulo cabe en una frase: un `catch` NUNCA
// puede producir `vacio`. Estas pruebas la fijan.

test('un valor presente es ok', async () => {
  const r = await desde(Promise.resolve({ id: 'p1' }));
  expect(r).toEqual({ estado: 'ok', datos: { id: 'p1' } });
});

test('null es vacio, no error', async () => {
  expect(await desde(Promise.resolve(null))).toEqual({ estado: 'vacio' });
});

test('undefined tambien es vacio', async () => {
  expect(await desde(Promise.resolve(undefined as never))).toEqual({ estado: 'vacio' });
});

// LA prueba. Antes, esto acababa en null y la pantalla decía que la
// publicación había sido reportada.
test('una excepcion es error, jamas vacio', async () => {
  const r = await desde(Promise.reject(new Error('network request failed')));
  expect(r.estado).toBe('error');
  expect(r.estado).not.toBe('vacio');
});

test('el texto del fallo se puede ajustar por pantalla', async () => {
  const r = await desde(Promise.reject(new Error('x')), 'No pudimos consultar esta ficha.');
  expect(r).toEqual({ estado: 'error', mensaje: 'No pudimos consultar esta ficha.' });
});

// Un cero, una cadena vacía o un arreglo vacío son DATOS. Tratarlos como vacío
// sería el mismo error de colapsar estados, en la otra dirección.
test('valores falsy que no son null siguen siendo datos', async () => {
  expect(await desde(Promise.resolve(0 as never))).toEqual({ estado: 'ok', datos: 0 });
  expect(await desde(Promise.resolve('' as never))).toEqual({ estado: 'ok', datos: '' });
  expect(await desde(Promise.resolve([] as never))).toEqual({ estado: 'ok', datos: [] });
});

test('tieneDatos estrecha el tipo y solo acepta ok', () => {
  const a: Resultado<string> = ok('x');
  const b: Resultado<string> = vacio();
  const c: Resultado<string> = problema('falló');
  expect(tieneDatos(a)).toBe(true);
  expect(tieneDatos(b)).toBe(false);
  expect(tieneDatos(c)).toBe(false);
  if (tieneDatos(a)) expect(a.datos.length).toBe(1);
});
