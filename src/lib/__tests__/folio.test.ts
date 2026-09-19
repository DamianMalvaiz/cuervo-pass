import { fechaDeSello, fechaHoraDeSello, folioDe } from '../folio';

// `folioDe` vivía duplicado: una copia en la lista y otra en línea dentro de la
// ficha de detalle. Si una cambiaba, el folio de la lista dejaba de coincidir con
// el de la ficha que abría — y un folio que no casa con su expediente no es un
// folio. Esta prueba fija el formato para que las dos pantallas no puedan
// divergir otra vez.
test('el folio son cuatro caracteres estables del id, en mayúsculas', () => {
  expect(folioDe('3f2a91b4-0000-4000-8000-000000000000')).toBe('3F2A');
  expect(folioDe('3f2a91b4-0000-4000-8000-000000000000')).toBe(
    folioDe('3f2a91b4-0000-4000-8000-000000000000')
  );
});

test('sin id no inventa un folio', () => {
  expect(folioDe(null)).toBe('----');
  expect(folioDe(undefined)).toBe('----');
  expect(folioDe('')).toBe('----');
});

test('la fecha va en formato de sello, no de prosa', () => {
  expect(fechaDeSello('2026-09-19T14:32:00.000Z')).toMatch(/^\d{1,2} [A-Z]{3} 2026$/);
});

// Una fecha inválida devuelve null para que el llamador omita el campo, en vez
// de estampar "Invalid Date" en el membrete de un documento.
test('una fecha inválida no se estampa', () => {
  expect(fechaDeSello('no es una fecha')).toBeNull();
  expect(fechaDeSello(null)).toBeNull();
});

test('la emisión del expediente lleva hora, porque dice qué tan fresca es', () => {
  expect(fechaHoraDeSello(new Date(2026, 8, 19, 9, 5))).toBe('19 SEP 2026 · 09:05');
});
